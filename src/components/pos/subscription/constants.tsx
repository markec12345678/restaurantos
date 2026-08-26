// ============================================
// NAROČNINA — Skupne konstante in tipi
// ============================================

import type { ReactNode } from 'react'
import { Zap, Star, Crown } from 'lucide-react'

// --- TIPI ---

export interface SubscriptionData {
  id: string
  plan: string
  status: string
  monthlyPrice: number
  locationCount: number
  companyName: string
  trialEndsAt?: string
  currentPeriodEnd?: string
  invoices?: { id: string; invoiceNumber: string; totalAmount: number | null; periodStart: string | null; periodEnd: string | null; dueDate: string | null; status: string }[]
}

export interface SubscriptionForm {
  companyName: string
  email: string
  phone: string
  taxId: string
  businessId: string
  locationCount: number
  paymentMethod: string
}

export interface PlanData {
  name: string
  price: number
  features: string[]
}

// --- KONSTANTE ---

export const planIcons: Record<string, ReactNode> = {
  starter: <Zap className="h-5 w-5" />,
  professional: <Star className="h-5 w-5" />,
  enterprise: <Crown className="h-5 w-5" />,
}

export const planColors: Record<string, string> = {
  starter: 'from-blue-500 to-blue-600',
  professional: 'from-amber-500 to-orange-600',
  enterprise: 'from-purple-600 to-indigo-700',
}

export const statusLabels: Record<string, string> = {
  trial: 'Preizkusno obdobje',
  active: 'Aktivna',
  past_due: 'Zapadla',
  cancelled: 'Preklicana',
  expired: 'Potekla',
}

export const statusColors: Record<string, string> = {
  trial: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  past_due: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
  expired: 'bg-gray-100 text-gray-500',
}

// --- PROPS INTERFACI ZA POD-KOMPONENTE ---

export interface SubscriptionCardProps {
  subscription: SubscriptionData
  planName: string
  onActivate: (_id: string) => void
  onUpgrade: (_id: string, _plan: string) => void
}

export interface PlansGridProps {
  plans: Record<string, PlanData>
  selectedPlan: string
  currentPlan: string | undefined
  onSelectPlan: (_key: string) => void
}

export interface CreateFormProps {
  selectedPlan: string
  plans: Record<string, PlanData>
  form: SubscriptionForm
  onFormChange: (_form: SubscriptionForm) => void
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
}

export interface InvoicesTableProps {
  invoices: Record<string, unknown>[]
}

export interface StatsCardsProps {
  stats: Record<string, number>
}
