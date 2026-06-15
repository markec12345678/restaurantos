import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toNum } from '@/lib/decimal'
import { generateKitchenOrder, generateReceipt, generateTestPrint, type KitchenOrderPrintData, type ReceiptPrintData } from '@/lib/escpos'
import { generateFursQRContent } from '@/lib/furs'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { printRequestSchema, sendToPrinter, getPrinterModel, findPrinter } from './_helpers'

// ============================================
// POST /api/print — Tiskanje na omrežni tiskalnik (ESC/POS over TCP/IP)
// ============================================

export async function POST(req: Request) {
  // Rate limiting — prepreči zlorabo API-ja
  const rl = checkRateLimit('print', getClientIp(req), AUTHENTICATED_LIMIT)
  if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

  // FIX C-07: Zahtevaj avtentikacijo za tiskanje
  const authResult = await requireAuth(req, { permission: 'take_orders' })
  if (authResult.error) return authResult.error

  try {
    const { data, error: validationError } = await validateRequest(req, printRequestSchema)
    if (validationError) return validationError

    const { type, orderId, printerId } = data

    switch (type) {
      case 'order': {
        // Zod refine zagotavlja orderId, a TypeScript tega ne ve
        if (!orderId) {
          return NextResponse.json({ error: 'Manjka orderId' }, { status: 400 })
        }
        // Pridobi podatke naročila
        const order = await db.order.findUnique({
          where: { id: orderId },
          include: {
            table: true,
            orderItems: {
              include: { menuItem: { include: { category: true } } },
              orderBy: { createdAt: 'asc' },
            },
          },
        })
        if (!order) {
          return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
        }
        // Poišči kuhinjski tiskalnik
        const printer = await findPrinter('order', printerId)
        if (!printer) {
          return NextResponse.json({ error: 'Noben kuhinjski tiskalnik ni na voljo', printed: false })
        }
        // Pripravi podatke za tisk
        const printData: KitchenOrderPrintData = {
          orderNumber: order.orderNumber,
          tableNumber: order.table?.number ?? null,
          orderType: order.type,
          customerName: order.customerName || undefined,
          items: order.orderItems
            .filter(oi => !oi.voided)
            .map(oi => ({
              quantity: oi.quantity,
              name: oi.menuItem.name,
              modifiers: (() => {
                try { return JSON.parse(oi.modifiersJson || '[]') } catch { return [] }
              })(),
              notes: oi.notes || undefined,
              category: oi.menuItem.category?.name,
            })),
          notes: order.notes || undefined,
          timestamp: order.createdAt.toISOString(),
        }
        const printerModel = getPrinterModel(printer.type, printer.name)
        const escposData = generateKitchenOrder(printData, printerModel)
        // Pošlji na tiskalnik
        const result = await sendToPrinter(printer.ipAddress, printer.port, escposData)
        // FIX EP-05 MEDIUM: Vrni pravilen HTTP status glede na uspeh tiska
        if (!result.success) {
          return NextResponse.json({
            printed: false,
            printer: printer.name,
            printerIp: printer.ipAddress,
            error: result.error,
            requiresReprint: true, // Client should offer reprint option
          }, { status: 503 })
        }
        return NextResponse.json({
          printed: true,
          printer: printer.name,
          printerIp: printer.ipAddress,
        })
      }
      case 'receipt': {
        // Zod refine zagotavlja orderId, a TypeScript tega ne ve
        if (!orderId) {
          return NextResponse.json({ error: 'Manjka orderId' }, { status: 400 })
        }
        // Pridobi naročilo in račun
        const order = await db.order.findUnique({
          where: { id: orderId },
          include: {
            table: true,
            orderItems: {
              include: { menuItem: true },
            },
            receipt: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        })
        if (!order) {
          return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
        }
        const receipt = order.receipt[0]
        if (!receipt) {
          return NextResponse.json({ error: 'Račun ni najden' }, { status: 404 })
        }
        // Poišči blagajnski tiskalnik
        const printer = await findPrinter('receipt', printerId)
        if (!printer) {
          return NextResponse.json({ error: 'Noben blagajnski tiskalnik ni na voljo', printed: false })
        }
        // Pridobi nastavitve restavracije
        const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
        // Pripravi podatke za tisk računa
        const vatBreakdown = (() => {
          try { return JSON.parse(receipt.vatBreakdown || '{}') } catch { return {} }
        })()
        const vatEntries: Array<{ rate: number; base: number; vat: number }> = []
        for (const [rate, amounts] of Object.entries(vatBreakdown)) {
          const a = amounts as { base: number; vat: number }
          vatEntries.push({ rate: Number(rate), base: a.base, vat: a.vat })
        }
        const receiptPrintData: ReceiptPrintData = {
          orderNumber: order.orderNumber,
          receiptNumber: receipt.receiptNumber,
          businessName: settings?.name || 'RestaurantOS',
          businessAddress: settings?.address || '',
          businessCity: settings?.city || '',
          businessPostCode: settings?.postCode || '',
          businessPhone: settings?.phone || '',
          businessId: settings?.businessId || '',
          taxId: settings?.taxId || '',
          registerId: settings?.registerNumber || 'BLG-001',
          // FIX BUG-F8 HIGH: premisesId mora biti ID poslovnega prostora (iz Location), NE matična številka
          // FURS zahteva premisesId, ne businessId — ta se uporablja v QR kodi in na tiskanem računu
          premisesId: receipt.registerId || settings?.businessId || '',
          zoi: receipt.zoi,
          eor: receipt.eor,
          isSimulation: !receipt.fiscalVerified,
          items: order.orderItems
            .map(oi => ({
              quantity: oi.quantity,
              name: oi.menuItem.name,
              price: toNum(oi.price),
              vatRate: toNum(oi.vatRate),
              isVoided: oi.voided,
              modifiers: (() => {
                try { return JSON.parse(oi.modifiersJson || '[]') } catch { return [] }
              })(),
            })),
          subtotal: toNum(receipt.subtotal),
          vatBreakdown: vatEntries,
          totalVat: toNum(receipt.totalVat),
          discount: toNum(receipt.discount),
          total: toNum(receipt.total),
          tip: toNum(receipt.tip),
          totalWithTip: toNum(receipt.totalWithTip),
          paymentMethod: receipt.paymentMethod,
          timestamp: receipt.createdAt.toISOString(),
          qrContent: receipt.zoi ? generateFursQRContent({
            zoi: receipt.zoi,
            totalAmount: toNum(receipt.total),
            issueDateTime: receipt.createdAt,
            taxId: settings?.taxId || '',
            businessId: settings?.businessId || '',
            registerId: settings?.registerNumber || 'BLG-001',
            // FIX BUG-F8: Uporabi premisesId iz računa, ne businessId
            premisesId: receipt.registerId || settings?.businessId || '',
          }) : undefined,
          receiptFooter: settings?.receiptFooter || undefined,
          // FIX P04 LOW: Pridobi ime zaposlenega namesto ID-ja za tiskanje na računu
          operatorName: ((authResult.session as unknown) as { employeeName?: string })?.employeeName || authResult.session?.employeeId || undefined,
          tableNumber: order.table?.number ?? null,
          orderType: order.type,
          customerName: order.customerName || undefined,
        }
        const printerModel = getPrinterModel(printer.type, printer.name)
        const escposData = generateReceipt(receiptPrintData, printerModel)
        // Pošlji na tiskalnik
        const result = await sendToPrinter(printer.ipAddress, printer.port, escposData)
        // FIX EP-05 MEDIUM: Vrni pravilen HTTP status glede na uspeh tiska
        if (!result.success) {
          return NextResponse.json({
            printed: false,
            printer: printer.name,
            printerIp: printer.ipAddress,
            error: result.error,
            requiresReprint: true,
          }, { status: 503 })
        }
        return NextResponse.json({
          printed: true,
          printer: printer.name,
          printerIp: printer.ipAddress,
        })
      }
      case 'test': {
        // Poišči katerikoli aktivni tiskalnik
        const printer = await findPrinter('order', printerId)
        if (!printer) {
          return NextResponse.json({ error: 'Noben tiskalnik ni na voljo', printed: false })
        }
        const printerModel = getPrinterModel(printer.type, printer.name)
        const escposData = generateTestPrint(printerModel)
        const result = await sendToPrinter(printer.ipAddress, printer.port, escposData)
        return NextResponse.json({
          printed: result.success,
          printer: printer.name,
          printerIp: printer.ipAddress,
          error: result.error,
        })
      }
      default:
        return NextResponse.json({ error: 'Neznan tip tiskanja' }, { status: 400 })
    }
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/print', 'Napaka pri tiskanju')
  }
}
