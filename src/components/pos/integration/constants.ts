// ============================================
// INTEGRACIJSKI SISTEM — Skupne konstante in tipi
// ============================================

import type { IntegrationConnector } from '@/lib/integrations/connectors'
import { Wifi, WifiOff, XCircle } from 'lucide-react'

// --- TIPI ---

export interface IntegrationItem {
  id: string
  name: string
  type: string
  provider: string
  baseUrl: string
  apiKey: string
  apiSecret: string
  config: string
  syncEnabled: boolean
  syncInterval: number
  lastSyncAt: string | null
  lastSyncStatus: string
  lastSyncError: string
  events: string
  isActive: boolean
  connectionStatus: string
  _count?: { logs: number }
  createdAt: string
  updatedAt: string
}

export interface FormData {
  name: string
  type: string
  provider: string
  baseUrl: string
  apiKey: string
  apiSecret: string
  config: string
  syncEnabled: boolean
  syncInterval: number
  events: string[]
  isActive: boolean
}

// --- POMOŽNE FUNKCIJE ---

export function formatDateSI(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Nikoli'
  const d = new Date(dateStr)
  return d.toLocaleDateString('sl-SI', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function getConnectionStatusConfig(status: string) {
  switch (status) {
    case 'connected': return { label: 'Povezano', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', icon: Wifi }
    case 'disconnected': return { label: 'Nepovezano', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400', icon: WifiOff }
    case 'error': return { label: 'Napaka', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle }
    default: return { label: 'Neznano', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400', icon: WifiOff }
  }
}

export function getTypeLabel(type: string): string {
  const types: Record<string, string> = {
    eracuni: 'e-Računi',
    accounting: 'Računovodstvo',
    delivery: 'Dostava',
    crm: 'CRM',
    ecommerce: 'E-Commerce',
    analytics: 'Analitika',
    custom: 'Splošno',
  }
  return types[type] || type
}

// --- PROPS INTERFACI ZA POD-KOMPONENTE ---

export interface StatsCardsProps {
  totalCount: number
  connectedCount: number
  activeCount: number
  errorCount: number
}

export interface IntegrationTableProps {
  filteredIntegrations: IntegrationItem[]
  search: string
  filterType: string
  onSearchChange: (_value: string) => void
  onFilterTypeChange: (_value: string) => void
  onTest: (_id: string) => void
  onSync: (_id: string) => void
  onEdit: (_item: IntegrationItem) => void
  onDelete: (_item: IntegrationItem) => void
  onAdd: () => void
  testPending: boolean
  syncPending: boolean
}

export interface IntegrationDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  editingItem: IntegrationItem | null
  selectedConnector: IntegrationConnector | null
  formData: FormData
  onFormDataChange: (_data: FormData) => void
  onSelectConnector: (_connector: IntegrationConnector) => void
  onSubmit: () => void
  onCancel: () => void
  isCreating: boolean
  isUpdating: boolean
}

export interface DeleteDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  deleteTarget: IntegrationItem | null
  onConfirm: () => void
}
