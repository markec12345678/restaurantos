// Tipi in konfiguracija za izvoz poročil

export type ReportType = 'orders' | 'items' | 'vat' | 'employees' | 'shifts' | 'inventory'

export const ALLOWED_TYPES: ReportType[] = ['orders', 'items', 'vat', 'employees', 'shifts', 'inventory']

export function getFilename(type: ReportType, startDate: string | null, endDate: string | null): string {
  switch (type) {
    case 'orders': return `narocila_${startDate || 'vse'}_${endDate || 'vse'}.csv`
    case 'items': return `artikli_${startDate || 'vse'}_${endDate || 'vse'}.csv`
    case 'vat': return `ddv_${startDate || 'vse'}_${endDate || 'vse'}.csv`
    case 'employees': return `zaposleni_${startDate || 'vse'}_${endDate || 'vse'}.csv`
    case 'shifts': return `izmene_${startDate || 'vse'}_${endDate || 'vse'}.csv`
    case 'inventory': return `zaloga_${new Date().toISOString().split('T')[0]}.csv`
  }
}

// Re-export CSV generators
export { escapeCsvField, toCsvRow } from './csv-utils'
export { generateOrdersCsv, generateItemsCsv, generateVatCsv } from './order-reports'
export { generateEmployeesCsv, generateShiftsCsv, generateInventoryCsv } from './staff-inventory-reports'
