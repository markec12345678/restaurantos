// ============================================
// TIPI IN KONSTANTE ZA PRINTER MANAGER
// ============================================

/** Pravilo tiskanja */
export interface PrintRule {
  type: string // "order", "receipt", "prepStationOrder"
  prepStationId?: string
}

/** Podatkovni tip za tiskalnik */
export interface PrinterItem {
  id: string
  name: string
  type: string
  location: string
  ipAddress: string
  isActive: boolean
  printRules: string // JSON string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/** Podatkovni tip za obrazec */
export interface FormData {
  name: string
  type: string
  location: string
  ipAddress: string
  isActive: boolean
  printRulesOrder: boolean
  printRulesReceipt: boolean
  printRulesPrepStationOrder: boolean
}

/** Status preizkusa povezljivosti tiskalnika */
export type PrinterStatus = 'idle' | 'checking' | 'online' | 'offline'

// ============================================
// KONSTANTE
// ============================================

export const API_BASE = '/api/configuration/printers'

export const typeLabels: Record<string, string> = {
  thermal: 'Termični',
  'dot-matrix': 'Iglični',
  label: 'Nalepke',
}

export const typeBadgeClasses: Record<string, string> = {
  thermal: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'dot-matrix': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  label: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
}

export const ruleTypeLabels: Record<string, string> = {
  order: 'Naročila',
  receipt: 'Računi',
  prepStationOrder: 'Naročila postaje',
}

// ============================================
// POMOŽNE FUNKCIJE
// ============================================

/** Razčleni JSON niz pravil tiskanja */
export function parsePrintRules(rulesJson: string): PrintRule[] {
  try {
    return JSON.parse(rulesJson || '[]')
  } catch {
    return []
  }
}

/** Pridobi povzetek pravil tiskanja */
export function getRulesSummary(rulesJson: string): string {
  const rules = parsePrintRules(rulesJson)
  if (rules.length === 0) return 'Brez pravil'
  return rules.map(r => ruleTypeLabels[r.type] || r.type).join(', ')
}

// ============================================
// PROPS INTERFACES ZA POD-KOMPONENTE
// ============================================

export interface StatsCardsProps {
  total: number
  active: number
  kitchen: number
  receipt: number
}

export interface PrinterGridProps {
  printers: PrinterItem[]
  search: string
  isLoading: boolean
  printerStatus: Record<string, PrinterStatus>
  onSearchChange: (_value: string) => void
  onEdit: (_printer: PrinterItem) => void
  onDelete: (_id: string) => void
  onTestConnectivity: (_printer: PrinterItem) => void
  onToggleActive: (_printer: PrinterItem) => void
}

export interface PrinterDialogProps {
  open: boolean
  editingPrinter: PrinterItem | null
  formData: FormData
  onOpenChange: (_open: boolean) => void
  onFormDataChange: (_data: FormData) => void
  onSubmit: () => void
  isPending: boolean
}
