// =====================================================================
// QR Menu - Exported types for useQRMenu hook
// =====================================================================

import type { Menu, Category, MenuItem, Modifier, ModifierGroup, CartItem, OrderResult, UpsellSuggestion, TimeOfDay } from '../types';

export type FontSize = 'normal' | 'large' | 'xl';

export interface QRMenuState {
  // Podatki
  menus: Menu[];
  settings: RestaurantSettingsRow | null;
  activeMenu: string;
  activeCategory: string;
  cart: CartItem[];
  showCart: boolean;
  tableNumber: string;
  loading: boolean;
  orderPlaced: boolean;
  orderResult: OrderResult | null;
  orderSending: boolean;
  error: string;
  searchQuery: string;
  // EAA 2026: Dostopnost
  isDark: boolean;
  isHighContrast: boolean;
  fontSize: FontSize;
  // Item detail modal
  showItemDetail: MenuItem | null;
  itemNotes: string;
  selectedMods: Modifier[];
  // AI Personalizacija
  upsellSuggestions: UpsellSuggestion[];
  timeOfDay: TimeOfDay;
  upsellLoading: boolean;
  showAllergenInfo: boolean;
  // Refs
  mainRef: React.RefObject<HTMLDivElement | null>;
  searchRef: React.RefObject<HTMLInputElement | null>;
  cartBtnRef: React.RefObject<HTMLButtonElement | null>;
  allergenPanelRef: React.RefObject<HTMLDivElement | null>;
  itemDetailRef: React.RefObject<HTMLDivElement | null>;
  cartDrawerRef: React.RefObject<HTMLDivElement | null>;
  // Izpeljane vrednosti
  currentMenu: Menu | undefined;
  currentCategory: Category | undefined;
  filteredItems: MenuItem[];
  reorderedCategories: Category[];
  cartItemCount: number;
  // Akcije
  setActiveMenu: (_id: string) => void;
  setActiveCategory: (_id: string) => void;
  setShowCart: (_show: boolean) => void;
  setOrderPlaced: (_placed: boolean) => void;
  setOrderResult: (_result: OrderResult | null) => void;
  setShowItemDetail: (_item: MenuItem | null) => void;
  setItemNotes: (_notes: string) => void;
  setSearchQuery: (_query: string) => void;
  setIsDark: (_dark: boolean) => void;
  setIsHighContrast: (_contrast: boolean) => void;
  setFontSize: (_size: FontSize) => void;
  setShowAllergenInfo: (_show: boolean) => void;
  addToCart: (_item: MenuItem, _modifiers?: Modifier[], _notes?: string) => void;
  removeFromCart: (_index: number) => void;
  updateQuantity: (_index: number, _delta: number) => void;
  getTotal: () => number;
  getTotalWithVat: () => number;
  placeOrder: () => Promise<void>;
  openItemDetail: (_item: MenuItem) => void;
  toggleModifier: (_mod: Modifier, _mg: ModifierGroup) => void;
  validateModifierGroups: () => string | null;
  skipToMain: () => void;
  setError: (_error: string) => void;
}

// Re-export types used by QRMenuState so consumers don't need deep imports
export type { Menu, Category, MenuItem, Modifier, ModifierGroup, CartItem, OrderResult, UpsellSuggestion, TimeOfDay };

// Import RestaurantSettingsRow for local use
import type { RestaurantSettingsRow } from '@/lib/types';
export type { RestaurantSettingsRow };
