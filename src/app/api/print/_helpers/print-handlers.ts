import { db } from '@/lib/db'
import { generateKitchenOrder, generateTestPrint, type KitchenOrderPrintData } from '@/lib/escpos'
import { findPrinter, findPrintersByRule, getPrinterModel, sendToPrinter, type PrinterInfo } from './printer-utils'
import { handleReceiptPrint } from './receipt-print'
import { parseOrderItemModifiers } from '@/lib/json-fields'

// ============================================
// PRINT HANDLERS
// ============================================

interface OrderPrintItem {
  quantity: number
  name: string
  modifiers: ReturnType<typeof parseOrderItemModifiers>
  notes: string | undefined
  category: string | undefined
}

/** P2-UX FIX (tiskanje na različnih printerjih): natisni en niz artiklov
 *  na enega ali več tiskalnikov in vrni agregatni rezultat. */
async function printToPrinters(
  printers: PrinterInfo[],
  header: { orderNumber: number; tableNumber: number | null; orderType: string; customerName?: string; notes?: string; timestamp: string; stationName?: string },
  items: OrderPrintItem[],
): Promise<{ printed: number; results: { printer: string; printerIp: string; success: boolean; error?: string }[] }> {
  const results: { printer: string; printerIp: string; success: boolean; error?: string }[] = []
  const printData: KitchenOrderPrintData = {
    orderNumber: header.orderNumber,
    tableNumber: header.tableNumber,
    orderType: header.orderType,
    customerName: header.customerName,
    notes: header.notes,
    items,
    timestamp: header.timestamp,
    stationName: header.stationName,
  }
  for (const printer of printers) {
    const printerModel = getPrinterModel(printer.type, printer.name)
    const escposData = generateKitchenOrder(printData, printerModel)
    const result = await sendToPrinter(printer.ipAddress, printer.port, escposData)
    results.push({ printer: printer.name, printerIp: printer.ipAddress, success: result.success, error: result.error })
  }
  return { printed: results.filter(r => r.success).length, results }
}

/** Pripravi podatke in natisne kuhinjsko naročilo.
 *
 *  P2-UX FIX (tiskanje na različnih printerjih): prej je CELO naročilo šlo na
 *  PRVI tiskalnik z 'order' pravilom — postaje (kuhinja/bar/slanina...) niso
 *  imele svojih izpisov. Zdaj:
 *    1. eksplicitni printerId → celotno naročilo na ta tiskalnik (nazaj združljivo)
 *    2. sicer: artikli se združijo po menuItem.prepStationId in vsaka postaja
 *       dobi SVOJ izpis na tiskalnike z 'prepStationOrder' pravilom
 *       (splošno pravilo brez prepStationId = sprejema vse postaje)
 *    3. artikli brez postaje (ali postaja brez svojega tiskalnika) gredo na
 *       splošne 'order' tiskalnike
 *    4. fallback: prvi aktivni tiskalnik (kot prej)
 */
export async function handleOrderPrint(orderId: string, printerId?: string) {
  if (!orderId) {
    return { error: 'Manjka orderId', status: 400 }
  }
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      table: true,
      orderItems: {
        include: { menuItem: { include: { category: true, prepStation: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!order) {
    return { error: 'Naročilo ni najdeno', status: 404 }
  }

  const header = {
    orderNumber: order.orderNumber,
    tableNumber: order.table?.number ?? null,
    orderType: order.type,
    customerName: order.customerName || undefined,
    notes: order.notes || undefined,
    timestamp: order.createdAt.toISOString(),
  }

  const toPrintItem = (oi: (typeof order.orderItems)[number]): OrderPrintItem => ({
    quantity: oi.quantity,
    name: oi.menuItem.name,
    modifiers: parseOrderItemModifiers(oi.modifiersJson),
    notes: oi.notes || undefined,
    category: oi.menuItem.category?.name,
  })

  const activeItems = order.orderItems.filter(oi => !oi.voided)

  // 1. Eksplicitni tiskalnik → celotno naročilo tja (nazaj združljivo)
  if (printerId) {
    const printer = await findPrinter('order', printerId)
    if (!printer) {
      return { error: 'Tiskalnik ni na voljo', printed: false }
    }
    const { printed, results } = await printToPrinters([printer], header, activeItems.map(toPrintItem))
    if (printed === 0) {
      return { printed: false, printer: printer.name, printerIp: printer.ipAddress, error: results[0]?.error, requiresReprint: true, status: 503 }
    }
    return { printed: true, printer: printer.name, printerIp: printer.ipAddress }
  }

  // 2. Fan-out: združi artikle po pripravljalni postaji
  const stationGroups = new Map<string, { stationName?: string; items: OrderPrintItem[] }>()
  const unstationedItems: OrderPrintItem[] = []
  for (const oi of activeItems) {
    const stationId = oi.menuItem.prepStationId
    if (!stationId) {
      unstationedItems.push(toPrintItem(oi))
      continue
    }
    const group = stationGroups.get(stationId) || { stationName: oi.menuItem.prepStation?.name, items: [] }
    group.items.push(toPrintItem(oi))
    stationGroups.set(stationId, group)
  }

  const stationPrinters = await findPrintersByRule(r => r.type === 'prepStationOrder')
  const orderPrinters = await findPrintersByRule(r => r.type === 'order')

  const allResults: { printer: string; printerIp: string; success: boolean; error?: string }[] = []

  // 3. Postaje s svojimi tiskalniki
  for (const [stationId, group] of stationGroups) {
    // Specifični tiskalnik za to postajo (pravilo vsebuje prepStationId)
    // ali splošni prepStationOrder tiskalnik (pravilo brez prepStationId = vse postaje)
    const specific = await findPrintersByRule(r => r.type === 'prepStationOrder' && r.prepStationId === stationId)
    const printersForStation = specific.length > 0 ? specific : stationPrinters
    if (printersForStation.length === 0) {
      // postaja nima svojega tiskalnika → artikli gredo med "brez postaje"
      unstationedItems.push(...group.items)
      continue
    }
    const { results } = await printToPrinters(printersForStation, { ...header, stationName: group.stationName }, group.items)
    allResults.push(...results)
  }

  // 4. Artikli brez postaje + postaje brez tiskalnika → splošni 'order' tiskalniki
  let genericPrinters = orderPrinters
  if (genericPrinters.length === 0 && unstationedItems.length > 0) {
    // fallback: prvi aktivni tiskalnik (kot prej)
    const fallback = await findPrinter('order')
    genericPrinters = fallback ? [fallback] : []
  }
  if (unstationedItems.length > 0 && genericPrinters.length > 0) {
    const { results } = await printToPrinters(genericPrinters, header, unstationedItems)
    allResults.push(...results)
  }

  if (allResults.length === 0) {
    return { error: 'Noben kuhinjski tiskalnik ni na voljo', printed: false }
  }

  const failures = allResults.filter(r => !r.success)
  const printerNames = [...new Set(allResults.filter(r => r.success).map(r => r.printer))]
  if (failures.length === allResults.length) {
    return { printed: false, printer: failures[0]?.printer, printerIp: failures[0]?.printerIp, error: failures[0]?.error, requiresReprint: true, status: 503 }
  }
  return {
    printed: true,
    printers: printerNames,
    printer: printerNames[0],
    printerIp: allResults.find(r => r.success)?.printerIp,
    failed: failures.length > 0 ? failures.map(f => `${f.printer}: ${f.error}`) : undefined,
  }
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
