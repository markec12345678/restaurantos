// ============================================
// DELJENI TIPI IN KONSTANTE ZA RECIPE SCALING
// ============================================

export interface RecipeIngredient {
  id: string
  name: string
  quantity: number
  unit: string
  costPerUnit: number
  totalCost: number
}

export interface Recipe {
  id: string
  name: string
  servings: number
  category: string
  ingredients: RecipeIngredient[]
  prepTime: number
  cookTime: number
  instructions: string[]
  totalCost: number
  costPerServing: number
  sellingPrice: number
  margin: number
}

// Vzorčni recepti, ko API ne vrne podatkov
export const SAMPLE_RECIPES: Recipe[] = [
  {
    id: 'sample-1', name: 'Ocvrti lignji', servings: 4, category: 'Morska hrana',
    ingredients: [
      { id: 'i1', name: 'Lignji', quantity: 0.8, unit: 'kg', costPerUnit: 14.50, totalCost: 11.60 },
      { id: 'i2', name: 'Moka', quantity: 0.2, unit: 'kg', costPerUnit: 1.20, totalCost: 0.24 },
      { id: 'i3', name: 'Jajca', quantity: 2, unit: 'kos', costPerUnit: 0.35, totalCost: 0.70 },
      { id: 'i4', name: 'Olje', quantity: 0.5, unit: 'l', costPerUnit: 5.00, totalCost: 2.50 },
      { id: 'i5', name: 'Limona', quantity: 1, unit: 'kos', costPerUnit: 0.50, totalCost: 0.50 },
    ],
    prepTime: 15, cookTime: 10, instructions: ['Očisti lignje', 'Pripravi paniranje', 'Panceraj lignje', 'Praži v olju 3-4 minute', 'Postreži z limono'],
    totalCost: 15.54, costPerServing: 3.89, sellingPrice: 14.90, margin: 74,
  },
  {
    id: 'sample-2', name: 'Rižota z gobami', servings: 6, category: 'Testenine in riž',
    ingredients: [
      { id: 'i6', name: 'Riž arborio', quantity: 0.4, unit: 'kg', costPerUnit: 3.50, totalCost: 1.40 },
      { id: 'i7', name: 'Gobe', quantity: 0.3, unit: 'kg', costPerUnit: 8.00, totalCost: 2.40 },
      { id: 'i8', name: 'Čebula', quantity: 0.15, unit: 'kg', costPerUnit: 1.50, totalCost: 0.23 },
      { id: 'i9', name: 'Parmezan', quantity: 0.1, unit: 'kg', costPerUnit: 22.00, totalCost: 2.20 },
      { id: 'i10', name: 'Maslo', quantity: 0.05, unit: 'kg', costPerUnit: 12.00, totalCost: 0.60 },
      { id: 'i11', name: 'Zelenjavna osnova', quantity: 1, unit: 'l', costPerUnit: 2.50, totalCost: 2.50 },
    ],
    prepTime: 10, cookTime: 25, instructions: ['Nareži gobe in čebulo', 'Popeci čebulo', 'Dodaj riž', 'Postopoma dodajaj osnovo', 'Vmešaj gobe in parmezan'],
    totalCost: 9.33, costPerServing: 1.56, sellingPrice: 11.90, margin: 87,
  },
]

// Pomožna funkcija za formatiranje valute
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(amount)
}

// ============================================
// VMESNIKI ZA PROPS PODKOMPONENT
// ============================================

export interface RecipeListProps {
  recipes: Recipe[]
  selectedRecipeId: string | undefined
  onSelectRecipe: (_recipe: Recipe) => void
}

export interface RecipeDetailPanelProps {
  recipe: Recipe
  scaleFactor: number
  originalServings: number
  scaledServings: number
  scaledIngredients: RecipeIngredient[]
  scaledTotalCost: number
  scaledCostPerServing: number
  onScaleChange: (_newServings: number) => void
}

export type RecipeEmptyStateProps = Record<string, never>
