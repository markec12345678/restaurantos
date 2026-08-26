import type { Locale } from './translations'

// ============================================
// TIPI
// ============================================
export interface MenuItemType {
  id: string
  name: string
  description: string
  price: number
  image: string
  vatRate: number
  allergens: string
  categoryId: string
}

export interface CategoryType {
  id: string
  name: string
  icon: string
  color: string
  sortOrder: number
  menuItems: MenuItemType[]
}

export interface MenuType {
  id: string
  name: string
  icon: string
  color: string
  categories: CategoryType[]
}

export interface CartItem {
  menuItemId: string
  name: string
  price: number
  vatRate: number
  image: string
  quantity: number
  notes: string
}

export interface RestaurantInfo {
  name: string
  address: string
  city: string
  phone: string
  email: string
  web: string
  currency: string
}

export interface OrderResult {
  orderNumber: number
  orderId: string
  tableNumber: number
}

// ============================================
// ALLERGEN MAPA
// ============================================
// FIX ALLER-03 HIGH: Pravilne EU alergenske ikone po Uredbi 1169/2011
// Prejšnja koda je imela NAPAČNE ikone za 9 od 14 alergenov — varnostno tveganje za stranke
export const allergenLabels: Record<string, string> = {
  '1': '\u{1F33E}',  // Gluten
  '2': '\u{1F990}',  // Raki (Crustaceans)
  '3': '\u{1F95A}',  // Jajca (Eggs)
  '4': '\u{1F41F}',  // Ribe (Fish)
  '5': '\u{1F95C}',  // Arašidi (Peanuts)
  '6': '\u{1FAD8}',  // Soja (Soybeans)
  '7': '\u{1F95B}',  // Mleko (Milk)
  '8': '\u{1F330}',  // Oreški (Tree nuts)
  '9': '\u{1F96C}',  // Zelenina/Celer (Celery)
  '10': '\u{1F7E1}', // Gorčica (Mustard)
  '11': '\u26AA',    // Sezam (Sesame)
  '12': '\u{1F9EA}', // Sulfiti (Sulphites)
  '13': '\u{1FAD8}', // Volčji bob (Lupin)
  '14': '\u{1F41A}', // Mehkužci (Molluscs)
}

export const statusIcons: Record<string, string> = {
  pending: '\u23F3',
  'in-progress': '\u{1F468}\u200D\u{1F373}',
  ready: '\u2705',
  completed: '\u{1F389}',
}

export const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  ready: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-gray-100 text-gray-800',
}

export const locales: { code: Locale; flag: string; label: string }[] = [
  { code: 'sl', flag: '\u{1F1F8}\u{1F1EE}', label: 'Slovenščina' },
  { code: 'en', flag: '\u{1F1EC}\u{1F1E7}', label: 'English' },
  { code: 'it', flag: '\u{1F1EE}\u{1F1F9}', label: 'Italiano' },
  { code: 'de', flag: '\u{1F1E9}\u{1F1EA}', label: 'Deutsch' },
  { code: 'hr', flag: '\u{1F1ED}\u{1F1F7}', label: 'Hrvatski' },
]

// ============================================
// SUPER-GROUP DEFINITIONS FOR DRINKS
// ============================================
export const drinkSuperGroups: { id: string; keywords: string[] }[] = [
  { id: 'wines', keywords: ['Vino', 'Rdeča vina', 'Bela vina', 'Rose vina'] },
  { id: 'beers', keywords: ['Pivo', 'Točeno pivo'] },
  { id: 'spirits', keywords: ['Žganje', 'Lik', 'Raki', 'Whisky', 'Vodka', 'Rum', 'Gin', 'Tekila', 'Konjak'] },
  { id: 'beverages', keywords: ['Kava', 'Čaj', 'Topli napitki', 'Smoothie', 'Milkshake'] },
  { id: 'nonAlcoholic', keywords: ['Sok', 'Voda', 'Mineralna', 'Limonada', 'Brezalkoholn', 'Gazirana', 'Negazirana'] },
]
