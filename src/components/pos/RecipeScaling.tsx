'use client'

import { memo } from 'react'
import { Scale } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useRecipeScaling } from './recipe-scaling/useRecipeScaling'

// Lazy-loaded podkomponente
const RecipeList = dynamic(() => import('./recipe-scaling/RecipeList').then(m => ({ default: m.RecipeList })), { ssr: false })
const RecipeDetailPanel = dynamic(() => import('./recipe-scaling/RecipeDetailPanel').then(m => ({ default: m.RecipeDetailPanel })), { ssr: false })
const RecipeEmptyState = dynamic(() => import('./recipe-scaling/RecipeEmptyState').then(m => ({ default: m.RecipeEmptyState })), { ssr: false })

export const RecipeScaling = memo(function RecipeScaling() {
  const {
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
  } = useRecipeScaling()

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
