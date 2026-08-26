import { useState, useEffect, useCallback, useMemo } from 'react'
import { RecipeRow, RecipeIngredientRow, InventoryItemRow } from '@/lib/types'
import { authFetch } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import { type Recipe, type RecipeIngredient, SAMPLE_RECIPES } from './constants'

export function useRecipeScaling() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [_loading, setLoading] = useState(true)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [scaleFactor, setScaleFactor] = useState(1)
  const [originalServings, setOriginalServings] = useState(0)

  // NALAGANJE PODATKOV
  useEffect(() => {
    loadRecipes()
  }, [])

  const loadRecipes = async () => {
    try {
      const [recipesRes, invRes] = await Promise.all([
        authFetch('/api/recipes'),
        authFetch('/api/inventory'),
      ])
      if (!recipesRes.ok || !invRes.ok) throw new Error('Napaka pri nalaganju')
      const recipesData = await recipesRes.json()
      const invData = await invRes.json()

      // FIX: /api/recipes sedaj vrača {recipes, total, limit, offset} — podpremo tudi legacy array
      const recipesArray: RecipeRow[] = Array.isArray(recipesData)
        ? recipesData
        : (recipesData?.recipes ?? recipesData?.items ?? [])

      const mappedRecipes: Recipe[] = recipesArray.map((r: RecipeRow) => {
        const ingredients: RecipeIngredient[] = (r.ingredients || r.items || []).map((ing: RecipeIngredientRow) => {
          const invItem = invData?.find?.((i: InventoryItemRow) => i.id === ing.inventoryItemId)
          const costPerUnit = invItem?.costPerUnit || ing.costPerUnit || ing.unitCost || 0
          const quantity = ing.quantity || 0

          return {
            id: ing.id || `ing-${Math.random()}`,
            name: ing.name || ing.itemName || invItem?.name || 'Sestavina',
            quantity,
            unit: ing.unit || invItem?.unit || 'kg',
            costPerUnit,
            totalCost: Math.round(quantity * costPerUnit * 100) / 100,
          }
        })

        const totalCost = ingredients.reduce((s: number, i: RecipeIngredient) => s + i.totalCost, 0)
        const servings = r.servings || r.yield || 4
        const sellingPrice = r.sellingPrice || r.price || (totalCost / servings) * 3

        return {
          id: r.id,
          name: r.name || 'Neznan recept',
          servings,
          category: r.category || 'Splošno',
          ingredients,
          prepTime: r.prepTime || 15,
          cookTime: r.cookTime || 30,
          instructions: r.instructions || r.steps || [],
          totalCost: Math.round(totalCost * 100) / 100,
          costPerServing: Math.round((totalCost / servings) * 100) / 100,
          sellingPrice: Math.round(sellingPrice * 100) / 100,
          margin: sellingPrice > 0 ? Math.round(((sellingPrice - totalCost / servings) / sellingPrice) * 100) : 0,
        }
      })

      if (mappedRecipes.length === 0) {
        setRecipes(SAMPLE_RECIPES)
      } else {
        setRecipes(mappedRecipes)
      }
    } catch {
      toast.error('Napaka pri nalaganju receptov')
    } finally {
      setLoading(false)
    }
  }

  // HANDLERJI
  const handleSelectRecipe = useCallback((recipe: Recipe) => {
    setSelectedRecipe(recipe)
    setOriginalServings(recipe.servings)
    setScaleFactor(1)
  }, [])

  const handleScaleChange = useCallback((newServings: number) => {
    if (originalServings > 0) {
      setScaleFactor(newServings / originalServings)
    }
  }, [originalServings])

  // IZPELJANA STANJA
  const scaledIngredients = useMemo(() => selectedRecipe
    ? selectedRecipe.ingredients.map(ing => ({
        ...ing,
        quantity: Math.round(ing.quantity * scaleFactor * 100) / 100,
        totalCost: Math.round(ing.quantity * scaleFactor * ing.costPerUnit * 100) / 100,
      }))
    : [], [selectedRecipe, scaleFactor])

  const scaledTotalCost = useMemo(() => scaledIngredients.reduce((s, i) => s + i.totalCost, 0), [scaledIngredients])
  const scaledServings = useMemo(() => selectedRecipe ? Math.round(originalServings * scaleFactor) : 0, [selectedRecipe, originalServings, scaleFactor])
  const scaledCostPerServing = useMemo(() => scaledServings > 0 ? scaledTotalCost / scaledServings : 0, [scaledServings, scaledTotalCost])

  return {
    recipes,
    selectedRecipe,
    scaleFactor,
    originalServings,
    scaledIngredients,
    scaledTotalCost,
    scaledServings,
    scaledCostPerServing,
    handleSelectRecipe,
    handleScaleChange,
  }
}
