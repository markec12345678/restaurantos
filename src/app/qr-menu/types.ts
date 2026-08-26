// =====================================================================
// QR Menu - Tipi in vmesniki
// =====================================================================

export interface Modifier {
  id: string;
  name: string;
  price: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number | null;
  modifiers: Modifier[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  vatRate: number;
  allergens: string;
  image: string;
  sortOrder: number;
  modifierGroups: { sortOrder: number; modifierGroup: ModifierGroup }[];
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  menuItems: MenuItem[];
}

export interface Menu {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  categories: Category[];
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  selectedModifiers: Modifier[];
  notes: string;
}

export interface OrderResult {
  success: boolean;
  order?: {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    estimatedTime: string;
    tableNumber: string | null;
  };
  error?: string;
}

export interface UpsellSuggestion {
  menuItemId: string;
  name: string;
  price: number;
  category: string;
  reason: string;
  type: 'pairing' | 'time-of-day' | 'popular';
}

export interface TimeOfDay {
  key: string;
  label: string;
  icon: string;
  promotedPrefix: string[];
}
