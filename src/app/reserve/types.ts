// =====================================================================
// Tipi za javno stran rezervacij
// =====================================================================

export interface ReservationSlot {
  time: string
  available: boolean
  tablesAvailable: number
}

export interface RestaurantInfo {
  name: string
  address: string
  phone: string
  logo: string
  openingHours: Record<string, { open: string; close: string }>
}

export type ReservationStep = 'details' | 'confirm' | 'success' | 'error'
