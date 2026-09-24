import { formatEUR } from '@/lib/safe-format'
import { WASTE_REASONS, WASTE_REASON_LABELS } from '@/lib/waste-reasons'
// ============================================
// TIPI IN KONSTANTE ZA WASTE TRACKER (epic #115 §3, runda 119)
// ============================================
// R119: podatki prihajajo iz NAMENSKEGA waste ledgerja (/api/waste →
// WasteRecord + StockTransaction 'write-off'). Fabricirane vzorčne vrstice
// (SAMPLE_ITEMS), modulo razporeditev razlogov in trdo kodirane metrike so
// odstranjene — KPI zdaj pokaže MERLJIVO resnico iz ledgerja.

/** En vnos waste ledgerja (odraz WasteRecord + povezane StockTransaction). */
export interface WasteEntry {
  id: string
  inventoryItemId: string
  itemName: string
  category: string
  quantity: number
  unit: string
  costPerUnit: number
  totalCost: number
  reason: string
  reasonLabel: string
  note: string
  date: string
  recordedBy: string | null
  reversedAt: string | null
  stockTransactionId: string | null
}

export interface WasteSummary {
  totalWasteCost: number
  totalWasteItems: number
  topWasteItems: { name: string; cost: number; percentage: number }[]
  wasteByReason: { reason: string; cost: number; count: number; percentage: number }[]
  wasteByCategory: { category: string; cost: number; count: number }[]
  dailyWaste: { date: string; cost: number; items: number }[]
  currentWasteRate: number // odpad / COGS iz StockTransaction('sale') istega obdobja
  foodCostPercentage: number // COGS / prihodek (plačani naročila) istega obdobja
  saleCogs: number
  revenue: number
  count: number
  reversedCount: number
}

export { WASTE_REASONS, WASTE_REASON_LABELS }
export type { WasteReason } from '@/lib/waste-reasons'

export const PERIOD_LABELS: Record<string, string> = {
  week: 'Teden',
  month: 'Mesec',
  quarter: 'Četrtletje',
}

/** Format valuta v EUR (slovensko) */
// R38: kanonični formatEUR — determinističen čez ICU build-e (small-ICU Node nima sl-SI podatkov)
export const formatCurrency = formatEUR

/** Props za WasteHeader */
export interface WasteHeaderProps {
  period: 'week' | 'month' | 'quarter'
  onPeriodChange: (_period: 'week' | 'month' | 'quarter') => void
  onRecorded: () => void
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
  onReversed: () => void
}
