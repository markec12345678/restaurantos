import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createESCPOSBuilder, generateKitchenOrder, generateReceipt, generateTestPrint, type KitchenOrderPrintData, type ReceiptPrintData, type PrinterModel } from '@/lib/escpos'
import { generateFursQRContent } from '@/lib/furs'
import * as net from 'net'

// ============================================
// POST /api/print — Tiskanje na omrežni tiskalnik (ESC/POS over TCP/IP)
// ============================================

interface PrintRequest {
  type: 'order' | 'receipt' | 'test'
  orderId?: string
  printerId?: string
}

/**
 * Pošlji ESC/POS podatke na tiskalnik preko TCP/IP povezave
 */
function sendToPrinter(ipAddress: string, port: number, data: Buffer): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!ipAddress) {
      resolve({ success: false, error: 'IP naslov tiskalnika ni nastavljen' })
      return
    }

    const socket = new net.Socket()
    const timeout = 10000 // 10 sekund timeout

    socket.setTimeout(timeout)

    socket.on('connect', () => {
      socket.write(data)
      socket.end()
    })

    socket.on('close', () => {
      resolve({ success: true })
    })

    socket.on('timeout', () => {
      socket.destroy()
      resolve({ success: false, error: `Timeout pri povezavi s tiskalnikom ${ipAddress}:${port}` })
    })

    socket.on('error', (err) => {
      resolve({ success: false, error: `Napaka pri povezavi s tiskalnikom: ${err.message}` })
    })

    socket.connect(port, ipAddress)
  })
}

/**
 * Določi model tiskalnika glede na tip iz baze
 */
function getPrinterModel(printerType: string, printerName: string): PrinterModel {
  const nameLower = printerName.toLowerCase()
  // Star SP700 je impact (dot-matrix) tiskalnik
  if (printerType === 'dot-matrix' || nameLower.includes('star') || nameLower.includes('sp700')) {
    return 'star'
  }
  // Epson TM-T88VI in ostali termični
  return 'epson'
}

/**
 * Poišči ustrezen tiskalnik glede na pravila tiskanja
 */
async function findPrinter(type: 'order' | 'receipt', printerId?: string): Promise<{
  id: string
  name: string
  ipAddress: string
  type: string
  port: number
} | null> {
  // Če je podan specifičen printerId
  if (printerId) {
    const printer = await db.printer.findUnique({ where: { id: printerId } })
    if (printer && printer.isActive && printer.ipAddress) {
      return {
        id: printer.id,
        name: printer.name,
        ipAddress: printer.ipAddress,
        type: printer.type,
        port: 9100, // Standard ESC/POS port
      }
    }
    return null
  }

  // Samodejno izberi tiskalnik glede na printRules
  const printers = await db.printer.findMany({
    where: { isActive: true, ipAddress: { not: '' } },
    orderBy: { sortOrder: 'asc' },
  })

  for (const printer of printers) {
    try {
      const rules = JSON.parse(printer.printRules || '[]') as Array<{ type: string; prepStationId?: string }>
      const hasMatchingRule = rules.some((rule) => {
        if (type === 'order' && rule.type === 'order') return true
        if (type === 'receipt' && rule.type === 'receipt') return true
        return false
      })
      if (hasMatchingRule) {
        return {
          id: printer.id,
          name: printer.name,
          ipAddress: printer.ipAddress,
          type: printer.type,
          port: 9100,
        }
      }
    } catch {
      // Napačen JSON v printRules — preskoči
    }
  }

  // Fallback: uporabi prvi aktivni tiskalnik
  if (printers.length > 0) {
    return {
      id: printers[0].id,
      name: printers[0].name,
      ipAddress: printers[0].ipAddress,
      type: printers[0].type,
      port: 9100,
    }
  }

  return null
}

export async function POST(req: Request) {
  // FIX C-07: Zahtevaj avtentikacijo za tiskanje
  const authResult = await requireAuth(req, { permission: 'take_orders' })
  if (authResult.error) return authResult.error

  const body: PrintRequest = await req.json()
  const { type, orderId, printerId } = body

  try {
    switch (type) {
      case 'order': {
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

        return NextResponse.json({
          printed: result.success,
          printer: printer.name,
          printerIp: printer.ipAddress,
          error: result.error,
        })
      }

      case 'receipt': {
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
          vatEntries.push({ rate: parseFloat(rate), base: a.base, vat: a.vat })
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
          premisesId: settings?.businessId || '',
          zoi: receipt.zoi,
          eor: receipt.eor,
          isSimulation: !receipt.fiscalVerified,
          items: order.orderItems
            .map(oi => ({
              quantity: oi.quantity,
              name: oi.menuItem.name,
              price: oi.price,
              vatRate: oi.vatRate,
              isVoided: oi.voided,
              modifiers: (() => {
                try { return JSON.parse(oi.modifiersJson || '[]') } catch { return [] }
              })(),
            })),
          subtotal: receipt.subtotal,
          vatBreakdown: vatEntries,
          totalVat: receipt.totalVat,
          discount: receipt.discount,
          total: receipt.total,
          tip: receipt.tip,
          totalWithTip: receipt.totalWithTip,
          paymentMethod: receipt.paymentMethod,
          timestamp: receipt.createdAt.toISOString(),
          qrContent: receipt.zoi ? generateFursQRContent({
            zoi: receipt.zoi,
            totalAmount: receipt.total,
            issueDateTime: receipt.createdAt,
            taxId: settings?.taxId || '',
            businessId: settings?.businessId || '',
            registerId: settings?.registerNumber || 'BLG-001',
            premisesId: settings?.businessId || '',
          }) : undefined,
          receiptFooter: settings?.receiptFooter || undefined,
          operatorName: authResult.session?.employeeId || undefined,
          tableNumber: order.table?.number ?? null,
          orderType: order.type,
          customerName: order.customerName || undefined,
        }

        const printerModel = getPrinterModel(printer.type, printer.name)
        const escposData = generateReceipt(receiptPrintData, printerModel)

        // Pošlji na tiskalnik
        const result = await sendToPrinter(printer.ipAddress, printer.port, escposData)

        return NextResponse.json({
          printed: result.success,
          printer: printer.name,
          printerIp: printer.ipAddress,
          error: result.error,
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
  } catch (err) {
    console.error('[Print API] Napaka:', err)
    return NextResponse.json({
      error: 'Napaka pri tiskanju',
      details: err instanceof Error ? err.message : 'Neznana napaka',
    }, { status: 500 })
  }
}
