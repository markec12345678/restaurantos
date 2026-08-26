// ============================================
// DELJENI TIPI IN KONSTANTE ZA INVENTORY ALERTS
// ============================================

import { AlertTriangle, Bell, BellRing } from 'lucide-react'

export interface InventoryAlert {
  id: string
  itemName: string
  currentStock: number
  minStock: number
  unit: string
  category: string
  supplier: string | null
  supplierId: string | null // ID za API klice (ne ime)
  dailyUsage: number
  daysUntilEmpty: number
  severity: 'critical' | 'warning' | 'low'
  lastRestocked: string | null
  autoOrderSuggested: boolean
  suggestedOrderQty: number
}

export interface AlertSettings {
  criticalThreshold: number // days
  warningThreshold: number  // days
  autoNotify: boolean
  notifyHours: number[]
}

// Konfiguracija po resnosti
export const SEVERITY_CONFIG = {
  critical: {
    color: 'bg-red-500',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
    icon: BellRing,
    label: 'Kritično',
  },
  warning: {
    color: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
    icon: AlertTriangle,
    label: 'Opozorilo',
  },
  low: {
    color: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
    icon: Bell,
    label: 'Nizko',
  },
} as const

// Privzete nastavitve opozoril
export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  criticalThreshold: 2,
  warningThreshold: 5,
  autoNotify: true,
  notifyHours: [8, 14],
}

// ============================================
// VMESNIKI ZA PROPS PODKOMPONENT
// ============================================

export interface AlertSummaryCardsProps {
  criticalCount: number
  warningCount: number
  lowCount: number
}

export interface AlertFilterBarProps {
  filterSeverity: string
  onFilterChange: (_severity: string) => void
  criticalCount: number
  warningCount: number
  lowCount: number
}

export interface AlertCardProps {
  alert: InventoryAlert
  isAutoOrdering: boolean
  onAutoOrder: (_alert: InventoryAlert) => void
  onMarkRestocked: (_alertId: string) => void
}

export type AlertEmptyStateProps = Record<string, never>
