// =====================================================================
// MENU ARTIKLI - Types
// =====================================================================

// R192: dinamične reference (id + preostali ključi) — uporaba bere samo .id
export type CategoryRef = { id: string; [key: string]: unknown }
export type ModifierRef = { id: string; [key: string]: unknown }

export interface MenuItemSeed {
  name: string
  description: string
  price: number
  categoryId: string
  sortOrder: number
  image: string
  modifierGroupIds: string[]
  // FIX AUDIT: DDV stopnja — 9.5 za hrano in brezalkoholne pijače, 22 za alkohol
  vatRate?: number
  // FIX AUDIT: Alergeni — EU 1169/2011 (npr. "1,3,7" za gluten, mleko, jajca)
  allergens?: string
}
