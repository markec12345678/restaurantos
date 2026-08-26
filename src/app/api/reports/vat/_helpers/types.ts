// Tipi za DDV poročilo

export interface VatRateEntry {
  rate: number
  label: string
  code: string // FURS koda: S=standard, R=znižana, Z=oproščeno
  baseAmount: number
  vatAmount: number
  totalAmount: number
  itemCount: number
  orderCount: number
  items: Record<string, { name: string; category: string; quantity: number; base: number; vat: number }>
}

export interface TimeVatEntry {
  period: string
  base22: number
  vat22: number
  base95: number
  vat95: number
  base0: number
  vat0: number
  totalBase: number
  totalVat: number
}
