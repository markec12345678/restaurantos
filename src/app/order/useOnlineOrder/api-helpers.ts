'use client'

import type { RestaurantSettingsRow, WeeklyHoursRow, OrderResultRow } from '@/lib/types'
import type {
  Menu, CartItem,
  OrderType, DeliveryZoneInfo, LocationInfo, PromoResult,
  DeliveryDetails, TakeoutDetails,
} from '../types'

// ─── API klici ───────────────────────────────────────────────

// R90: ?locationId je od R90-1 OBVEZEN (konec globalnega fallbacka —
// manjkajoč/neznan/neaktiven locationId → unificiran 404). qs vzorec je
// enak qr-menu siblingu (src/app/qr-menu/use-qr-menu/api-helpers.ts).
// Meni ostane tokenless (javen podatek po naravi) — samo lokacijsko scoped.
export async function fetchMenuData(locationId?: string | null): Promise<{
  menus: Menu[]
  settings: RestaurantSettingsRow | null
  activeMenu: string
  activeCategory: string
  error: string
}> {
  try {
    const qs = locationId ? `?locationId=${encodeURIComponent(locationId)}` : ''
    const res = await fetch(`/api/public/menu${qs}`)
    // R90 odločitev: !res.ok → error string (NE tiha prazna menija).
    // Po R90 sekvenci v use-order-state se menu fetch brez locationId sploh
    // ne zgodi, kadar manjka veljaven token kontekst (needsOrderingLink ga
    // izpusti — empty state je prikazan, error ostane neviden). Klic bodisi
    // nosi deep-link lokacijo bodisi je order-config že padel — 404 je torej
    // resnična okvara in error banner v main appu je iskren (usklajeno s
    // qr-menu siblingom, ki vrže napako pri !res.ok).
    if (!res.ok) {
      return { menus: [], settings: null, activeMenu: '', activeCategory: '', error: 'Napaka pri nalaganju menija.' }
    }
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

export async function fetchOrderConfigData(
  selectedLocation: string,
  // R89: ordering token iz URL deep linka (?t=) — order-config je token-gated:
  // strežnik vrača config SAMO za token-proveno lokacijo (?locationId= + ?t=).
  orderingToken?: string,
): Promise<{
  isOpenNow: boolean
  weeklyHours: WeeklyHoursRow[]
  locations: LocationInfo[]
  selectedLocation: string
  // R89: prazna konfiguracija (requiresToken / ni lokacij) → UI pokaže
  // "Naročanje po povezavi" empty state; URL-izbrana lokacija (?loc=) ostane
  // nedotaknjena — o njeni veljavnosti odloči POST (strežnik fail-closed).
  needsOrderingLink: boolean
  error: string
}> {
  try {
    // R89: zahtevek z kontekstom pošljemo SAMO ko imava OBVA polja (deep link
    // ?loc= + ?t=); sicer goli klic → prazna konfiguracija (200, fail-closed).
    // Klic ostane v obeh primerih, da je UI state machine uniformna.
    const res = await fetch(
      selectedLocation && orderingToken
        ? `/api/public/order-config?locationId=${encodeURIComponent(selectedLocation)}&t=${encodeURIComponent(orderingToken)}`
        : '/api/public/order-config',
    )
    const data = await res.json()
    // R89: prazna konfiguracija (anonimen klic / slab / zastarel token) →
    // needsOrderingLink; locations ostanejo prazne, selectedLocation se NE
    // prepiše (?loc= je lahko še vedno veljaven — POST bo odločil).
    if (data.requiresToken || !data.locations?.length) {
      return {
        isOpenNow: data.isOpenNow ?? false,
        weeklyHours: [],
        locations: [],
        selectedLocation,
        needsOrderingLink: true,
        error: '',
      }
    }
    // R89: veljavna konfiguracija — pin na token-proveno lokacijo
    // (data.locationId ?? locations[0].locationId; locations entry nosi
    // locationId — dokumentirana R89 izjema od "brez internih ID-jev").
    // Popravljen prejšnji hack locations[0].id, ki API nikoli ni vrnil.
    const pinnedLocation: string = data.locationId ?? data.locations[0]?.locationId ?? ''
    return {
      isOpenNow: data.isOpenNow,
      weeklyHours: data.weeklyHours || [],
      locations: data.locations,
      selectedLocation: selectedLocation || pinnedLocation,
      needsOrderingLink: false,
      error: '',
    }
  } catch {
    // R89: omrežna napaka ≠ requiresToken — stara error pot ostane,
    // needsOrderingLink se NE postavi (brez zavajajočega empty state-a)
    return { isOpenNow: true, weeklyHours: [], locations: [], selectedLocation, needsOrderingLink: false, error: 'Napaka pri nalaganju konfiguracije.' }
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
  // R86-3 (M5): strežnik zahteva izrecen ?locationId (fail-closed, brez
  // globalnega fallbacka) — pošljemo izbrano lokacijo spletnega naročila.
  locationId?: string | null,
): Promise<PromoResult> {
  if (!code.trim()) return { valid: false, message: '' }
  try {
    const params = new URLSearchParams({ code: code.trim(), subtotal: String(subtotal) })
    if (locationId) params.set('locationId', locationId)
    const res = await fetch(`/api/public/promo-check?${params.toString()}`)
    const data = await res.json()
    // R86-3: 400 (manjkajoča lokacija) / 404 (neznana/tuja lokacija) —
    // prijazen odgovor za UI, brez tehničnih detajlov.
    if (!res.ok || data?.error) return { valid: false, message: 'Koda ni veljavna za to lokacijo' }
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
  // R88: per-location ordering token (`v1:<64 hex>`, deep link ?t=) —
  // obvezen za uspešno naročilo; undefined/prazen → 404 (strežnik fail-closed)
  orderingToken?: string
}): Promise<{ success: boolean; data?: OrderResultRow; error?: string }> {
  const {
    orderType, cart, paymentMethod, deliveryDetails, takeoutDetails,
    deliveryFee, promoCode, promoResult, selectedLocation, orderingToken,
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
      // R88: token je vezan na locationId (HMAC) — pošljemo ga samo če obstaja
      // (deep link ?t=); brez njega strežnik zavrne z unificirano 404.
      orderingToken: orderingToken || undefined,
    }),
  })

  const data = await res.json()
  if (res.ok && data.success) {
    return { success: true, data }
  }
  return { success: false, error: data.error || 'Napaka pri naročanju' }
}
