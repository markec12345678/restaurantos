// ============================================
// TIPI: Multi-Location Dashboard
// ============================================

export interface LocationData {
  id: string
  name: string
  code: string
  type: string
  address: string
  city: string
  country: string
  phone: string
  email: string
  isOpen: boolean
  isActive: boolean
  latitude: number | null
  longitude: number | null
  _count?: {
    orders: number
    employees: number
    tables: number
  }
}

export const TYPE_LABELS: Record<string, string> = {
  restaurant: 'Restavracija',
  food_truck: 'Food Truck',
  pop_up: 'Pop-up',
  cloud_kitchen: 'Cloud Kitchen',
  bar: 'Bar',
}
