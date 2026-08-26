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
}
