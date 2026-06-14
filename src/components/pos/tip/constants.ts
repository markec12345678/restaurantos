// ============================================
// TIPI IN KONSTANTE — Upravitelj napitnin
// ============================================

import type { LucideIcon } from 'lucide-react'
import { Equal, Clock, Star, Edit } from 'lucide-react'

export interface TipDistribution {
  id: string
  employeeId: string
  employeeName: string
  hoursWorked: number
  points: number
  amount: number
  status: string
  paidAt: string | null
}

export interface TipPoolData {
  id: string
  date: string
  totalTips: number
  cashTips: number
  cardTips: number
  distributionMethod: string
  status: string
  distributions: TipDistribution[]
}

export const METHOD_LABELS: Record<string, { label: string; icon: LucideIcon; desc: string }> = {
  equal: { label: 'Enako', icon: Equal, desc: 'Enak del za vse' },
  hours: { label: 'Po urah', icon: Clock, desc: 'Proporcionalno uram' },
  points: { label: 'Po točkah', icon: Star, desc: 'Po točkah/sISTEMU' },
  manual: { label: 'Ročno', icon: Edit, desc: 'Ročna dodelitev' },
}

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Čakajoče', color: 'bg-yellow-100 text-yellow-800' },
  distributed: { label: 'Razdeljeno', color: 'bg-blue-100 text-blue-800' },
  approved: { label: 'Odobreno', color: 'bg-green-100 text-green-800' },
  paid: { label: 'Izplačano', color: 'bg-emerald-100 text-emerald-800' },
}

export const formatCurrency = (val: number) => `€${(val || 0).toFixed(2)}`
