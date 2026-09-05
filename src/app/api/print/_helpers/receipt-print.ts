// Tiskanje računa — handleReceiptPrint

import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { generateReceipt, type ReceiptPrintData } from '@/lib/escpos'
import { generateFursQRContent } from '@/lib/furs'
import { findPrinter, getPrinterModel, sendToPrinter } from './printer-utils'
import { getRestaurantInfoForLocation } from '@/lib/furs/config-resolver'

/** Pripravi podatke in natisne račun */
export async function handleReceiptPrint(orderId: string, printerId: string | undefined, authSession: { employeeId?: string; employeeName?: string } | null) {
  if (!orderId) {
    return { error: 'Manjka orderId', status: 400 }
  }
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
    return { error: 'Naročilo ni najdeno', status: 404 }
  }
  const receipt = order.receipt[0]
  if (!receipt) {
    return { error: 'Račun ni najden', status: 404 }
  }
  const printer = await findPrinter('receipt', printerId)
  if (!printer) {
    return { error: 'Noben blagajnski tiskalnik ni na voljo', printed: false }
  }
  // FIX P0-C3A: Pridobi poslovne podatke iz Location (vezano na order.locationId)
  // Prej: settings.findFirst({isActive:true}) — globalno, v multi-tenant napačna lokacija
  const info = await getRestaurantInfoForLocation(order.locationId)

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
    businessName: info.name || 'RestaurantOS',
    businessAddress: info.address || '',
    businessCity: info.city || '',
    businessPostCode: info.postCode || '',
    businessPhone: info.phone || '',
    businessId: info.businessId || '',
    taxId: info.taxId || '',
    registerId: info.registerNumber || 'BLG-001',
    premisesId: receipt.registerId || info.businessId || '',
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
      taxId: info.taxId || '',
      businessId: info.businessId || '',
      registerId: info.registerNumber || 'BLG-001',
      premisesId: receipt.registerId || info.businessId || '',
    }) : undefined,
    receiptFooter: undefined,
    operatorName: ((authSession as unknown) as { employeeName?: string })?.employeeName || authSession?.employeeId || undefined,
    tableNumber: order.table?.number ?? null,
    orderType: order.type,
    customerName: order.customerName || undefined,
  }
  const printerModel = getPrinterModel(printer.type, printer.name)
  const escposData = generateReceipt(receiptPrintData, printerModel)
  const result = await sendToPrinter(printer.ipAddress, printer.port, escposData)

  if (!result.success) {
    return { printed: false, printer: printer.name, printerIp: printer.ipAddress, error: result.error, requiresReprint: true, status: 503 }
  }
  return { printed: true, printer: printer.name, printerIp: printer.ipAddress }
}
