// =====================================================================
// R124-c: real-time availability (sold-out propagation za goste)
// =====================================================================
// GET /api/public/availability?locationId=... je no-store endpoint (za
// razliko od public/menu, ki je cachean 5 min prek CDN-ja) — pollamo ga
// vsakih 30 s in merge-amo odgovor v OBSTOJEČI menuItems state (immutable,
// brez clobberjanja košarice in ostalega stanja). Napaka/offline → tiho
// obdržimo zadnje znano stanje, retry naslednji tick (brez toast spam-a).

import type { MenuType, MenuItemType } from '../../types';

/** Vnos iz javnega availability endpointa (minimalen payload — brez unit) */
export interface AvailabilityEntry {
  stockStatus?: string;
  stockAvailable?: number | null;
}

export type AvailabilityMap = Record<string, AvailabilityEntry>;

/** Pridobi trenutno razpoložljivost; null ob napaki (tiho — retry naslednji tick). */
export async function fetchAvailability(locationId: string): Promise<AvailabilityMap | null> {
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
function isValidStatus(status: unknown): status is NonNullable<MenuItemType['stockStatus']> {
  return status === 'ok' || status === 'low' || status === 'out';
}

/** Merge availability v obstoječi meni (immutable update → re-render).
 * Artikli brez vnosa ohranijo trenutne vrednosti (untracked); stockUnit
 * endpoint ne pošilja (minimalen javni payload) → ostane nespremenjen. */
export function mergeAvailabilityIntoMenus(menus: MenuType[], availability: AvailabilityMap): MenuType[] {
  let menusChanged = false;
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
  // Če se nič ni spremenilo, zadržimo ISTO referenco (React tako preskoči
  // nepotreben re-render); menuChanged postavijo zgornji bloki.
  for (let i = 0; i < nextMenus.length; i++) {
    if (nextMenus[i] !== menus[i]) { menusChanged = true; break; }
  }
  return menusChanged ? nextMenus : menus;
}

/** Najdi artikel po id čez vse menije/kategorije (za uskladitev odprtega modala). */
export function findMenuItemById(menus: MenuType[], id: string): MenuItemType | null {
  for (const menu of menus) {
    for (const category of menu.categories) {
      const found = category.menuItems.find(i => i.id === id);
      if (found) return found;
    }
  }
  return null;
}
