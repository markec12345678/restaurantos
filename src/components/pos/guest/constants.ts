// ============================================
// TIPI, KONSTANTE IN POMOŽNE FUNKCIJE
// za podkomponente upravljanja gostov
// ============================================

import type { LoyaltyAccountRow, GuestVisitRow, OrderRow, GuestFormRow } from '@/lib/types'

// --- Tipi ---

/** Podatki o gostu iz API-ja */
export interface GuestData {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  isVip: boolean
  vipSince: string | null
  allergens: string
  dietaryPrefs: string
  dislikes: string
  favoriteItems: string
  birthday: string | null
  anniversary: string | null
  company: string
  notes: string
  totalVisits: number
  totalSpent: number
  avgCheckAmount: number
  lastVisitAt: string | null
  firstVisitAt: string | null
  loyaltyAccount: LoyaltyAccountRow | null
  visits: GuestVisitRow[]
  orders: OrderRow[]
}

// --- Konstante ---

/** Seznam prehranskih preferenc */
export const DIETARY_OPTIONS = [
  'Vegetarijansko', 'Vegansko', 'Brez glutena', 'Brez laktoze', 'Halal', 'Košer', 'Peskarijansko'
]

/** Seznam alergenov */
export const ALLERGEN_LIST = [
  '1-Žita', '2-Raki', '3-Jajca', '4-Ribe', '5-Arašidi', '6-Soja', '7-Mleko',
  '8-Oreški', '9-Zeler', '10-Gorčica', '11-Sesam', '12-Žveplov dioksid', '13-Volčji bob', '14-Mehkužci'
]

// --- Pomožne funkcije ---

/** Razčleni JSON polje iz niza — varno */
export function parseJsonField(field: string): string[] {
  try { return JSON.parse(field || '[]'); } catch { return []; }
}

/** Prazna oblika za nov gost */
export function emptyGuestForm(): GuestFormRow {
  return { firstName: '', lastName: '', phone: '', email: '', allergens: [], dietaryPrefs: [], dislikes: [], favoriteItems: [] }
}
