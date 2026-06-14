'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { BookOpen, Plus, Trash2, Pencil, ChefHat, Package } from 'lucide-react'
import type { MenuItemData, RecipeItemData } from './constants'

// ============================================
// PODROBNOSTI RECEPTA - DESNI DEL
// ============================================

interface RecipeDetailProps {
  selectedItem: MenuItemData | null
  selectedRecipes: RecipeItemData[]
  selectedTotalCost: number
  onOpenAddDialog: (_menuItemId?: string) => void
  onOpenEditDialog: (_item: RecipeItemData) => void
  onDeleteRecipe: (_id: string) => void
}

export const RecipeDetail = memo(function RecipeDetail({
  selectedItem,
  selectedRecipes,
  selectedTotalCost,
  onOpenAddDialog,
  onOpenEditDialog,
  onDeleteRecipe,
}: RecipeDetailProps) {
  // Izračun marže za izbrani artikel
  const marginPct = selectedTotalCost > 0 && selectedItem
    ? ((selectedItem.price - selectedTotalCost) / selectedItem.price * 100)
    : 0

  if (!selectedItem) {
    return (
      <div className="lg:col-span-2 border rounded-lg overflow-y-auto custom-scrollbar">
        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
          <ChefHat className="h-16 w-16 opacity-20" />
          <p className="text-lg font-medium">Izberite artikel</p>
          <p className="text-sm">Izberite meni artikel na levi za pregled recepta</p>
        </div>
      </div>
    )
  }

  return (
    <div className="lg:col-span-2 border rounded-lg overflow-y-auto custom-scrollbar">
      <div className="p-4 space-y-4">
        {/* Glava */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold">{selectedItem.name}</h3>
            <p className="text-sm text-muted-foreground">
              {selectedItem.category?.name || ''} · €{selectedItem.price.toFixed(2)}
            </p>
          </div>
          <Button size="sm" onClick={() => onOpenAddDialog(selectedItem.id)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Dodaj sestavino
          </Button>
        </div>

        {/* Primerjava cen */}
        <Card className={selectedTotalCost > 0 ? (marginPct >= 60 ? 'bg-emerald-50 dark:bg-emerald-950/30' : marginPct >= 40 ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-red-50 dark:bg-red-950/30') : ''}>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Nabavni strošek</p>
                <p className="text-lg font-bold text-red-600">€{selectedTotalCost.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Prodajna cena</p>
                <p className="text-lg font-bold">€{selectedItem.price.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bruto marža</p>
                <p className={`text-lg font-bold ${marginPct >= 60 ? 'text-emerald-600' : marginPct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                  €{(selectedItem.price - selectedTotalCost).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Marža v %</p>
                <p className={`text-lg font-bold ${marginPct >= 60 ? 'text-emerald-600' : marginPct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                  {selectedTotalCost > 0 ? marginPct.toFixed(1) : '—'}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Seznam sestavin */}
        {selectedRecipes.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" /> Sestavine ({selectedRecipes.length})
            </h4>
            {selectedRecipes.map(recipe => (
              <div key={recipe.id} className="flex items-center justify-between p-3 rounded-lg border hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{recipe.inventoryItem.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {recipe.quantityPerServing} {recipe.unit || recipe.inventoryItem.unit} · €{recipe.inventoryItem.costPerUnit.toFixed(2)}/{recipe.inventoryItem.unit}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-semibold text-sm">€{recipe.costPerServing.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">na porcijo</p>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Uredi" className="h-7 w-7" onClick={() => onOpenEditDialog(recipe)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Izbriši" className="h-7 w-7 text-destructive" onClick={() => onDeleteRecipe(recipe.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex justify-between p-3 rounded-lg bg-muted/50 font-semibold text-sm">
              <span>Skupni strošek na porcijo:</span>
              <span>€{selectedTotalCost.toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">Ta artikel še nima recepta</p>
            <p className="text-xs text-muted-foreground mb-3">Dodajte sestavine za izračun stroškov in marže</p>
            <Button size="sm" onClick={() => onOpenAddDialog(selectedItem.id)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Dodaj prvo sestavino
            </Button>
          </div>
        )}
      </div>
    </div>
  )
})
