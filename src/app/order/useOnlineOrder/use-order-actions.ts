'use client'

import { useCallback } from 'react'
import type { MenuItem, Modifier, ModifierGroup, CartItem, DeliveryDetails, TakeoutDetails, DeliveryZoneInfo, PromoResult, OrderType, CheckoutStep } from '../types'
import type { OrderResultRow } from '@/lib/types'
import {
  addToCartLogic, removeFromCartLogic, updateQuantityLogic,
  getSubtotal, getDeliveryFee, toggleModifierLogic,
} from './cart-utils'
import { submitOrderApi } from './api-helpers'
import { DEFAULT_DELIVERY_FEE } from '../constants'

// =====================================================================
// Akcije naročilne platforme (cart, modifikatorji, oddaja naročila)
// =====================================================================

export function useOrderActions(state: {
  cart: CartItem[]
  setCart: (_cart: CartItem[]) => void
  setShowItemDetail: (_item: MenuItem | null) => void
  setItemNotes: (_notes: string) => void
  setSelectedMods: (_mods: Modifier[] | ((_prev: Modifier[]) => Modifier[])) => void
  setOrderSending: (_sending: boolean) => void
  setOrderResult: (_result: OrderResultRow | null) => void
  setStep: (_step: CheckoutStep) => void
  setError: (_error: string) => void
  orderType: OrderType
  deliveryZone: DeliveryZoneInfo | null
  promoCode: string
  promoResult: PromoResult | null
  paymentMethod: 'card' | 'cash' | 'mobile'
  deliveryDetails: DeliveryDetails
  takeoutDetails: TakeoutDetails
  selectedLocation: string
}) {
  const addToCart = useCallback((item: MenuItem, modifiers: Modifier[] = [], notes: string = '') => {
    state.setCart(addToCartLogic(state.cart, item, modifiers, notes))
    state.setShowItemDetail(null)
    state.setItemNotes('')
    state.setSelectedMods([])
  }, [state.cart, state.setCart, state.setShowItemDetail, state.setItemNotes, state.setSelectedMods])

  const removeFromCart = useCallback((index: number) => {
    state.setCart(removeFromCartLogic(state.cart, index))
  }, [state.cart, state.setCart])

  const updateQuantity = useCallback((index: number, delta: number) => {
    state.setCart(updateQuantityLogic(state.cart, index, delta))
  }, [state.cart, state.setCart])

  const toggleModifier = useCallback((mod: Modifier, group: ModifierGroup) => {
    state.setSelectedMods(prev => toggleModifierLogic(prev, mod, group))
  }, [state.setSelectedMods])

  async function placeOrder() {
    if (state.cart.length === 0) return
    state.setOrderSending(true)
    try {
      const deliveryFee = getDeliveryFee(state.orderType, getSubtotal(state.cart), state.deliveryZone, DEFAULT_DELIVERY_FEE)
      const result = await submitOrderApi({
        orderType: state.orderType,
        cart: state.cart,
        paymentMethod: state.paymentMethod,
        deliveryDetails: state.deliveryDetails,
        takeoutDetails: state.takeoutDetails,
        deliveryFee,
        promoCode: state.promoCode,
        promoResult: state.promoResult,
        selectedLocation: state.selectedLocation,
      })
      if (result.success && result.data) {
        state.setCart([])
        state.setOrderResult(result.data)
        state.setStep('confirmation')
      } else {
        alert(result.error || 'Napaka pri naročanju')
      }
    } catch {
      state.setError('Napaka pri oddaji naročila.')
    } finally {
      state.setOrderSending(false)
    }
  }

  return { addToCart, removeFromCart, updateQuantity, toggleModifier, placeOrder }
}
