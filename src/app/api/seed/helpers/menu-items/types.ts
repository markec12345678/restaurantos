// =====================================================================
// MENU ARTIKLI - Types
// =====================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CategoryRef = { id: string; [key: string]: any }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ModifierRef = { id: string; [key: string]: any }

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
