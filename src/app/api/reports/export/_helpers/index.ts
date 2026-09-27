// Tipi in konfiguracija za izvoz poročil
// R146-b (epic #115 #33 Accounting exports): 6 novih računovodskih tipov
// (payments/refunds/purchases/expenses/daily-close/journal) — SAMO CSV
// (reproducibilni knjigovodski format; PDF/Excel/XML za nove tipe = DEFER).

export type ReportType =
  | 'orders' | 'items' | 'vat' | 'employees' | 'shifts' | 'inventory'
  | 'payments' | 'refunds' | 'purchases' | 'expenses' | 'daily-close' | 'journal'
export type ExportFormat = 'csv' | 'pdf' | 'excel' | 'xml' | 'ubl'

export const ALLOWED_TYPES: ReportType[] = [
  'orders', 'items', 'vat', 'employees', 'shifts', 'inventory',
  'payments', 'refunds', 'purchases', 'expenses', 'daily-close', 'journal',
]

/** R146-b: računovodski tipi — izvoz samo v CSV (glej header). */
export const ACCOUNTING_CSV_TYPES: ReportType[] = ['payments', 'refunds', 'purchases', 'expenses', 'daily-close', 'journal']
export const ALLOWED_FORMATS: ExportFormat[] = ['csv', 'pdf', 'excel', 'xml', 'ubl']

export function getFilename(type: ReportType, startDate: string | null, endDate: string | null, format: ExportFormat = 'csv'): string {
  const ext = format === 'excel' ? 'xlsx' : format
  const suffix = `${startDate || 'vse'}_${endDate || 'vse'}.${ext}`
  switch (type) {
    case 'orders': return `narocila_${suffix}`
    case 'items': return `artikli_${suffix}`
    case 'vat': return `ddv_${suffix}`
    case 'employees': return `zaposleni_${suffix}`
    case 'shifts': return `izmene_${suffix}`
    case 'inventory': return `zaloga_${new Date().toISOString().split('T')[0]}.${ext}`
    // R146-b: računovodski izvozi (SL imena, pariteta obstoječih)
    case 'payments': return `placila_${suffix}`
    case 'refunds': return `povracila_${suffix}`
    case 'purchases': return `nabava_${suffix}`
    case 'expenses': return `stroski_${suffix}`
    case 'daily-close': return `dnevni_zakljucek_${suffix}`
    case 'journal': return `dnevnik_${suffix}`
  }
}

// Re-export CSV generators
export { escapeCsvField, toCsvRow } from './csv-utils'
export { generateOrdersCsv, generateItemsCsv, generateVatCsv } from './order-reports'
export { generateEmployeesCsv, generateShiftsCsv, generateInventoryCsv } from './staff-inventory-reports'
// R146-b: računovodski CSV generatorji (reproducibilni, MODEL A scope)
export {
  generatePaymentsCsv, generateRefundsCsv, generatePurchasesCsv,
  generateExpensesCsv, generateDailyCloseCsv, generateJournalCsv,
  countCsvRows,
} from './accounting-reports'

// Re-export PDF/Excel/XML generators + data fetcher
export { fetchReportData, type ReportData } from './report-data'
export { generateReportPdf } from './pdf-generator'
export { generateReportExcel } from './excel-generator'
export { generateEdavkiXml } from './xml-generator'
export { generateUblInvoice } from './ubl-generator'
