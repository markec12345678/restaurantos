'use client'

import type { RestaurantSettingsRow, WeeklyHoursRow, OrderResultRow } from '@/lib/types'
import type {
  Menu, CartItem,
  OrderType, DeliveryZoneInfo, LocationInfo, PromoResult,
  DeliveryDetails, TakeoutDetails,
} from '../types'

// ─── API klici ───────────────────────────────────────────────

export async function fetchMenuData(): Promise<{
  menus: Menu[]
  settings: RestaurantSettingsRow | null
  activeMenu: string
  activeCategory: string
  error: string
}> {
  try {
    const res = await fetch('/api/public/menu')
    const data = await res.json()
    const menus = data.menus || []
    const settings = data.settings || {}
    const activeMenu = menus.length > 0 ? menus[0].id : ''
    const activeCategory = menus.length > 0 ? menus[0].categories?.[0]?.id || '' : ''
    return { menus, settings, activeMenu, activeCategory, error: '' }
  } catch {
    return { menus: [], settings: null, activeMenu: '', activeCategory: '', error: 'Napaka pri nalaganju menija.' }
  }
}

export async function fetchOrderConfigData(selectedLocation: string): Promise<{
  isOpenNow: boolean
  weeklyHours: WeeklyHoursRow[]
  locations: LocationInfo[]
  selectedLocation: string
  error: string
}> {
  try {
    const res = await fetch('/api/public/order-config')
    const data = await res.json()
    const locations = data.locations || []
    return {
      isOpenNow: data.isOpenNow,
      weeklyHours: data.weeklyHours || [],
      locations,
      selectedLocation: locations.length > 0 && !selectedLocation ? locations[0].id : selectedLocation,
      error: '',
    }
  } catch {
    return { isOpenNow: true, weeklyHours: [], locations: [], selectedLocation, error: 'Napaka pri nalaganju konfiguracije.' }
  }
}

export async function checkDeliveryZoneApi(
  postCode: string,
  city: string,
): Promise<{ zone: DeliveryZoneInfo | null; checked: boolean }> {
  if (!postCode) return { zone: null, checked: false }
  try {
    const res = await fetch(`/api/public/delivery-check?postCode=${encodeURIComponent(postCode)}&city=${encodeURIComponent(city)}`)
    const data = await res.json()
    if (data.deliverable && data.zone) {
      return { zone: data.zone, checked: true }
    }
    return { zone: null, checked: true }
  } catch {
    return { zone: null, checked: false }
  }
}

export async function checkPromoCodeApi(
  code: string,
  subtotal: number,
): Promise<PromoResult> {
  if (!code.trim()) return { valid: false, message: '' }
  try {
    const res = await fetch(`/api/public/promo-check?code=${encodeURIComponent(code.trim())}&subtotal=${subtotal}`)
    const data = await res.json()
    return data
  } catch {
    return { valid: false, message: 'Napaka pri preverjanju' }
  }
}

export async function submitOrderApi(params: {
  orderType: OrderType
  cart: CartItem[]
  paymentMethod: string
  deliveryDetails: DeliveryDetails
  takeoutDetails: TakeoutDetails
  deliveryFee: number
  promoCode: string
  promoResult: PromoResult | null
  selectedLocation: string
}): Promise<{ success: boolean; data?: OrderResultRow; error?: string }> {
  const {
    orderType, cart, paymentMethod, deliveryDetails, takeoutDetails,
    deliveryFee, promoCode, promoResult, selectedLocation,
  } = params

  const orderItems = cart.map(item => ({
    menuItemId: item.menuItem.id,
    quantity: item.quantity,
    price: item.menuItem.price,
    vatRate: item.menuItem.vatRate,
    notes: item.notes,
    modifiersJson: JSON.stringify(item.selectedModifiers),
  }))

  const details = orderType === 'delivery'
    ? { ...deliveryDetails, type: 'delivery' }
    : { ...takeoutDetails, type: 'takeout' }

  const res = await fetch('/api/public/online-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderType,
      items: orderItems,
      paymentMethod,
      customer: details,
      deliveryFee,
      promoCode: promoResult?.valid ? promoCode : undefined,
      discountId: promoResult?.valid ? promoResult.discount?.id : undefined,
      discountAmount: promoResult?.valid ? promoResult.discount?.discountAmount : 0,
      locationId: selectedLocation || undefined,
    }),
  })

  const data = await res.json()
  if (res.ok && data.success) {
    return { success: true, data }
  }
  return { success: false, error: data.error || 'Napaka pri naročanju' }
}
