'use client'

import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { Scale } from 'lucide-react'
import { RecipeRow, RecipeIngredientRow, InventoryItemRow } from '@/lib/types'
import { authFetch } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { type Recipe, type RecipeIngredient, SAMPLE_RECIPES } from './recipe-scaling/constants'

// Lazy-loaded podkomponente
const RecipeList = dynamic(() => import('./recipe-scaling/RecipeList').then(m => ({ default: m.RecipeList })), { ssr: false })
const RecipeDetailPanel = dynamic(() => import('./recipe-scaling/RecipeDetailPanel').then(m => ({ default: m.RecipeDetailPanel })), { ssr: false })
const RecipeEmptyState = dynamic(() => import('./recipe-scaling/RecipeEmptyState').then(m => ({ default: m.RecipeEmptyState })), { ssr: false })

export const RecipeScaling = memo(function RecipeScaling() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [_loading, setLoading] = useState(true)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [scaleFactor, setScaleFactor] = useState(1)
  const [originalServings, setOriginalServings] = useState(0)

  // ============================================
  // NALAGANJE PODATKOV
  // ============================================

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

      const mappedRecipes: Recipe[] = (recipesData || []).map((r: RecipeRow) => {
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

      // Če ni receptov, dodaj vzorce
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

  // ============================================
  // HANDLERJI
  // ============================================

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

  // ============================================
  // IZPELJANA STANJA
  // ============================================

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

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-100 dark:bg-lime-900/30">
            <Scale className="h-5 w-5 text-lime-600 dark:text-lime-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Raztegovanje receptov</h2>
            <p className="text-sm text-muted-foreground">Prilagodi količine za poljubno število obrokov</p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100%-80px)]">
        {/* Seznam receptov */}
        <RecipeList
          recipes={recipes}
          selectedRecipeId={selectedRecipe?.id}
          onSelectRecipe={handleSelectRecipe}
        />

        {/* Podrobnosti in raztegovanje */}
        {selectedRecipe ? (
          <RecipeDetailPanel
            recipe={selectedRecipe}
            scaleFactor={scaleFactor}
            originalServings={originalServings}
            scaledServings={scaledServings}
            scaledIngredients={scaledIngredients}
            scaledTotalCost={scaledTotalCost}
            scaledCostPerServing={scaledCostPerServing}
            onScaleChange={handleScaleChange}
          />
        ) : (
          <RecipeEmptyState />
        )}
      </div>
    </div>
  )
})
