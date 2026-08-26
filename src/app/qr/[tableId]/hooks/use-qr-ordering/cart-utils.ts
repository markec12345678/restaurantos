// =====================================================================
// QR Ordering - Pure cart helper functions
// =====================================================================

import type { CartItem, MenuItemType } from '../../types';

/** Add item to cart without a note (pure — returns new cart array) */
export function addItemToCart(prev: CartItem[], item: MenuItemType): CartItem[] {
  const existing = prev.find(c => c.menuItemId === item.id && c.notes === '');
  if (existing) {
    return prev.map(c =>
      c.menuItemId === item.id && c.notes === ''
        ? { ...c, quantity: c.quantity + 1 }
        : c,
    );
  }
  return [...prev, {
    menuItemId: item.id,
    name: item.name,
    price: item.price,
    vatRate: item.vatRate,
    image: item.image,
    quantity: 1,
    notes: '',
  }];
}

/** Add item to cart with a note (pure — returns new cart array) */
export function addItemToCartWithNote(prev: CartItem[], item: MenuItemType, note: string): CartItem[] {
  const trimmedNote = note.trim();
  const existing = prev.find(c => c.menuItemId === item.id && c.notes === trimmedNote);
  if (existing) {
    return prev.map(c =>
      c.menuItemId === item.id && c.notes === trimmedNote
        ? { ...c, quantity: c.quantity + 1 }
        : c,
    );
  }
  return [...prev, {
    menuItemId: item.id,
    name: item.name,
    price: item.price,
    vatRate: item.vatRate,
    image: item.image,
    quantity: 1,
    notes: trimmedNote,
  }];
}

/** Update item quantity by menuItemId + notes combo (pure) */
export function updateCartItemQuantity(
  prev: CartItem[],
  menuItemId: string,
  notes: string,
  delta: number,
): CartItem[] {
  return prev
    .map(c => {
      if (c.menuItemId === menuItemId && c.notes === notes) {
        return { ...c, quantity: c.quantity + delta };
      }
      return c;
    })
    .filter(c => c.quantity > 0);
}

/** Remove item by menuItemId + notes combo (pure) */
export function removeCartItem(
  prev: CartItem[],
  menuItemId: string,
  notes: string,
): CartItem[] {
  return prev.filter(c => !(c.menuItemId === menuItemId && c.notes === notes));
}

/** Calculate total item count in cart */
export function calculateCartCount(cart: CartItem[]): number {
  return cart.reduce((sum, c) => sum + c.quantity, 0);
}

/** Calculate cart subtotal (without tax) */
export function calculateCartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
}

/** Calculate total tax in cart */
export function calculateCartTax(cart: CartItem[]): number {
  return cart.reduce((sum, c) => sum + c.price * c.quantity * (c.vatRate / 100), 0);
}
