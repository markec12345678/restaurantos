// =====================================================================
// QR Ordering - Exported types
// =====================================================================

import type { CartItem, MenuType, MenuItemType, OrderResult, RestaurantInfo } from '../../types';
import type { Locale } from '../../translations';

export interface QROrderingState {
  // State
  tableId: string;
  locale: Locale;
  setLocale: (_locale: Locale) => void;
  menus: MenuType[];
  restaurant: RestaurantInfo | null;
  activeMenuId: string;
  setActiveMenuId: (_id: string) => void;
  activeCategoryId: string;
  setActiveCategoryId: (_id: string) => void;
  cart: CartItem[];
  cartOpen: boolean;
  setCartOpen: (_open: boolean) => void;
  customerName: string;
  setCustomerName: (_name: string) => void;
  customerPhone: string;
  setCustomerPhone: (_phone: string) => void;
  orderNotes: string;
  setOrderNotes: (_notes: string) => void;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  setError: (_error: string | null) => void;
  orderResult: OrderResult | null;
  orderStatus: string;
  localeOpen: boolean;
  setLocaleOpen: (_open: boolean) => void;
  tableNotFound: boolean;
  searchQuery: string;
  setSearchQuery: (_query: string) => void;
  detailItem: MenuItemType | null;
  setDetailItem: (_item: MenuItemType | null) => void;
  detailNote: string;
  setDetailNote: (_note: string) => void;
  waiterCalled: boolean;
  waiterCooldown: boolean;
  activeSuperGroup: string;
  setActiveSuperGroup: (_group: string) => void;

  // Derived
  t: import('../../translations').TranslationValue;
  cartCount: number;
  cartTotal: number;
  cartTax: number;
  activeMenu: MenuType | undefined;
  isDrinksMenu: boolean;
  allCategories: MenuType['categories'];
  categories: MenuType['categories'];
  activeCategory: MenuType['categories'][number] | undefined;
  allMenuItems: (MenuItemType & { categoryName: string })[];
  searchResults: (MenuItemType & { categoryName: string })[];
  isSearching: boolean;

  // Handlers
  addToCart: (_item: MenuItemType) => void;
  addToCartWithNote: (_item: MenuItemType, _note: string) => void;
  updateQuantity: (_menuItemId: string, _notes: string, _delta: number) => void;
  removeItem: (_menuItemId: string, _notes: string) => void;
  callWaiter: () => void;
  submitOrder: () => Promise<void>;
  getSuperGroupForCategory: (_catName: string) => string | null;
  dismissOrderResult: () => void;
}

// Re-export types used by QROrderingState
export type { CartItem, MenuType, MenuItemType, OrderResult, RestaurantInfo, Locale };
