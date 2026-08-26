'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ChefHat, Calculator, Plus, Minus, Package, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { type RecipeDetailPanelProps, formatCurrency } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// Podrobnosti in raztegovanje izbranega recepta
export const RecipeDetailPanel = memo(function RecipeDetailPanel({
  recipe,
  scaleFactor,
  originalServings,
  scaledServings,
  scaledIngredients,
  scaledTotalCost,
  scaledCostPerServing,
  onScaleChange,
}: RecipeDetailPanelProps) {
  return (
    <div className="flex-1 space-y-3 overflow-auto">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{recipe.name}</CardTitle>
            <Badge variant="outline">{recipe.category}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-lg font-bold">{recipe.prepTime + recipe.cookTime} min</p>
              <p className="text-xs text-muted-foreground">Skupaj čas</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-lg font-bold">{formatCurrency(recipe.totalCost)}</p>
              <p className="text-xs text-muted-foreground">Izvirni strošek</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-lg font-bold">{formatCurrency(recipe.sellingPrice)}</p>
              <p className="text-xs text-muted-foreground">Prodajna cena</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-lg font-bold text-green-600">{recipe.margin}%</p>
              <p className="text-xs text-muted-foreground">Marža</p>
            </div>
          </div>

          {/* Raztegovanje */}
          <div className="p-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Calculator className="h-4 w-4" /> Raztegni recept
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => onScaleChange(Math.max(1, scaledServings - 2))} aria-label="Zmanjšaj število obrokov">
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="text-center">
                  <Input
                    id="recipe-scaling-servings"
                    type="number"
                    value={scaledServings || originalServings}
                    onChange={e => onScaleChange(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center text-lg font-bold"
                  />
                  <p className="text-xs text-muted-foreground">obrokov</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => onScaleChange(scaledServings + 2)} aria-label="Povečaj število obrokov">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Faktor:</span>
                <Badge variant="secondary" className="text-sm font-bold">{safeToFixed(scaleFactor, 2)}x</Badge>
              </div>

              <div className="flex items-center gap-4 ml-auto">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Novi skupni strošek</p>
                  <p className="text-lg font-bold">{formatCurrency(Math.round(scaledTotalCost * 100) / 100)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Strošek/obrok</p>
                  <p className="text-lg font-bold">{formatCurrency(Math.round(scaledCostPerServing * 100) / 100)}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sestavine */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" /> Sestavine
            {scaleFactor !== 1 && (
              <Badge variant="secondary" className="text-xs">
                {scaleFactor > 1 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                {safeToFixed(scaleFactor, 2)}x
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
              <span>Sestavina</span>
              <span className="text-right">Količina</span>
              <span className="text-right">Enota</span>
              <span className="text-right">Cena/enoto</span>
              <span className="text-right">Skupaj</span>
            </div>
            {scaledIngredients.map(ing => (
              <div key={ing.id} className="grid grid-cols-5 gap-2 text-sm py-1">
                <span className="font-medium">{ing.name}</span>
                <span className="text-right font-medium">{ing.quantity}</span>
                <span className="text-right text-muted-foreground">{ing.unit}</span>
                <span className="text-right text-muted-foreground">{formatCurrency(ing.costPerUnit)}</span>
                <span className="text-right font-medium">{formatCurrency(ing.totalCost)}</span>
              </div>
            ))}
            <div className="grid grid-cols-5 gap-2 text-sm font-bold pt-2 border-t">
              <span>SKUPAJ</span>
              <span></span>
              <span></span>
              <span></span>
              <span className="text-right">{formatCurrency(Math.round(scaledTotalCost * 100) / 100)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navodila */}
      {recipe.instructions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ChefHat className="h-4 w-4" /> Navodila za pripravo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recipe.instructions.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {idx + 1}
                  </div>
                  <p className="text-sm">{step}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
})
