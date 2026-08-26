import {
  Coffee, UtensilsCrossed, CreditCard, Clock,
  ShieldCheck, Building, Sparkles, CheckCircle2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ============================================
// KONSTANTE za dnevni kontrolni seznam
// ============================================

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  sistemi: CreditCard,
  blagajna: CreditCard,
  kuhinja: UtensilsCrossed,
  bár: Coffee,
  čistost: Sparkles,
  jedilnica: Building,
  rezervacije: Clock,
  varnost: ShieldCheck,
}

export const CATEGORY_LABELS: Record<string, string> = {
  sistemi: 'Sistemi',
  blagajna: 'Blagajna',
  kuhinja: 'Kuhinja',
  bár: 'Bar',
  čistost: 'Čistost',
  jedilnica: 'Jedilnica',
  rezervacije: 'Rezervacije',
  varnost: 'Varnost',
}

export const DEFAULT_CATEGORY_ICON = CheckCircle2
