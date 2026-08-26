// =====================================================================
// Skupni tipi za seed-norms helperje
// =====================================================================

// Tip za inventarno postavko (vsebuje ID za referenciranje v receptih)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InvItem = Record<string, any> & { id: string }

// Tip za mapo inventarnih postavk
export type InvMap = Record<string, InvItem>

// Tip za helper funkcijo za iskanje menu itemov po imenu
export type MiFn = (name: string) => InvItem | undefined

// Tip za posamezni recept
export interface RecipeEntry {
  menuItemName: string
  ingredientId: string
  quantityPerServing: number
  unit: string
  notes?: string
}
