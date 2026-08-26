// --- Gostje, rezervacije in čakalna vrsta ---

/** Rezervacija */
export interface ReservationRow {
  id: string
  tableId?: string
  tableName?: string
  guestName: string
  guestPhone?: string
  partySize: number
  dateTime: string
  status?: string
  notes?: string
  [key: string]: unknown
}

/** Gost */
export interface GuestRow {
  id: string
  name: string
  email?: string
  phone?: string
  loyaltyPoints?: number
  totalSpent?: number
  visitCount?: number
  lastVisit?: string
  notes?: string
  [key: string]: unknown
}

/** Obisk gosta */
export interface GuestVisitRow {
  id: string
  date: string
  amount: number
  items?: string[]
  arrivedAt?: string
  employeeName?: string
  totalSpent?: number
  feedbackScore?: number
  [key: string]: unknown
}

/** Lojalnostni račun */
export interface LoyaltyAccountRow {
  id: string
  points: number
  tier?: string
  [key: string]: unknown
}

/** Obrazec za čakalno vrsto */
export interface WaitlistFormRow {
  name?: string
  guestName?: string
  guestPhone?: string
  partySize: number
  phone?: string
  quotedWaitMinutes?: number
  preferredArea?: string
  specialNeeds?: string
  notes?: string
  [key: string]: unknown
}

/** Obrazec za goste */
export interface GuestFormRow {
  name?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  allergens?: string[]
  dietaryPrefs?: string[]
  dislikes?: string[]
  favoriteItems?: string[]
  company?: string
  birthday?: string
  anniversary?: string
  isVip?: boolean
  notes?: string
  [key: string]: unknown
}
