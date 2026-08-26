'use client'


import type { MenuItem, Modifier, ModifierGroup, CartItem } from '../types'

// ─── Cart operacije ──────────────────────────────────────────

export function addToCartLogic(
  prev: CartItem[],
  item: MenuItem,
  modifiers: Modifier[] = [],
  notes: string = '',
): CartItem[] {
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
}

export function removeFromCartLogic(prev: CartItem[], index: number): CartItem[] {
  return prev.filter((_, i) => i !== index)
}

export function updateQuantityLogic(prev: CartItem[], index: number, delta: number): CartItem[] {
  const updated = [...prev]
  updated[index] = { ...updated[index], quantity: updated[index].quantity + delta }
  if (updated[index].quantity <= 0) updated.splice(index, 1)
  return updated
}

// ─── Izračuni ────────────────────────────────────────────────

export function getSubtotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => {
    const modPrice = item.selectedModifiers.reduce((s, m) => s + (m.price || 0), 0)
    return sum + (item.menuItem.price + modPrice) * item.quantity
  }, 0)
}

export function getDeliveryFee(
  orderType: string,
  subtotal: number,
  deliveryZone: { deliveryFee: number; freeDeliveryAbove: number } | null,
  defaultFee: number,
): number {
  if (orderType !== 'delivery') return 0
  if (deliveryZone) {
    if (deliveryZone.freeDeliveryAbove > 0 && subtotal >= deliveryZone.freeDeliveryAbove) return 0
    return deliveryZone.deliveryFee
  }
  return defaultFee
}

export function getMinOrderAmount(
  deliveryZone: { minOrderAmount: number } | null,
  defaultMin: number,
): number {
  return deliveryZone?.minOrderAmount || defaultMin
}

export function getEstimatedMinutes(
  orderType: string,
  deliveryZone: { estimatedMinutes: number } | null,
  deliveryMin: number,
  takeoutMin: number,
): number {
  if (orderType === 'takeout') return takeoutMin
  return deliveryZone?.estimatedMinutes || deliveryMin
}

export function getTotal(
  cart: CartItem[],
  orderType: string,
  deliveryZone: { deliveryFee: number; freeDeliveryAbove: number } | null,
  promoDiscount: number,
  defaultDeliveryFee: number,
): number {
  const sub = getSubtotal(cart)
  const vat = cart.reduce((sum, item) => {
    const modPrice = item.selectedModifiers.reduce((s, m) => s + (m.price || 0), 0)
    const basePrice = item.menuItem.price + modPrice
    return sum + basePrice * (item.menuItem.vatRate / 100) * item.quantity
  }, 0)
  const deliveryFee = getDeliveryFee(orderType, sub, deliveryZone, defaultDeliveryFee)
  return Math.max(0, sub + vat + deliveryFee - promoDiscount)
}

// ─── Modifier toggle ─────────────────────────────────────────

export function toggleModifierLogic(
  prev: Modifier[],
  mod: Modifier,
  group: ModifierGroup,
): Modifier[] {
  const groupMods = prev.filter(m => group.modifiers.some(gm => gm.id === m.id))
  const otherMods = prev.filter(m => !group.modifiers.some(gm => gm.id === m.id))
  const exists = groupMods.find(m => m.id === mod.id)
  if (exists) return [...otherMods, ...groupMods.filter(m => m.id !== mod.id)]
  if (group.maxSelect && groupMods.length >= group.maxSelect) {
    const updated = [...groupMods.slice(1), mod]
    return [...otherMods, ...updated]
  }
  return [...otherMods, mod]
}
