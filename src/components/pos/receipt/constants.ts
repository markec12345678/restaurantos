// ============================================
// TIPI (ZDDV-1 skladen račun)
// ============================================

/** Postavka računa z DDV podatki */
export interface ReceiptItem {
  id: string
  name: string
  quantity: number
  unitPrice: number        // Cena brez DDV
  vatRate: number           // DDV stopnja (22, 9.5, 0)
  basePrice: number         // Osnova brez DDV
  vatAmount: number         // Znesek DDV
  totalWithVat: number      // Skupaj z DDV
  modifiers: { name: string; price?: number }[]
  notes: string
  category: string
}

/** DDV razčlenitev po stopnjah */
export interface VatBreakdownItem {
  base: number
  vat: number
  total: number
}

/** Polni podatki računa */
export interface ReceiptData {
  // Glava
  receiptNumber: string
  receiptDate: string
  registerId: string
  // Izdajatelj
  businessName: string
  businessAddress: string
  businessId: string
  taxId: string
  phone: string
  // FURS
  zoi: string
  eor: string
  fiscalVerified: boolean
  // Naročilo
  orderNumber: number
  type: string
  status: string
  paymentStatus: string
  paymentMethod: string
  customerName: string
  table: { number: number; area: string } | null
  notes: string
  createdAt: string
  // Postavke
  items: ReceiptItem[]
  // Zneski
  subtotal: number
  vatBreakdown: Record<string, VatBreakdownItem>
  totalVat: number
  discount: number
  total: number
  tip: number
  totalWithTip: number
  // Meta
  receiptFooter: string
  isCopy: boolean
  isStorno: boolean
  stornoOf: string
}

// ============================================
// OZNAKE IN IKONE
// ============================================

/** Oznake vrst naročila */
export const TYPE_LABELS: Record<string, string> = {
  'dine-in': 'Na mestu',
  'takeout': 'Za s seboj',
  'delivery': 'Dostava',
}

/** Oznake načinov plačila */
export const PAYMENT_LABELS: Record<string, string> = {
  gotovina: 'Gotovina',
  kartica: 'Kartično',
  mobilno: 'Mobilno',
  cash: 'Gotovina',
  card: 'Kartično',
  mobile: 'Mobilno',
}

// ============================================
// PROPS INTERFACES ZA PODKOMPONENTE
// ============================================

/** Props za ActionButtons podkomponento */
export interface ActionButtonsProps {
  isPreview: boolean
  receipt: ReceiptData | null | undefined
  verifying: boolean
  onConfirmAndPrint: () => void
  onPrint: () => void
  onCopy: () => void
  onFiscalVerify: () => void
  onStorno: () => void
  onSendEmail: () => void
  onSendSms: () => void
}

/** Props za ReceiptContent podkomponento */
export interface ReceiptContentProps {
  receipt: ReceiptData
  qrCodeDataUrl: string
}

/** Props za StatusBadges podkomponento */
export interface StatusBadgesProps {
  isPreview: boolean
  receipt: ReceiptData
}
