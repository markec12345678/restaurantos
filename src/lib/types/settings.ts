// --- Nastavitve, lokacije in dobavne cone ---

/** Nastavitve restavracije */
export interface RestaurantSettingsRow {
  id?: string
  name?: string
  isOpen?: boolean
  currency?: string
  taxRate?: number
  deliveryEnabled?: boolean
  takeawayEnabled?: boolean
  [key: string]: unknown
}

/** Delovni čas */
export interface WeeklyHoursRow {
  day: string
  open: string
  close: string
  isClosed?: boolean
  [key: string]: unknown
}

/** Dobavna cona */
export interface DeliveryZoneRow {
  id: string
  name: string
  radius?: number
  fee?: number
  deliveryFee?: number
  minOrder?: number
  minOrderAmount?: number
  freeDeliveryAbove?: number
  estimatedMinutes?: number
  postCodes?: string
  cities?: string
  locationId?: string
  isActive?: boolean
  [key: string]: unknown
}

/** Lokacija */
export interface LocationRow {
  id: string
  name: string
  address?: string
  phone?: string
  isActive?: boolean
  [key: string]: unknown
}

/** Obrazec za naročnino */
export interface SubscriptionFormRow {
  planId?: string
  companyName?: string
  email?: string
  phone?: string
  taxId?: string
  businessId?: string
  locationCount?: number
  paymentMethod?: string
  [key: string]: unknown
}

/** Obrazec za lokacijo */
export interface LocationFormRow {
  name: string
  address?: string
  phone?: string
  [key: string]: unknown
}

/** Obrazec za dobavno cono */
export interface DeliveryZoneFormRow {
  name: string
  radius?: number
  fee?: number
  minOrder?: number
  [key: string]: unknown
}
