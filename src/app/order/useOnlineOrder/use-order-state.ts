'use client'

import { useState, useEffect } from 'react'
import type { RestaurantSettingsRow, WeeklyHoursRow, OrderResultRow } from '@/lib/types'
import type {
  Menu, MenuItem, CartItem, Modifier,
  OrderType, CheckoutStep, DeliveryDetails, TakeoutDetails,
  DeliveryZoneInfo, LocationInfo, PromoResult,
} from '../types'
import {
  fetchMenuData, fetchOrderConfigData, checkDeliveryZoneApi,
  checkPromoCodeApi,
} from './api-helpers'
import { getSubtotal } from './cart-utils'

// =====================================================================
// P2-UX FIX (stanje po refreshu/crashu): košarica spletnega naročanja
// preživi osvežitev strani / crash brskalnika — prej je vsak refresh
// počistil celotno košarico stranke sredi oddaje naročila.
// Shranjujemo samo košarico + vrsto naročila (NE osebnih podatkov).
// =====================================================================
const ONLINE_CART_STORAGE_KEY = 'online-order-cart-v1'

function loadPersistedCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(ONLINE_CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Osnovna validacija oblike (anti-corruption guard za ročno manipulacijo)
    return parsed.filter((i: unknown): i is CartItem => {
      const item = i as { id?: string; quantity?: number; price?: number }
      return typeof item?.id === 'string' && typeof item?.quantity === 'number' && typeof item?.price === 'number' && item.quantity > 0
    })
  } catch {
    return []
  }
}

function loadPersistedOrderType(): OrderType {
  if (typeof window === 'undefined') return 'delivery'
  try {
    const raw = localStorage.getItem(`${ONLINE_CART_STORAGE_KEY}-type`)
    return raw === 'delivery' || raw === 'takeout' ? raw : 'delivery'
  } catch {
    return 'delivery'
  }
}

function persistCart(cart: CartItem[], orderType: OrderType) {
  if (typeof window === 'undefined') return
  try {
    if (cart.length === 0) {
      localStorage.removeItem(ONLINE_CART_STORAGE_KEY)
    } else {
      localStorage.setItem(ONLINE_CART_STORAGE_KEY, JSON.stringify(cart))
    }
    localStorage.setItem(`${ONLINE_CART_STORAGE_KEY}-type`, orderType)
  } catch {
    // Quota/private-mode — persistanca ni kritična, tiho ignoriraj
  }
}

// =====================================================================
// HOOK: Stanje spletne naročilne platforme (state + inicializacija)
// =====================================================================

export function useOrderState() {
  const [menus, setMenus] = useState<Menu[]>([])
  const [settings, setSettings] = useState<RestaurantSettingsRow | null>(null)
  const [activeMenu, setActiveMenu] = useState<string>('')
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [cart, setCart] = useState<CartItem[]>(() => loadPersistedCart())
  const [loading, setLoading] = useState(true)
  const [orderType, setOrderType] = useState<OrderType>(() => loadPersistedOrderType())
  const [step, setStep] = useState<CheckoutStep>('menu')
  const [searchQuery, setSearchQuery] = useState('')
  const [isDark, setIsDark] = useState(false)
  const [isOpenNow, setIsOpenNow] = useState(true)
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHoursRow[]>([])
  const [locations, setLocations] = useState<LocationInfo[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [deliveryZone, setDeliveryZone] = useState<DeliveryZoneInfo | null>(null)
  const [deliveryZoneChecked, setDeliveryZoneChecked] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null)
  const [promoLoading, setPromoLoading] = useState(false)
  const [showHours, setShowHours] = useState(false)
  const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetails>({
    fullName: '', phone: '', email: '', address: '', city: '', postCode: '', notes: '',
  })
  const [takeoutDetails, setTakeoutDetails] = useState<TakeoutDetails>({
    fullName: '', phone: '', email: '', notes: '', preferredTime: '',
  })
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'mobile'>('card')
  const [orderSending, setOrderSending] = useState(false)
  const [orderResult, setOrderResult] = useState<OrderResultRow | null>(null)
  const [error, setError] = useState<string>('')
  const [showItemDetail, setShowItemDetail] = useState<MenuItem | null>(null)
  const [itemNotes, setItemNotes] = useState('')
  const [selectedMods, setSelectedMods] = useState<Modifier[]>([])

  useEffect(() => {
    initMenu()
    initOrderConfig()
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setIsDark(prefersDark)
  }, [])

  // P2-UX FIX: košarica + vrsta naročila se shranjujeta ob vsaki spremembi
  // (uspešna oddaja naročila pokliče setCart([]) → avtomatsko počisti storage)
  useEffect(() => {
    persistCart(cart, orderType)
  }, [cart, orderType])

  async function initMenu() {
    const result = await fetchMenuData()
    if (result.error) setError(result.error)
    setMenus(result.menus)
    setSettings(result.settings)
    setActiveMenu(result.activeMenu)
    setActiveCategory(result.activeCategory)
    setLoading(false)
  }

  async function initOrderConfig() {
    const result = await fetchOrderConfigData(selectedLocation)
    if (result.error) setError(result.error)
    setIsOpenNow(result.isOpenNow)
    setWeeklyHours(result.weeklyHours)
    setLocations(result.locations)
    if (result.selectedLocation !== selectedLocation) setSelectedLocation(result.selectedLocation)
  }

  async function checkDeliveryZone(postCode: string, city: string) {
    const result = await checkDeliveryZoneApi(postCode, city)
    setDeliveryZoneChecked(result.checked)
    setDeliveryZone(result.zone)
  }

  async function checkPromoCode() {
    if (!promoCode.trim()) return
    setPromoLoading(true)
    try {
      const sub = getSubtotal(cart)
      const result = await checkPromoCodeApi(promoCode, sub)
      setPromoResult(result)
    } finally {
      setPromoLoading(false)
    }
  }

  return {
    menus, settings, activeMenu, setActiveMenu, activeCategory, setActiveCategory,
    cart, setCart, loading, orderType, setOrderType, step, setStep,
    searchQuery, setSearchQuery, isDark, setIsDark,
    isOpenNow, weeklyHours, locations, selectedLocation, setSelectedLocation,
    deliveryZone, setDeliveryZone, deliveryZoneChecked, setDeliveryZoneChecked, promoCode, setPromoCode,
    promoResult, setPromoResult, promoLoading, showHours, setShowHours,
    deliveryDetails, setDeliveryDetails, takeoutDetails, setTakeoutDetails,
    paymentMethod, setPaymentMethod, orderSending, setOrderSending,
    orderResult, setOrderResult, error, setError,
    showItemDetail, setShowItemDetail, itemNotes, setItemNotes,
    selectedMods, setSelectedMods,
    checkDeliveryZone, checkPromoCode,
  }
}
