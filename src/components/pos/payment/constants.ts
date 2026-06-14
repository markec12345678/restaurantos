import { Banknote, CreditCard, Smartphone, Gift, Star, Ticket } from 'lucide-react'

// ============================================
// KONSTANTE za plačilni dialog
// ============================================

export const tipPresets = [0, 5, 10, 15, 20]

export const paymentMethods = [
  { id: 'cash', label: 'Gotovina', icon: Banknote, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { id: 'card', label: 'Kartično', icon: CreditCard, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  { id: 'mobile', label: 'Mobilno', icon: Smartphone, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  { id: 'giftcard', label: 'Darilna kartica', icon: Gift, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  { id: 'loyalty', label: 'Zvestoba', icon: Star, color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400' },
  { id: 'alternate', label: 'Bon/Vavčer', icon: Ticket, color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400' },
]

export const quickCashAmounts = [5, 10, 20, 50, 100]

export const guestColors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500', 'bg-cyan-500']

export const guestTextColors = ['text-blue-600', 'text-emerald-600', 'text-amber-600', 'text-violet-600', 'text-rose-600', 'text-cyan-600']
