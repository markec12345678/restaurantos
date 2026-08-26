import { db } from '@/lib/db'
import { generateKitchenOrder, generateTestPrint, type KitchenOrderPrintData } from '@/lib/escpos'
import { findPrinter, getPrinterModel, sendToPrinter } from './printer-utils'
import { handleReceiptPrint } from './receipt-print'

// ============================================
// PRINT HANDLERS
// ============================================

/** Pripravi podatke in natisne kuhinjsko naročilo */
export async function handleOrderPrint(orderId: string, printerId?: string) {
  if (!orderId) {
    return { error: 'Manjka orderId', status: 400 }
  }
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
    return { error: 'Naročilo ni najdeno', status: 404 }
  }
  const printer = await findPrinter('order', printerId)
  if (!printer) {
    return { error: 'Noben kuhinjski tiskalnik ni na voljo', printed: false }
  }
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
  const result = await sendToPrinter(printer.ipAddress, printer.port, escposData)

  if (!result.success) {
    return { printed: false, printer: printer.name, printerIp: printer.ipAddress, error: result.error, requiresReprint: true, status: 503 }
  }
  return { printed: true, printer: printer.name, printerIp: printer.ipAddress }
}

/** Natisne testno stran */
export async function handleTestPrint(printerId?: string) {
  const printer = await findPrinter('order', printerId)
  if (!printer) {
    return { error: 'Noben tiskalnik ni na voljo', printed: false }
  }
  const printerModel = getPrinterModel(printer.type, printer.name)
  const escposData = generateTestPrint(printerModel)
  const result = await sendToPrinter(printer.ipAddress, printer.port, escposData)
  return { printed: result.success, printer: printer.name, printerIp: printer.ipAddress, error: result.error }
}

// Re-export handleReceiptPrint from separate file
export { handleReceiptPrint }
