// =====================================================================
// QR Ordering - Derived value computation
// =====================================================================

import type { MenuType, MenuItemType } from '../../types';
import { drinkSuperGroups } from '../../types';

/** Get the super-group for a drink category name */
export function getSuperGroupForCategoryName(catName: string): string | null {
  for (const sg of drinkSuperGroups) {
    if (sg.keywords.some(kw => catName.toLowerCase().includes(kw.toLowerCase()))) {
      return sg.id;
    }
  }
  return null;
}

export interface DerivedValues {
  activeMenu: MenuType | undefined;
  isDrinksMenu: boolean;
  allCategories: MenuType['categories'];
  categories: MenuType['categories'];
  activeCategory: MenuType['categories'][number] | undefined;
  allMenuItems: (MenuItemType & { categoryName: string })[];
  searchResults: (MenuItemType & { categoryName: string })[];
  isSearching: boolean;
}

/** Compute all derived values from current state */
export function computeDerivedValues(params: {
  menus: MenuType[];
  activeMenuId: string;
  activeCategoryId: string;
  activeSuperGroup: string;
  searchQuery: string;
}): DerivedValues {
  const { menus, activeMenuId, activeCategoryId, activeSuperGroup, searchQuery } = params;

  const activeMenu = menus.find(m => m.id === activeMenuId);
  const isDrinksMenu = activeMenu?.name === 'Pijača';

  const allCategories = activeMenu?.categories || [];
  const categories = isDrinksMenu && activeSuperGroup !== 'all'
    ? allCategories.filter(cat => getSuperGroupForCategoryName(cat.name) === activeSuperGroup)
    : allCategories;

  const activeCategory = activeMenu?.categories.find(c => c.id === activeCategoryId);

  const allMenuItems = activeMenu?.categories.flatMap(cat =>
    cat.menuItems.map(item => ({ ...item, categoryName: cat.name })),
  ) || [];

  const searchResults = searchQuery.trim()
    ? allMenuItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : [];

  const isSearching = searchQuery.trim().length > 0;

  return { activeMenu, isDrinksMenu, allCategories, categories, activeCategory, allMenuItems, searchResults, isSearching };
}
