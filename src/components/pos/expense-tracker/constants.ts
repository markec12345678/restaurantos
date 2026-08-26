// ============================================
// KONSTANTE ZA SLEDENJE STROŠKOV
// ============================================

import { DollarSign, TrendingUp, Receipt, Building, Truck, Zap, ShieldCheck, Wrench, Package, CreditCard, Banknote, ArrowUpRight } from 'lucide-react'

export const CATEGORIES = [
  { id: 'rent', label: 'Najemnina', icon: Building, color: 'blue' },
  { id: 'utilities', label: 'Komunalne', icon: Zap, color: 'yellow' },
  { id: 'supplies', label: 'Zaloge', icon: Package, color: 'green' },
  { id: 'food', label: 'Živila', icon: Truck, color: 'orange' },
  { id: 'labor', label: 'Delovna sila', icon: DollarSign, color: 'purple' },
  { id: 'maintenance', label: 'Vzdrževanje', icon: Wrench, color: 'red' },
  { id: 'insurance', label: 'Zavarovanje', icon: ShieldCheck, color: 'cyan' },
  { id: 'marketing', label: 'Marketing', icon: TrendingUp, color: 'pink' },
  { id: 'other', label: 'Ostalo', icon: Receipt, color: 'gray' },
]

export const PAYMENT_METHODS = [
  { id: 'cash', label: 'Gotovina', icon: Banknote },
  { id: 'card', label: 'Kartica', icon: CreditCard },
  { id: 'transfer', label: 'Transakcija', icon: ArrowUpRight },
]
