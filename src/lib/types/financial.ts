// --- Finance in poročila ---

/** Strošek / Izdatek */
export interface ExpenseRow {
  id: string
  category: string
  amount: number
  date: string
  description?: string
  supplierId?: string
  [key: string]: unknown
}

/** Z-report */
export interface ZReportRow {
  id: string
  date: string
  createdAt?: string
  totalRevenue: number
  totalOrders: number
  payments?: Record<string, number>
  [key: string]: unknown
}

/** Cenovna skupina */
export interface PriceGroupRow {
  id: string
  name: string
  markup?: number
  [key: string]: unknown
}

/** Faktura / Invoice */
export interface InvoiceRow {
  id: string
  number?: string
  invoiceNumber?: string
  amount?: number
  totalAmount?: number
  date: string
  periodStart?: string
  periodEnd?: string
  dueDate?: string
  status: string
  [key: string]: unknown
}
