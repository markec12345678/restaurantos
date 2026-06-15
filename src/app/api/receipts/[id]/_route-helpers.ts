// Pomožne funkcije za GET/POST računov
// GET /api/receipts/[id] — pomožni modul za gradnjo računov

import { toNum } from '@/lib/decimal'
import { buildReceiptItems, buildVatBreakdown, generateZOIPlaceholder, DEFAULT_SETTINGS } from './_helpers'

// ─── Tipi ───
interface OrderForGetReceipt {
  id: string
  orderNumber: number
  type: string
  status: string
  paymentStatus: string
  paymentMethod: string | null
  customerName: string | null
  notes: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  discount: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tip: any
  createdAt: Date
  table: { number: number; area: string | null } | null
  orderItems: Parameters<typeof buildReceiptItems>[0]
}

interface ExistingReceipt {
  receiptNumber?: string
  createdAt?: Date
  zoi?: string
  eor?: string
  fiscalVerified?: boolean
  isCopy?: boolean
  isStorno?: boolean
  stornoOf?: string
}

// ─── Zgradi podatke za GET predogled računa ───
export function buildReceiptPreview(
  order: OrderForGetReceipt,
  settings: typeof DEFAULT_SETTINGS | null,
  existingReceipt: ExistingReceipt | null,
) {
  const s = settings || DEFAULT_SETTINGS

  const receiptItems = buildReceiptItems(order.orderItems)
  const vatBreakdown = buildVatBreakdown(receiptItems)

  const subtotal = receiptItems.reduce((sum, item) => sum + item.basePrice, 0)
  const totalVat = receiptItems.reduce((sum, item) => sum + item.vatAmount, 0)
  const discount = toNum(order.discount)
  const total = subtotal + totalVat - discount
  const tip = toNum(order.tip)
  const totalWithTip = total + tip

  const receiptNumber = existingReceipt?.receiptNumber || ''
  const zoi = existingReceipt?.zoi || generateZOIPlaceholder(order.orderNumber, receiptNumber || 'pending')

  return {
    receiptNumber,
    receiptDate: existingReceipt?.createdAt?.toISOString() || new Date().toISOString(),
    registerId: s.registerNumber || 'BLG-001',
    businessName: s.name,
    businessAddress: `${s.address}, ${s.postCode} ${s.city}`,
    businessId: s.businessId,
    taxId: s.taxId,
    phone: s.phone,
    zoi,
    eor: existingReceipt?.eor || '',
    fiscalVerified: existingReceipt?.fiscalVerified || false,
    orderNumber: order.orderNumber,
    type: order.type,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    customerName: order.customerName,
    table: order.table ? { number: order.table.number, area: order.table.area } : null,
    notes: order.notes,
    createdAt: order.createdAt,
    items: receiptItems,
    subtotal: Math.round(subtotal * 100) / 100,
    vatBreakdown: Object.fromEntries(
      Object.entries(vatBreakdown).map(([rate, data]) => [
        rate,
        {
          base: Math.round(data.base * 100) / 100,
          vat: Math.round(data.vat * 100) / 100,
          total: Math.round(data.total * 100) / 100,
        },
      ])
    ),
    totalVat: Math.round(totalVat * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    total: Math.round(total * 100) / 100,
    tip: Math.round(tip * 100) / 100,
    totalWithTip: Math.round(totalWithTip * 100) / 100,
    receiptFooter: s.receiptFooter || '',
    isCopy: existingReceipt?.isCopy || false,
    isStorno: existingReceipt?.isStorno || false,
    stornoOf: existingReceipt?.stornoOf || '',
  }
}
