// ============================================
// AI PREDIKTIVNA ANALÍTIKA ZALOGE — Tipi
// ============================================

export interface DailyUsage {
  date: string
  quantity: number
}

export interface ForecastResult {
  inventoryItemId: string
  itemName: string
  unit: string
  currentStock: number
  minStock: number
  avgDailyUsage: number
  // Napoved za naslednjih 7 dni
  forecast7d: number
  // Napoved za naslednjih 14 dni
  forecast14d: number
  // Napoved za naslednjih 30 dni
  forecast30d: number
  // Dnevi do izpraznitve zaloge
  daysUntilEmpty: number | null
  // Ali je potrebno naročilo
  needsReorder: boolean
  // Predlagana količina naročila
  suggestedOrderQty: number
  // Zaupanje napovedi (0-1)
  confidence: number
  // Sezonski faktor (npr. vikendi = večja poraba)
  seasonalityFactor: number
  // Trend (raste/pada/stabilen)
  trend: 'increasing' | 'decreasing' | 'stable'
  // Tveganje
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  // Razčlenitev po dnevih v tednu
  weekdayBreakdown: { day: string; avgUsage: number }[]
  // Zadnja dobava
  lastRestockDate: string | null
  lastRestockQty: number
}

export interface ForecastSummary {
  totalItems: number
  criticalItems: number
  highRiskItems: number
  needsReorderCount: number
  totalSuggestedOrderValue: number
  avgConfidence: number
}

export interface ForecastData {
  summary: ForecastSummary
  forecasts: ForecastResult[]
}
