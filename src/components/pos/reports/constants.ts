// Skupne konstante za poročila

export const PIE_COLORS = ['#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316']

export const paymentMethodLabels: Record<string, string> = {
  cash: 'Gotovina',
  card: 'Kartica',
  mobile: 'Mobilno',
  gotovina: 'Gotovina',
  kartica: 'Kartica',
  mobilno: 'Mobilno',
}

export const orderTypeLabels: Record<string, string> = {
  'dine-in': 'V lokalu',
  takeout: 'Za s seboj',
  delivery: 'Dostava',
}

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly'
