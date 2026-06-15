import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import type { PrinterModel } from '@/lib/escpos'
import { generateKitchenOrder, generateReceipt, generateTestPrint, type KitchenOrderPrintData, type ReceiptPrintData } from '@/lib/escpos'
import { generateFursQRContent } from '@/lib/furs'
import { z } from 'zod'
import * as net from 'net'

// ============================================
// Print API helpers — extracted from route.ts
// ============================================

/** Zod validation schema for print requests */
export const printRequestSchema = z.object({
  type: z.enum(['order', 'receipt', 'test'], { message: 'Tip tiskanja mora biti order, receipt ali test' }),
  orderId: z.string().min(1, 'ID naročila je obvezen').max(100, 'ID naročila ne sme preseči 100 znakov').optional(),
  printerId: z.string().min(1, 'ID tiskalnika je obvezen').max(100, 'ID tiskalnika ne sme preseči 100 znakov').optional(),
}).refine(data => {
  // orderId je obvezen za order in receipt tip
  if ((data.type === 'order' || data.type === 'receipt') && !data.orderId) return false
  return true
}, { message: 'orderId je obvezen za tip order in receipt', path: ['orderId'] })

/**
 * Pošlji ESC/POS podatke na tiskalnik preko TCP/IP povezave
 * FIX EP-03 HIGH: Dodan retry mehanizem (3 poskusi) za izgubljene tiskalne posle
 */
export function sendToPrinter(ipAddress: string, port: number, data: Buffer, maxRetries = 3): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!ipAddress) {
      resolve({ success: false, error: 'IP naslov tiskalnika ni nastavljen' })
      return
    }
    let attempts = 0
    const attempt = () => {
      attempts++
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
        if (attempts < maxRetries) {
          setTimeout(attempt, 1000) // Počakaj 1 sekundo pred ponovnim poskusom
        } else {
          resolve({ success: false, error: `Timeout pri povezavi s tiskalnikom ${ipAddress}:${port} (${maxRetries} poskusov)` })
        }
      })
      socket.on('error', (err) => {
        socket.destroy()
        if (attempts < maxRetries) {
          setTimeout(attempt, 1000)
        } else {
          resolve({ success: false, error: `Napaka pri povezavi s tiskalnikom: ${err.message} (${maxRetries} poskusov)` })
        }
      })
      socket.connect(port, ipAddress)
    }
    attempt()
  })
}

/**
 * Določi model tiskalnika glede na tip iz baze
 */
export function getPrinterModel(printerType: string, printerName: string): PrinterModel {
  const nameLower = printerName.toLowerCase()
  // Star SP700 je impact (dot-matrix) tiskalnik
  if (printerType === 'dot-matrix' || nameLower.includes('star') || nameLower.includes('sp700')) {
    return 'star'
  }
  // Epson TM-T88VI in ostali termični
  return 'epson'
}

/** Printer info returned by findPrinter */
export interface PrinterInfo {
  id: string
  name: string
  ipAddress: string
  type: string
  port: number
}

/**
 * Poišči ustrezen tiskalnik glede na pravila tiskanja
 */
export async function findPrinter(type: 'order' | 'receipt', printerId?: string): Promise<PrinterInfo | null> {
  // FIX EP5 MEDIUM: Podpora za konfigurabilni port — prejšnja koda je hardcodirala 9100
  // Nekateri tiskalniki uporabljajo 9101, 515 (LPD), ali druge porte
  const _parsePort = (p: string | number | null | undefined, fallback = 9100): number => {
    if (typeof p === 'number') return p
    if (typeof p === 'string' && p) {
      const n = parseInt(p, 10)
      if (!isNaN(n) && n > 0 && n <= 65535) return n
    }
    return fallback
  }
  // Če je podan specifičen printerId
  if (printerId) {
    const printer = await db.printer.findUnique({ where: { id: printerId } })
    if (printer && printer.isActive && printer.ipAddress) {
      // FIX EP5: Preberi port iz printRules če je podan, sicer default 9100
      let customPort: number | undefined
      try {
        const rules = JSON.parse(printer.printRules || '[]') as Array<{ port?: number }>
        if (rules.length > 0 && rules[0].port) customPort = rules[0].port
      } catch { /* invalid JSON */ }
      return {
        id: printer.id,
        name: printer.name,
        ipAddress: printer.ipAddress,
        type: printer.type,
        port: customPort || 9100,
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
      const rules = JSON.parse(printer.printRules || '[]') as Array<{ type: string; prepStationId?: string; port?: number }>
      const hasMatchingRule = rules.some((rule) => {
        if (type === 'order' && rule.type === 'order') return true
        if (type === 'receipt' && rule.type === 'receipt') return true
        return false
      })
      if (hasMatchingRule) {
        const customPort = rules.find(r => r.port)?.port
        return {
          id: printer.id,
          name: printer.name,
          ipAddress: printer.ipAddress,
          type: printer.type,
          port: customPort || 9100,
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

// ============================================
// PRINT HANDLERS — extracted from route.ts
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
  const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })

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
      premisesId: receipt.registerId || settings?.businessId || '',
    }) : undefined,
    receiptFooter: settings?.receiptFooter || undefined,
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
