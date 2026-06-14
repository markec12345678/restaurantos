// ============================================
// TIPI, KONSTANTE IN POMOŽNE FUNKCIJE
// za podkomponente CRM časovnice gostov
// ============================================

// --- Tipi ---

export interface GuestVisit {
  id: string
  date: string
  table: string | null
  server: string | null
  total: number
  items: string[]
  rating: number | null
  feedback: string | null
}

export interface GuestProfile {
  id: string
  name: string
  phone: string | null
  email: string | null
  loyaltyPoints: number
  loyaltyTier: string
  totalVisits: number
  totalSpent: number
  avgSpend: number
  lastVisit: string | null
  firstVisit: string | null
  favoriteItems: string[]
  allergens: string[]
  preferences: string[]
  notes: string
  visits: GuestVisit[]
  tags: string[]
}

// --- Konstante ---

export const tierColors: Record<string, string> = {
  'Bronza': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  'Srebro': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  'Zlato': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Platina': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
}

// --- Pomožne funkcije ---

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(amount)
}
