// ============================================
// ESC/POS TIPI IN VMESNIKI
// ============================================

// ============================================
// UKAZNI GRADILNIK — EPSON TM-T88VI (standardni ESC/POS)
// ============================================

export interface ESCPOSBuilder {
  commands: string[]
  init: () => ESCPOSBuilder
  bold: (_on?: boolean) => ESCPOSBuilder
  center: () => ESCPOSBuilder
  left: () => ESCPOSBuilder
  right: () => ESCPOSBuilder
  text: (_t: string) => ESCPOSBuilder
  lineFeed: (_n?: number) => ESCPOSBuilder
  separator: (_char?: string) => ESCPOSBuilder
  cut: (_partial?: boolean) => ESCPOSBuilder
  openCashDrawer: () => ESCPOSBuilder
  largeText: () => ESCPOSBuilder
  smallText: () => ESCPOSBuilder
  normalText: () => ESCPOSBuilder
  underline: (_on?: boolean) => ESCPOSBuilder
  inverted: (_on?: boolean) => ESCPOSBuilder
  tab: () => ESCPOSBuilder
  build: () => Buffer
}

export type PrinterModel = 'epson' | 'star'

export interface KitchenOrderPrintData {
  orderNumber: number
  tableNumber?: number | null
  orderType: string
  customerName?: string
  items: Array<{
    quantity: number
    name: string
    modifiers?: Array<{ name: string }>
    notes?: string
    category?: string
  }>
  notes?: string
  timestamp: string
  stationName?: string
}

export interface ReceiptPrintData {
  orderNumber: number
  receiptNumber?: string      // R-YYYY-NNNNNN format
  businessName: string
  businessAddress: string
  businessCity?: string
  businessPostCode?: string
  businessPhone?: string
  businessId: string
  taxId: string
  registerId: string
  premisesId?: string
  zoi: string
  eor: string
  isSimulation?: boolean     // FURS simulacija opozorilo
  items: Array<{
    quantity: number
    name: string
    price: number             // Cena brez DDV na enoto
    vatRate: number
    isVoided?: boolean
    modifiers?: Array<{ name: string; price: number }>
  }>
  subtotal: number
  vatBreakdown: Array<{ rate: number; base: number; vat: number }>
  totalVat: number
  discount: number
  discountName?: string
  total: number
  tip: number
  totalWithTip: number
  paymentMethod: string
  timestamp: string
  qrContent?: string         // FURS QR koda vsebina
  receiptFooter?: string
  operatorName?: string      // Ime blagajnika
  tableNumber?: number | null
  orderType?: string         // dine-in, takeout, delivery
  customerName?: string
}
