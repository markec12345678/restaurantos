// =====================================================================
// Tipi za spletno naročanje — Online Ordering Platform
// =====================================================================

export interface Modifier {
  id: string
  name: string
  price: number
}

export interface ModifierGroup {
  id: string
  name: string
  required: boolean
  minSelect: number
  maxSelect: number | null
  modifiers: Modifier[]
}

export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  vatRate: number
  allergens: string
  image: string
  sortOrder: number
  modifierGroups: { sortOrder: number; modifierGroup: ModifierGroup }[]
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  sortOrder: number
  menuItems: MenuItem[]
}

export interface Menu {
  id: string
  name: string
  icon: string
  color: string
  sortOrder: number
  categories: Category[]
}

export interface CartItem {
  menuItem: MenuItem
  quantity: number
  selectedModifiers: Modifier[]
  notes: string
}

export type OrderType = 'delivery' | 'takeout'
export type CheckoutStep = 'menu' | 'cart' | 'details' | 'payment' | 'confirmation'

export interface DeliveryDetails {
  fullName: string
  phone: string
  email: string
  address: string
  city: string
  postCode: string
  notes: string
}

export interface TakeoutDetails {
  fullName: string
  phone: string
  email: string
  notes: string
  preferredTime: string
}

export interface DeliveryZoneInfo {
  id: string
  name: string
  deliveryFee: number
  minOrderAmount: number
  freeDeliveryAbove: number
  estimatedMinutes: number
}

export interface LocationInfo {
  id: string
  name: string
  code: string
  address: string
  city: string
  phone: string
  isOpen: boolean
}

export interface PromoResult {
  valid: boolean
  discount?: {
    id: string
    name: string
    type: string
    amount: number
    discountAmount: number
    description: string
  }
  message?: string
}
