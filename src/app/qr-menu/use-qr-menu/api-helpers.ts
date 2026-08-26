// =====================================================================
// QR Menu - Data fetching & order submission helpers
// =====================================================================

import type { Category, OrderResult, UpsellSuggestion, CartItem } from '../types';
import type { FontSize } from './types';

export interface InitPreferences {
  prefersDark: boolean;
  prefersContrast: boolean;
  savedFontSize: FontSize | null;
  tableParam: string | null;
}

/** Read initial preferences from browser APIs */
export function readInitPreferences(): InitPreferences {
  const params = new URLSearchParams(window.location.search);
  return {
    prefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
    prefersContrast: window.matchMedia('(prefers-contrast: more)').matches,
    savedFontSize: localStorage.getItem('qr-font-size') as FontSize | null,
    tableParam: params.get('table'),
  };
}

/** Fetch menu data from API, returns menus + settings + initial active IDs */
export async function fetchMenuData(): Promise<{
  menus: unknown[];
  settings: unknown;
  initialMenuId: string;
  initialCategoryId: string;
} | null> {
  const res = await fetch('/api/public/menu');
  if (!res.ok) throw new Error('Meni trenutno ni na voljo');
  const data = await res.json();
  const menus = data.menus || [];
  const settings = data.settings || {};
  let initialMenuId = '';
  let initialCategoryId = '';
  if (menus.length > 0) {
    initialMenuId = menus[0].id;
    initialCategoryId = menus[0].categories?.[0]?.id || '';
  }
  return { menus, settings, initialMenuId, initialCategoryId };
}

/** Find initial category based on time-of-day promoted prefixes */
export function findTimeOfDayCategory(
  categories: Category[] | undefined,
  promotedPrefix: string[],
): string {
  if (!categories) return '';
  const matchingCat = categories.find(c => promotedPrefix.some(p => c.name.startsWith(p)));
  return matchingCat?.id || categories[0]?.id || '';
}

/** Fetch AI upsell suggestions */
export async function fetchUpsellData(
  cart: CartItem[],
  categoryName: string,
): Promise<UpsellSuggestion[]> {
  const cartItems = cart.map(c => ({
    menuItemId: c.menuItem.id,
    name: c.menuItem.name,
    category: categoryName,
    price: c.menuItem.price,
  }));
  const res = await fetch('/api/ai/qr-upsell', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cartItems, hour: new Date().getHours() }),
  });
  const data = await res.json();
  if (data.suggestions) {
    return data.suggestions.filter((s: UpsellSuggestion) =>
      !cart.find(c => c.menuItem.id === s.menuItemId),
    );
  }
  return [];
}

/** Build order items payload from cart */
export function buildOrderItems(cart: CartItem[]) {
  return cart.map(item => ({
    menuItemId: item.menuItem.id,
    quantity: item.quantity,
    price: item.menuItem.price,
    vatRate: item.menuItem.vatRate,
    notes: item.notes,
    modifiersJson: JSON.stringify(item.selectedModifiers),
  }));
}

/** Submit QR order, returns result */
export async function submitOrderRequest(
  tableNumber: string,
  cart: CartItem[],
): Promise<OrderResult> {
  const res = await fetch('/api/public/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tableNumber,
      customerName: `QR Miza ${tableNumber || '?'}`,
      notes: `QR naročilo - Miza ${tableNumber || '?'}`,
      items: buildOrderItems(cart),
    }),
  });
  const data = await res.json();
  if (res.ok && data.success) {
    return data;
  }
  return { success: false, error: data.error || 'Napaka pri naročanju' };
}
