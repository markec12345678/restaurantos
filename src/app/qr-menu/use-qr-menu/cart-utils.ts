// =====================================================================
// QR Menu - Pure cart helper functions
// =====================================================================

import type { CartItem, MenuItem, Modifier } from '../types';

/** Calculate cart total (without VAT) */
export function calculateCartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => {
    const modPrice = item.selectedModifiers.reduce((s, m) => s + (m.price || 0), 0);
    return sum + (item.menuItem.price + modPrice) * item.quantity;
  }, 0);
}

/** Calculate cart total including VAT */
export function calculateCartTotalWithVat(cart: CartItem[]): number {
  return cart.reduce((sum, item) => {
    const modPrice = item.selectedModifiers.reduce((s, m) => s + (m.price || 0), 0);
    const basePrice = item.menuItem.price + modPrice;
    const vatMultiplier = 1 + item.menuItem.vatRate / 100;
    return sum + basePrice * vatMultiplier * item.quantity;
  }, 0);
}

/** Get total item count in cart */
export function getCartItemCount(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

/** Build a stable cart key for a menu item + modifiers combo */
export function buildCartItemKey(item: MenuItem, modifiers: Modifier[]): string {
  return `${item.id}-${modifiers.map(m => m.id).sort().join(',')}`;
}

/** Add item to cart (pure — returns new cart array) */
export function addItemToCart(
  prev: CartItem[],
  item: MenuItem,
  modifiers: Modifier[] = [],
  notes: string = '',
): CartItem[] {
  const key = buildCartItemKey(item, modifiers);
  const existing = prev.findIndex(c => buildCartItemKey(c.menuItem, c.selectedModifiers) === key);
  if (existing >= 0) {
    const updated = [...prev];
    updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 };
    return updated;
  }
  return [...prev, { menuItem: item, quantity: 1, selectedModifiers: modifiers, notes }];
}

/** Remove item from cart by index (pure) */
export function removeCartItemByIndex(prev: CartItem[], index: number): CartItem[] {
  return prev.filter((_, i) => i !== index);
}

/** Update item quantity by index (pure) */
export function updateCartItemQuantity(prev: CartItem[], index: number, delta: number): CartItem[] {
  const updated = [...prev];
  updated[index] = { ...updated[index], quantity: updated[index].quantity + delta };
  if (updated[index].quantity <= 0) updated.splice(index, 1);
  return updated;
}
