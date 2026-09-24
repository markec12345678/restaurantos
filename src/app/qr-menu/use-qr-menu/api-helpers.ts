// =====================================================================
// QR Menu - Data fetching & order submission helpers
// =====================================================================

import type { Category, Menu, MenuItem, OrderResult, UpsellSuggestion, CartItem } from '../types';
import type { FontSize } from './types';

export interface InitPreferences {
  prefersDark: boolean;
  prefersContrast: boolean;
  savedFontSize: FontSize | null;
  tableParam: string | null;
  // R87-3: izrecen lokacijski kontekst iz URL (?locationId ali ?location) —
  // multi-tenant QR URL-ji naj ga kodirajo; fallback je settings.id iz menija.
  locationParam: string | null;
}

/** Read initial preferences from browser APIs */
export function readInitPreferences(): InitPreferences {
  const params = new URLSearchParams(window.location.search);
  return {
    prefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
    prefersContrast: window.matchMedia('(prefers-contrast: more)').matches,
    savedFontSize: localStorage.getItem('qr-font-size') as FontSize | null,
    tableParam: params.get('table'),
    locationParam: params.get('locationId') || params.get('location'),
  };
}

/** Fetch menu data from API, returns menus + settings + initial active IDs.
 * R87-3: če URL nosi ?locationId, se meni poizvede ZA TO lokacijo (isti
 * kontekst, za katerega bo žigosano naročilo — pisna pot je fail-closed). */
export async function fetchMenuData(locationId?: string | null): Promise<{
  menus: unknown[];
  settings: unknown;
  initialMenuId: string;
  initialCategoryId: string;
} | null> {
  const qs = locationId ? `?locationId=${encodeURIComponent(locationId)}` : '';
  const res = await fetch(`/api/public/menu${qs}`);
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

/** Submit QR order, returns result.
 * R87-3: pošlje izrecen locationId (lokacija, za katero je prikazan meni —
 * settings.id iz /api/public/menu je locationId). Pisna pot strežnika je
 * fail-closed: brez lokacijskega konteksta → 400, tuja/neaktivna → 404. */
export async function submitOrderRequest(
  tableNumber: string,
  cart: CartItem[],
  locationId?: string | null,
): Promise<OrderResult> {
  const res = await fetch('/api/public/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tableNumber,
      locationId: locationId || undefined,
      customerName: `QR Miza ${tableNumber || '?'}`,
      notes: `QR naročilo - Miza ${tableNumber || '?'}`,
      items: buildOrderItems(cart),
    }),
  });
  const data = await res.json();
  if (res.ok && data.success) {
    return data;
  }
  // R124 (P0-03): 409 (INSUFFICIENT_STOCK) ali 400 z unavailableItems —
  // razločno sporočilo (kanon: strežnik je avtoriteten).
  const soldOut = res.status === 409
    || Array.isArray(data.unavailableItems)
    || /zaloge|izprodan/i.test(String(data.error || ''));
  if (soldOut) {
    return { success: false, error: 'Nekateri artikli so medtem izprodali. Osvežite meni in poskusite znova.' };
  }
  return { success: false, error: data.error || 'Napaka pri naročanju' };
}

// =====================================================================
// R124-c: real-time availability (sold-out propagation za goste)
// =====================================================================
// GET /api/public/availability?locationId=... je no-store endpoint (za
// razliko od public/menu, ki je cachean 5 min prek CDN-ja) — pollamo ga
// vsakih 30 s in merge-amo odgovor v OBSTOJEČI menuItems state (immutable,
// brez clobberjanja košarice in ostalega stanja). Napaka/offline → tiho
// obdržimo zadnje znano stanje, retry naslednji tick (brez toast spam-a).

/** Vnos iz javnega availability endpointa (minimalen payload — brez unit) */
export interface AvailabilityEntry {
  stockStatus?: string;
  stockAvailable?: number | null;
}

export type AvailabilityMap = Record<string, AvailabilityEntry>;

/** Pridobi trenutno razpoložljivost; null ob napaki (tiho — retry naslednji tick). */
export async function fetchAvailabilityData(locationId: string): Promise<AvailabilityMap | null> {
  try {
    const res = await fetch(`/api/public/availability?locationId=${encodeURIComponent(locationId)}`);
    if (!res.ok) return null; // 404 / 429 / 5xx → obdržimo zadnje znano stanje
    const data: unknown = await res.json();
    if (!data || typeof data !== 'object' || !('availability' in data)) return null;
    const availability: unknown = (data as { availability?: unknown }).availability;
    if (!availability || typeof availability !== 'object') return null;
    return availability as AvailabilityMap;
  } catch {
    return null; // offline — tiho
  }
}

/** Veljavne vrednosti stockStatus iz kanona ('ok' | 'low' | 'out') */
function isValidStatus(status: unknown): status is NonNullable<MenuItem['stockStatus']> {
  return status === 'ok' || status === 'low' || status === 'out';
}

/** Merge availability v obstoječi meni (immutable update → re-render).
 * Artikli brez vnosa ohranijo trenutne vrednosti (untracked); stockUnit
 * endpoint ne pošilja (minimalen javni payload) → ostane nespremenjen. */
export function mergeAvailabilityIntoMenus(menus: Menu[], availability: AvailabilityMap): Menu[] {
  const nextMenus = menus.map(menu => {
    let menuChanged = false;
    const nextCategories = menu.categories.map(category => {
      let categoryChanged = false;
      const nextItems = category.menuItems.map(item => {
        const entry = availability[item.id];
        if (!entry) return item; // untracked / manjkajoč → ohrani trenutno
        let status = item.stockStatus;
        let available = item.stockAvailable;
        if (isValidStatus(entry.stockStatus)) status = entry.stockStatus;
        if (entry.stockAvailable === null || typeof entry.stockAvailable === 'number') {
          available = entry.stockAvailable;
        }
        if (status === item.stockStatus && available === item.stockAvailable) return item;
        categoryChanged = true;
        return { ...item, stockStatus: status, stockAvailable: available };
      });
      if (!categoryChanged) return category;
      menuChanged = true;
      return { ...category, menuItems: nextItems };
    });
    if (!menuChanged) return menu;
    return { ...menu, categories: nextCategories };
  });
  // Če se nič ni spremenilo, vrnemo ISTO referenco (React preskoči re-render).
  for (let i = 0; i < nextMenus.length; i++) {
    if (nextMenus[i] !== menus[i]) return nextMenus;
  }
  return menus;
}

/** Najdi artikel po id čez vse menije/kategorije (za uskladitev odprtega modala). */
export function findMenuItemById(menus: Menu[], id: string): MenuItem | null {
  for (const menu of menus) {
    for (const category of menu.categories) {
      const found = category.menuItems.find(i => i.id === id);
      if (found) return found;
    }
  }
  return null;
}
