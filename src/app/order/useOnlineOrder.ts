'use client'

import { useState, useEffect, useCallback } from 'react'
import type { RestaurantSettingsRow, WeeklyHoursRow, OrderResultRow } from '@/lib/types'
import type {
  Menu, MenuItem, Modifier, ModifierGroup, CartItem,
  OrderType, CheckoutStep, DeliveryDetails, TakeoutDetails,
  DeliveryZoneInfo, LocationInfo, PromoResult,
} from './types'
import {
  DEFAULT_DELIVERY_FEE, DEFAULT_MIN_ORDER,
  ESTIMATED_DELIVERY_MIN, ESTIMATED_TAKEOUT_MIN,
} from './constants'

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
    fetchMenu()
    fetchOrderConfig()
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setIsDark(prefersDark)
  }, [])

  async function fetchMenu() {
    try {
      const res = await fetch('/api/public/menu')
      const data = await res.json()
      setMenus(data.menus || [])
      setSettings(data.settings || {})
      if (data.menus?.length > 0) {
        setActiveMenu(data.menus[0].id)
        setActiveCategory(data.menus[0].categories?.[0]?.id || '')
      }
    } catch {
      setError('Napaka pri nalaganju menija.')
    } finally {
      setLoading(false)
    }
  }

  async function fetchOrderConfig() {
    try {
      const res = await fetch('/api/public/order-config')
      const data = await res.json()
      setIsOpenNow(data.isOpenNow)
      setWeeklyHours(data.weeklyHours || [])
      setLocations(data.locations || [])
      if (data.locations?.length > 0 && !selectedLocation) {
        setSelectedLocation(data.locations[0].id)
      }
    } catch {
      setError('Napaka pri nalaganju konfiguracije.')
    }
  }

  // Preveri cono dostave ko se spremeni naslov
  async function checkDeliveryZone(postCode: string, city: string) {
    if (!postCode) return
    try {
      const res = await fetch(`/api/public/delivery-check?postCode=${encodeURIComponent(postCode)}&city=${encodeURIComponent(city)}`)
      const data = await res.json()
      setDeliveryZoneChecked(true)
      if (data.deliverable && data.zone) {
        setDeliveryZone(data.zone)
      } else {
        setDeliveryZone(null)
      }
    } catch {
      setDeliveryZoneChecked(false)
    }
  }

  // Preveri promo kodo
  async function checkPromoCode() {
    if (!promoCode.trim()) return
    setPromoLoading(true)
    try {
      const sub = getSubtotal()
      const res = await fetch(`/api/public/promo-check?code=${encodeURIComponent(promoCode.trim())}&subtotal=${sub}`)
      const data = await res.json()
      setPromoResult(data)
    } catch {
      setPromoResult({ valid: false, message: 'Napaka pri preverjanju' })
    } finally {
      setPromoLoading(false)
    }
  }

  const addToCart = useCallback((item: MenuItem, modifiers: Modifier[] = [], notes: string = '') => {
    setCart(prev => {
      const key = `${item.id}-${modifiers.map(m => m.id).sort().join(',')}`
      const existing = prev.findIndex(c =>
        `${c.menuItem.id}-${c.selectedModifiers.map(m => m.id).sort().join(',')}` === key
      )
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 }
        return updated
      }
      return [...prev, { menuItem: item, quantity: 1, selectedModifiers: modifiers, notes }]
    })
    setShowItemDetail(null)
    setItemNotes('')
    setSelectedMods([])
  }, [])

  const removeFromCart = useCallback((index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index))
  }, [])

  const updateQuantity = useCallback((index: number, delta: number) => {
    setCart(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], quantity: updated[index].quantity + delta }
      if (updated[index].quantity <= 0) updated.splice(index, 1)
      return updated
    })
  }, [])

  function getSubtotal() {
    return cart.reduce((sum, item) => {
      const modPrice = item.selectedModifiers.reduce((s, m) => s + (m.price || 0), 0)
      return sum + (item.menuItem.price + modPrice) * item.quantity
    }, 0)
  }

  function getDeliveryFee() {
    if (orderType !== 'delivery') return 0
    const sub = getSubtotal()
    const zone = deliveryZone
    if (zone) {
      if (zone.freeDeliveryAbove > 0 && sub >= zone.freeDeliveryAbove) return 0
      return zone.deliveryFee
    }
    return DEFAULT_DELIVERY_FEE
  }

  function getMinOrderAmount() {
    return deliveryZone?.minOrderAmount || DEFAULT_MIN_ORDER
  }

  function getEstimatedMinutes() {
    if (orderType === 'takeout') return ESTIMATED_TAKEOUT_MIN
    return deliveryZone?.estimatedMinutes || ESTIMATED_DELIVERY_MIN
  }

  function getTotal() {
    const sub = getSubtotal()
    const vat = cart.reduce((sum, item) => {
      const modPrice = item.selectedModifiers.reduce((s, m) => s + (m.price || 0), 0)
      const basePrice = item.menuItem.price + modPrice
      return sum + basePrice * (item.menuItem.vatRate / 100) * item.quantity
    }, 0)
    const deliveryFee = getDeliveryFee()
    const promoDiscount = promoResult?.valid && promoResult.discount ? promoResult.discount.discountAmount : 0
    return Math.max(0, sub + vat + deliveryFee - promoDiscount)
  }

  function toggleModifier(mod: Modifier, group: ModifierGroup) {
    setSelectedMods(prev => {
      const groupMods = prev.filter(m => group.modifiers.some(gm => gm.id === m.id))
      const otherMods = prev.filter(m => !group.modifiers.some(gm => gm.id === m.id))
      const exists = groupMods.find(m => m.id === mod.id)
      if (exists) return [...otherMods, ...groupMods.filter(m => m.id !== mod.id)]
      if (group.maxSelect && groupMods.length >= group.maxSelect) {
        const updated = [...groupMods.slice(1), mod]
        return [...otherMods, ...updated]
      }
      return [...otherMods, mod]
    })
  }

  async function placeOrder() {
    if (cart.length === 0) return
    setOrderSending(true)
    try {
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
          deliveryFee: getDeliveryFee(),
          promoCode: promoResult?.valid ? promoCode : undefined,
          discountId: promoResult?.valid ? promoResult.discount?.id : undefined,
          discountAmount: promoResult?.valid ? promoResult.discount?.discountAmount : 0,
          locationId: selectedLocation || undefined,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setCart([])
        setOrderResult(data)
        setStep('confirmation')
      } else {
        alert(data.error || 'Napaka pri naročanju')
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
  const subtotal = getSubtotal()
  const total = getTotal()

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
    getSubtotal, getDeliveryFee, getMinOrderAmount, getEstimatedMinutes, getTotal,
    // Akcije
    addToCart, removeFromCart, updateQuantity,
    checkDeliveryZone, checkPromoCode, placeOrder,
    resetAfterConfirmation,
    // Konstante (za prikaz)
    ESTIMATED_DELIVERY_MIN, ESTIMATED_TAKEOUT_MIN,
  }
}
