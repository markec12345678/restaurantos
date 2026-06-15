'use client'

import { useCallback } from 'react'
import type { Menu, CartItem } from '../types'
import {
  DEFAULT_DELIVERY_FEE, DEFAULT_MIN_ORDER,
  ESTIMATED_DELIVERY_MIN, ESTIMATED_TAKEOUT_MIN,
} from '../constants'
import {
  getSubtotal, getDeliveryFee, getMinOrderAmount, getEstimatedMinutes,
  getTotal,
} from './cart-utils'
import { useOrderState } from './use-order-state'
import { useOrderActions } from './use-order-actions'

// =====================================================================
// HOOK: Stanje in logika spletne naročilne platforme
// =====================================================================

export function useOnlineOrder() {
  const state = useOrderState()
  const actions = useOrderActions({
    cart: state.cart,
    setCart: state.setCart,
    setShowItemDetail: state.setShowItemDetail,
    setItemNotes: state.setItemNotes,
    setSelectedMods: state.setSelectedMods,
    setOrderSending: state.setOrderSending,
    setOrderResult: state.setOrderResult,
    setStep: state.setStep,
    setError: state.setError,
    orderType: state.orderType,
    deliveryZone: state.deliveryZone,
    promoCode: state.promoCode,
    promoResult: state.promoResult,
    paymentMethod: state.paymentMethod,
    deliveryDetails: state.deliveryDetails,
    takeoutDetails: state.takeoutDetails,
    selectedLocation: state.selectedLocation,
  })

  // --- Izpeljane vrednosti ---
  const currentMenu = state.menus.find((m: Menu) => m.id === state.activeMenu)
  const currentCategory = currentMenu?.categories.find(c => c.id === state.activeCategory)
  const filteredItems = state.searchQuery && currentCategory
    ? currentCategory.menuItems.filter(item =>
        item.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(state.searchQuery.toLowerCase())
      )
    : currentCategory?.menuItems || []
  const cartItemCount = state.cart.reduce((s: number, i: CartItem) => s + i.quantity, 0)
  const subtotal = getSubtotal(state.cart)
  const promoDiscount = state.promoResult?.valid && state.promoResult.discount ? state.promoResult.discount.discountAmount : 0
  const total = getTotal(state.cart, state.orderType, state.deliveryZone, promoDiscount, DEFAULT_DELIVERY_FEE)

  const resetAfterConfirmation = useCallback(() => {
    state.setStep('menu')
    state.setOrderResult(null)
    state.setPromoCode('')
    state.setPromoResult(null)
    state.setDeliveryZone(null)
    state.setDeliveryZoneChecked(false)
  }, [state])

  return {
    // Stanje
    menus: state.menus, settings: state.settings, activeMenu: state.activeMenu, setActiveMenu: state.setActiveMenu,
    activeCategory: state.activeCategory, setActiveCategory: state.setActiveCategory,
    cart: state.cart, loading: state.loading, orderType: state.orderType, setOrderType: state.setOrderType,
    step: state.step, setStep: state.setStep,
    searchQuery: state.searchQuery, setSearchQuery: state.setSearchQuery, isDark: state.isDark, setIsDark: state.setIsDark,
    isOpenNow: state.isOpenNow, weeklyHours: state.weeklyHours, locations: state.locations,
    selectedLocation: state.selectedLocation, setSelectedLocation: state.setSelectedLocation,
    deliveryZone: state.deliveryZone, deliveryZoneChecked: state.deliveryZoneChecked,
    promoCode: state.promoCode, setPromoCode: state.setPromoCode,
    promoResult: state.promoResult, setPromoResult: state.setPromoResult,
    promoLoading: state.promoLoading, showHours: state.showHours, setShowHours: state.setShowHours,
    deliveryDetails: state.deliveryDetails, setDeliveryDetails: state.setDeliveryDetails,
    takeoutDetails: state.takeoutDetails, setTakeoutDetails: state.setTakeoutDetails,
    paymentMethod: state.paymentMethod, setPaymentMethod: state.setPaymentMethod,
    orderSending: state.orderSending, orderResult: state.orderResult, error: state.error, setError: state.setError,
    showItemDetail: state.showItemDetail, setShowItemDetail: state.setShowItemDetail,
    itemNotes: state.itemNotes, setItemNotes: state.setItemNotes,
    selectedMods: state.selectedMods, setSelectedMods: state.setSelectedMods,
    toggleModifier: actions.toggleModifier,
    // Izračuni
    currentMenu, currentCategory, filteredItems,
    cartItemCount, subtotal, total,
    getSubtotal: () => getSubtotal(state.cart),
    getDeliveryFee: () => getDeliveryFee(state.orderType, subtotal, state.deliveryZone, DEFAULT_DELIVERY_FEE),
    getMinOrderAmount: () => getMinOrderAmount(state.deliveryZone, DEFAULT_MIN_ORDER),
    getEstimatedMinutes: () => getEstimatedMinutes(state.orderType, state.deliveryZone, ESTIMATED_DELIVERY_MIN, ESTIMATED_TAKEOUT_MIN),
    getTotal: () => getTotal(state.cart, state.orderType, state.deliveryZone, promoDiscount, DEFAULT_DELIVERY_FEE),
    // Akcije
    addToCart: actions.addToCart, removeFromCart: actions.removeFromCart, updateQuantity: actions.updateQuantity,
    checkDeliveryZone: state.checkDeliveryZone, checkPromoCode: state.checkPromoCode, placeOrder: actions.placeOrder,
    resetAfterConfirmation,
    // Konstante (za prikaz)
    ESTIMATED_DELIVERY_MIN, ESTIMATED_TAKEOUT_MIN,
  }
}
