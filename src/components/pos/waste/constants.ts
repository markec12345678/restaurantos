// ============================================
// TIPI IN KONSTANTE ZA WASTE TRACKER
// ============================================

interface WasteEntry {
  id: string
  itemName: string
  category: string
  quantity: number
  unit: string
  costPerUnit: number
  totalCost: number
  reason: 'spoilage' | 'overproduction' | 'expired' | 'customer_reject' | 'prep_waste' | 'other'
  date: string
  recordedBy: string | null
  notes: string | null
}

interface WasteSummary {
  totalWasteCost: number
  totalWasteItems: number
  topWasteItems: { name: string; cost: number; percentage: number }[]
  wasteByReason: { reason: string; cost: number; count: number; percentage: number }[]
  wasteByCategory: { category: string; cost: number; count: number }[]
  dailyWaste: { date: string; cost: number; items: number }[]
  wasteTarget: number // percent of COGS
  currentWasteRate: number // percent of COGS
  foodCostPercentage: number
}

export type { WasteEntry, WasteSummary }

export const REASON_TYPES = ['spoilage', 'overproduction', 'expired', 'customer_reject', 'prep_waste', 'other'] as const
export const WASTE_CATEGORIES = ['Meso', 'Zelenjava', 'Mlečni izdelki', 'Pekovsko', 'Ribe', 'Sadje', 'Ostalo'] as const
export const WASTE_UNITS = ['kg', 'litrov', 'kosov'] as const

export const REASON_LABELS: Record<string, string> = {
  spoilage: 'Pokvarjeno',
  overproduction: 'Prekomerna proizvodnja',
  expired: 'Potekel rok',
  customer_reject: 'Zavrnjeno s stranke',
  prep_waste: 'Odp. pri pripravi',
  other: 'Ostalo',
}

export const PERIOD_LABELS: Record<string, string> = {
  week: 'Teden',
  month: 'Mesec',
  quarter: 'Četrtletje',
}

export const SAMPLE_ITEMS = [
  { name: 'Zelena solata', cat: 'Zelenjava', unit: 'kg', cost: 3.20 },
  { name: 'Mleko', cat: 'Mlečni izdelki', unit: 'litrov', cost: 1.80 },
  { name: 'Kruh', cat: 'Pekovsko', unit: 'kosov', cost: 2.50 },
  { name: 'Poper', cat: 'Ostalo', unit: 'kg', cost: 12.00 },
  { name: 'Losos', cat: 'Ribe', unit: 'kg', cost: 18.50 },
  { name: 'Paradižnik', cat: 'Zelenjava', unit: 'kg', cost: 2.80 },
  { name: 'Smetana', cat: 'Mlečni izdelki', unit: 'litrov', cost: 4.20 },
  { name: 'Piščanec', cat: 'Meso', unit: 'kg', cost: 8.50 },
]

/** Format valuta v EUR (slovensko) */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(amount)
}

/** Props za WasteHeader */
export interface WasteHeaderProps {
  period: 'week' | 'month' | 'quarter'
  onPeriodChange: (_period: 'week' | 'month' | 'quarter') => void
}

/** Props za WasteKpiCards */
export interface WasteKpiCardsProps {
  summary: WasteSummary
  isOnTarget: boolean
  formatCurrency: (_amount: number) => string
}

/** Props za WasteByReasonTab */
export interface WasteByReasonTabProps {
  summary: WasteSummary
  formatCurrency: (_amount: number) => string
}

/** Props za WasteByItemTab */
export interface WasteByItemTabProps {
  summary: WasteSummary
  formatCurrency: (_amount: number) => string
}

/** Props za WasteByCategoryTab */
export interface WasteByCategoryTabProps {
  summary: WasteSummary
  formatCurrency: (_amount: number) => string
}

/** Props za WasteLogTab */
export interface WasteLogTabProps {
  entries: WasteEntry[]
  formatCurrency: (_amount: number) => string
}
