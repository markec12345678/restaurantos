// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Tipi za digitalni račun
// ═══════════════════════════════════════════════════════════════

/** Postavka računa z DDV in modifikatorji */
export interface ReceiptItem {
  name: string
  quantity: number
  price: number
  vatRate: number
  isVoided: boolean
  modifiers: Array<{ name: string; price: number }>
}

/** DDV razčlenitev po stopnjah */
export interface VatBreakdown {
  rate: number
  base: number
  vat: number
}

/** Polni podatki digitalnega računa */
export interface ReceiptData {
  id: string
  receiptNumber: string
  businessName: string
  businessAddress: string
  businessCity: string
  businessPostCode: string
  businessPhone: string
  businessId: string
  taxId: string
  registerId: string
  zoi: string
  eor: string
  fiscalVerified: boolean
  isStorno: boolean
  items: ReceiptItem[]
  subtotal: number
  vatBreakdown: VatBreakdown[]
  totalVat: number
  discount: number
  total: number
  tip: number
  totalWithTip: number
  paymentMethod: string
  createdAt: string
  qrContent: string
  receiptFooter: string
  tableNumber: number | null
  orderType: string
}
