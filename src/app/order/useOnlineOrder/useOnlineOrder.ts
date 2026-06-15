'use client'

import { useState, useEffect, useCallback } from 'react'
import type { RestaurantSettingsRow, WeeklyHoursRow, OrderResultRow } from '@/lib/types'
import type {
  Menu, MenuItem, Modifier, ModifierGroup, CartItem,
  OrderType, CheckoutStep, DeliveryDetails, TakeoutDetails,
  DeliveryZoneInfo, LocationInfo, PromoResult,
} from '../types'
import {
  DEFAULT_DELIVERY_FEE, DEFAULT_MIN_ORDER,
  ESTIMATED_DELIVERY_MIN, ESTIMATED_TAKEOUT_MIN,
} from '../constants'
import {
  addToCartLogic, removeFromCartLogic, updateQuantityLogic,
  getSubtotal, getDeliveryFee, getMinOrderAmount, getEstimatedMinutes,
  getTotal, toggleModifierLogic,
} from './cart-utils'
import {
  fetchMenuData, fetchOrderConfigData, checkDeliveryZoneApi,
  checkPromoCodeApi, submitOrderApi,
} from './api-helpers'

// =====================================================================
// HOOK: Stanje in logika spletne naročilne platforme
// =====================================================================

export function useOnlineOrder() {
  const [menus, setMenus] = useState<Menu[]>([])
  const [settings, setSettings] = useState<RestaurantSettingsRow | null>(null)
  const [activeMenu, setActiveMenu] = useState<string>('')
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [orderType, setOrderType] = useState<OrderType>('delivery')
  const [step, setStep] = useState<CheckoutStep>('menu')
  const [searchQuery, setSearchQuery] = useState('')
  const [isDark, setIsDark] = useState(false)
  // --- Dodatna polja ---
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

  // Checkout podatki
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

  // Item detail modal
  const [showItemDetail, setShowItemDetail] = useState<MenuItem | null>(null)
  const [itemNotes, setItemNotes] = useState('')
  const [selectedMods, setSelectedMods] = useState<Modifier[]>([])

  useEffect(() => {
    initMenu()
    initOrderConfig()
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setIsDark(prefersDark)
  }, [])

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

  // Preveri cono dostave ko se spremeni naslov
  async function checkDeliveryZone(postCode: string, city: string) {
    const result = await checkDeliveryZoneApi(postCode, city)
    setDeliveryZoneChecked(result.checked)
    setDeliveryZone(result.zone)
  }

  // Preveri promo kodo
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

  const addToCart = useCallback((item: MenuItem, modifiers: Modifier[] = [], notes: string = '') => {
    setCart(prev => addToCartLogic(prev, item, modifiers, notes))
    setShowItemDetail(null)
    setItemNotes('')
    setSelectedMods([])
  }, [])

  const removeFromCart = useCallback((index: number) => {
    setCart(prev => removeFromCartLogic(prev, index))
  }, [])

  const updateQuantity = useCallback((index: number, delta: number) => {
    setCart(prev => updateQuantityLogic(prev, index, delta))
  }, [])

  function toggleModifier(mod: Modifier, group: ModifierGroup) {
    setSelectedMods(prev => toggleModifierLogic(prev, mod, group))
  }

  async function placeOrder() {
    if (cart.length === 0) return
    setOrderSending(true)
    try {
      const _promoDiscount = promoResult?.valid && promoResult.discount ? promoResult.discount.discountAmount : 0
      const deliveryFee = getDeliveryFee(orderType, getSubtotal(cart), deliveryZone, DEFAULT_DELIVERY_FEE)

      const result = await submitOrderApi({
        orderType,
        cart,
        paymentMethod,
        deliveryDetails,
        takeoutDetails,
        deliveryFee,
        promoCode,
        promoResult,
        selectedLocation,
      })

      if (result.success && result.data) {
        setCart([])
        setOrderResult(result.data)
        setStep('confirmation')
      } else {
        alert(result.error || 'Napaka pri naročanju')
      }
    } catch {
      setError('Napaka pri oddaji naročila.')
    } finally {
      setOrderSending(false)
    }
  }

  // --- Izpeljane vrednosti ---
  const currentMenu = menus.find(m => m.id === activeMenu)
  const currentCategory = currentMenu?.categories.find(c => c.id === activeCategory)
  const filteredItems = searchQuery && currentCategory
    ? currentCategory.menuItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : currentCategory?.menuItems || []
  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0)
  const subtotal = getSubtotal(cart)
  const promoDiscount = promoResult?.valid && promoResult.discount ? promoResult.discount.discountAmount : 0
  const total = getTotal(cart, orderType, deliveryZone, promoDiscount, DEFAULT_DELIVERY_FEE)

  const resetAfterConfirmation = useCallback(() => {
    setStep('menu')
    setOrderResult(null)
    setPromoCode('')
    setPromoResult(null)
    setDeliveryZone(null)
    setDeliveryZoneChecked(false)
  }, [])

  return {
    // Stanje
    menus, settings, activeMenu, setActiveMenu, activeCategory, setActiveCategory,
    cart, loading, orderType, setOrderType, step, setStep,
    searchQuery, setSearchQuery, isDark, setIsDark,
    isOpenNow, weeklyHours, locations, selectedLocation, setSelectedLocation,
    deliveryZone, deliveryZoneChecked, promoCode, setPromoCode,
    promoResult, setPromoResult, promoLoading, showHours, setShowHours,
    deliveryDetails, setDeliveryDetails, takeoutDetails, setTakeoutDetails,
    paymentMethod, setPaymentMethod, orderSending, orderResult, error, setError,
    showItemDetail, setShowItemDetail, itemNotes, setItemNotes,
    selectedMods, setSelectedMods, toggleModifier,
    // Izračuni
    currentMenu, currentCategory, filteredItems,
    cartItemCount, subtotal, total,
    getSubtotal: () => getSubtotal(cart),
    getDeliveryFee: () => getDeliveryFee(orderType, subtotal, deliveryZone, DEFAULT_DELIVERY_FEE),
    getMinOrderAmount: () => getMinOrderAmount(deliveryZone, DEFAULT_MIN_ORDER),
    getEstimatedMinutes: () => getEstimatedMinutes(orderType, deliveryZone, ESTIMATED_DELIVERY_MIN, ESTIMATED_TAKEOUT_MIN),
    getTotal: () => getTotal(cart, orderType, deliveryZone, promoDiscount, DEFAULT_DELIVERY_FEE),
    // Akcije
    addToCart, removeFromCart, updateQuantity,
    checkDeliveryZone, checkPromoCode, placeOrder,
    resetAfterConfirmation,
    // Konstante (za prikaz)
    ESTIMATED_DELIVERY_MIN, ESTIMATED_TAKEOUT_MIN,
  }
}
