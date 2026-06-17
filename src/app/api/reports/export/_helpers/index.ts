// Tipi in konfiguracija za izvoz poročil

export type ReportType = 'orders' | 'items' | 'vat' | 'employees' | 'shifts' | 'inventory'
export type ExportFormat = 'csv' | 'pdf' | 'excel' | 'xml'

export const ALLOWED_TYPES: ReportType[] = ['orders', 'items', 'vat', 'employees', 'shifts', 'inventory']
export const ALLOWED_FORMATS: ExportFormat[] = ['csv', 'pdf', 'excel', 'xml']

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
  }
}

// Re-export CSV generators
export { escapeCsvField, toCsvRow } from './csv-utils'
export { generateOrdersCsv, generateItemsCsv, generateVatCsv } from './order-reports'
export { generateEmployeesCsv, generateShiftsCsv, generateInventoryCsv } from './staff-inventory-reports'

// Re-export PDF/Excel/XML generators + data fetcher
export { fetchReportData, type ReportData } from './report-data'
export { generateReportPdf } from './pdf-generator'
export { generateReportExcel } from './excel-generator'
export { generateEdavkiXml } from './xml-generator'
