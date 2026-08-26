// --- Meni in recepti ---

/** Menijska postavka */
export interface MenuItemRow {
  id: string
  name: string
  nameSl?: string
  nameEn?: string
  price: number
  cost?: number
  category?: string
  categoryId?: string
  allergens?: string[]
  image?: string
  available?: boolean
  popularity?: number
  foodCost?: number
  description?: string
  ingredients?: RecipeIngredientRow[]
  [key: string]: unknown
}

/** Kategorija menija */
export interface CategoryRow {
  id: string
  name: string
  slug?: string
  icon?: string
  color?: string
  sortOrder?: number
  [key: string]: unknown
}

/** Recept / Sestavina */
export interface RecipeIngredientRow {
  id?: string
  inventoryItemId?: string
  name: string
  quantity: number
  unit?: string
  costPerUnit?: number
  totalCost: number
  [key: string]: unknown
}

/** Recept iz API-ja */
export interface RecipeRow {
  id: string
  name?: string
  servings?: number
  yield?: number
  category?: string
  ingredients?: RecipeIngredientRow[]
  items?: RecipeIngredientRow[]
  prepTime?: number
  cookTime?: number
  instructions?: string[]
  steps?: string[]
  sellingPrice?: number
  price?: number
  [key: string]: unknown
}
