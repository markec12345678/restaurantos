'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { type Recipe, type RecipeListProps, formatCurrency } from './constants'

// Seznam receptov na levi strani
export const RecipeList = memo(function RecipeList({ recipes, selectedRecipeId, onSelectRecipe }: RecipeListProps) {
  return (
    <div className="w-1/3 space-y-2 overflow-auto">
      {recipes.map((recipe: Recipe) => (
        <button
          key={recipe.id}
          onClick={() => onSelectRecipe(recipe)}
          className={`w-full text-left p-3 rounded-lg border transition-colors hover:bg-accent ${
            selectedRecipeId === recipe.id ? 'bg-accent border-primary' : ''
          }`}
          aria-label={`Izberi recept ${recipe.name}`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{recipe.name}</span>
            <Badge variant="outline" className="text-xs">{recipe.servings} obrokov</Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span>{formatCurrency(recipe.costPerServing)}/obrok</span>
            <span>·</span>
            <span>{recipe.margin}% marža</span>
          </div>
        </button>
      ))}
    </div>
  )
})
