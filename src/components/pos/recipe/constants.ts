// ============================================
// TIPI IN KONSTANTE ZA RECEPTE
// ============================================

/** Podatki o posamezni sestavini recepta */
export interface RecipeItemData {
  id: string
  menuItemId: string
  inventoryItemId: string
  quantityPerServing: number
  unit: string
  notes: string
  menuItem: { id: string; name: string; price: number }
  inventoryItem: { id: string; name: string; unit: string; costPerUnit: number; quantity: number }
  costPerServing: number
}

/** Podatki o meni artiklu */
export interface MenuItemData {
  id: string
  name: string
  price: number
  vatRate: number
  category: { id: string; name: string; menu: { id: string; name: string } }
  inventory?: { id: string; name: string; costPerServing: number } | null
}

/** Podatki o založnem artiklu */
export interface InventoryData {
  id: string
  name: string
  unit: string
  costPerUnit: number
  quantity: number
  category: string
}

/** Skupina receptov z dodanimi izračuni */
export interface RecipeGroupItem extends MenuItemData {
  recipes: RecipeItemData[]
  totalCost: number
  hasRecipe: boolean
}

/** Podatki o marži za posamezni artikel */
export interface MarginItem {
  id: string
  name: string
  price: number
  cost: number
  marginEur: number
  marginPct: number
  hasRecipe: boolean
  recipeCount: number
  category: string
  menu: string
}

/** Statistika marž */
export interface MarginStats {
  avgMargin: number
  below40: number
  noRecipe: number
  totalItems: number
  withCostCount: number
}

/** Oblika za dodajanje sestavine */
export interface AddFormState {
  menuItemId: string
  inventoryItemId: string
  quantityPerServing: string
  unit: string
  notes: string
}

/** Oblika za urejanje sestavine */
export interface EditFormState {
  quantityPerServing: string
  unit: string
  notes: string
}

/** Skupine receptov po menijih */
export interface RecipeGroups {
  hrana: RecipeGroupItem[]
  pijaca: RecipeGroupItem[]
}

// ============================================
// POMOŽNE FUNKCIJE ZA BARVE MARŽ
// ============================================

/** Barva besedila glede na maržo */
export const marginColor = (pct: number): string => {
  if (pct >= 60) return 'text-emerald-600'
  if (pct >= 40) return 'text-amber-600'
  return 'text-red-600'
}

/** Barva ozadja glede na maržo */
export const marginBg = (pct: number): string => {
  if (pct >= 60) return 'bg-emerald-50 dark:bg-emerald-950/30'
  if (pct >= 40) return 'bg-amber-50 dark:bg-amber-950/30'
  return 'bg-red-50 dark:bg-red-950/30'
}

/** Barva značke glede na maržo */
export const marginBadge = (pct: number): string => {
  if (pct >= 60) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
  if (pct >= 40) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
}
