// ============================================
// DELJENI TIPI IN KONSTANTE ZA SKLADNOST S PREDPISI
// ============================================

import { CheckCircle, AlertTriangle, XCircle, Clock, Lock, Eye, Scale, ClipboardList, Users, AlertCircle } from 'lucide-react'

// Tip postavke skladnosti
export interface ComplianceItem {
  id: string
  category: 'gdpr' | 'allergens' | 'furs' | 'haccp' | 'labor' | 'fire_safety'
  title: string
  description: string
  status: 'compliant' | 'warning' | 'non-compliant' | 'pending'
  dueDate: string | null
  lastChecked: string
  actionRequired: string | null
  regulation: string
}

// Konfiguracija statusov
export const statusConfig = {
  'compliant': { label: 'Skladno', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  'warning': { label: 'Opozorilo', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertTriangle },
  'non-compliant': { label: 'Neskladno', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  'pending': { label: 'V postopku', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
} as const

// Konfiguracija kategorij
export const categoryConfig = {
  'gdpr': { label: 'GDPR', icon: Lock, color: 'text-purple-600' },
  'allergens': { label: 'Alergeni', icon: Eye, color: 'text-red-600' },
  'furs': { label: 'FURS', icon: Scale, color: 'text-emerald-600' },
  'haccp': { label: 'HACCP', icon: ClipboardList, color: 'text-blue-600' },
  'labor': { label: 'Delovno pravo', icon: Users, color: 'text-orange-600' },
  'fire_safety': { label: 'Požarna varnost', icon: AlertCircle, color: 'text-red-600' },
} as const

// ============================================
// POMOŽNE FUNKCIJE
// ============================================

/** Izračunaj oceno skladnosti */
export function computeComplianceScore(items: ComplianceItem[]): number {
  const compliantCount = items.filter(i => i.status === 'compliant').length
  return items.length > 0 ? Math.round((compliantCount / items.length) * 100) : 0
}

// ============================================
// VMESNIKI ZA PROPS PODKOMPONENT
// ============================================

export interface ComplianceSummaryCardsProps {
  complianceScore: number
  compliantCount: number
  warningCount: number
  nonCompliantCount: number
  pendingCount: number
}

export interface ComplianceTabsProps {
  items: ComplianceItem[]
}
