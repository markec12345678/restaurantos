'use client'

import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { RecipeRow, RecipeIngredientRow, InventoryItemRow } from '@/lib/types'
import { authFetch } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import { ChefHat, Calculator, Plus, Minus, Scale, Package, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface RecipeIngredient {
  id: string
  name: string
  quantity: number
  unit: string
  costPerUnit: number
  totalCost: number
}

interface Recipe {
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

export const RecipeScaling = memo(function RecipeScaling() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [_loading, setLoading] = useState(true)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [scaleFactor, setScaleFactor] = useState(1)
  const [originalServings, setOriginalServings] = useState(0)

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
        const sampleRecipes: Recipe[] = [
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
        setRecipes(sampleRecipes)
      } else {
        setRecipes(mappedRecipes)
      }
    } catch {
      toast.error('Napaka pri nalaganju receptov')
    } finally {
      setLoading(false)
    }
  }

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(amount)
  }

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
        <div className="w-1/3 space-y-2 overflow-auto">
          {recipes.map(recipe => (
            <button
              key={recipe.id}
              onClick={() => handleSelectRecipe(recipe)}
              className={`w-full text-left p-3 rounded-lg border transition-colors hover:bg-accent ${
                selectedRecipe?.id === recipe.id ? 'bg-accent border-primary' : ''
              }`}
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

        {/* Podrobnosti in raztegovanje */}
        <div className="flex-1 space-y-3 overflow-auto">
          {selectedRecipe ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{selectedRecipe.name}</CardTitle>
                    <Badge variant="outline">{selectedRecipe.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{selectedRecipe.prepTime + selectedRecipe.cookTime} min</p>
                      <p className="text-xs text-muted-foreground">Skupaj čas</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{formatCurrency(selectedRecipe.totalCost)}</p>
                      <p className="text-xs text-muted-foreground">Izvirni strošek</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{formatCurrency(selectedRecipe.sellingPrice)}</p>
                      <p className="text-xs text-muted-foreground">Prodajna cena</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold text-green-600">{selectedRecipe.margin}%</p>
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
                        <Button size="sm" variant="outline" onClick={() => handleScaleChange(Math.max(1, scaledServings - 2))}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <div className="text-center">
                          <Input
                            type="number"
                            value={scaledServings || originalServings}
                            onChange={e => handleScaleChange(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20 text-center text-lg font-bold"
                          />
                          <p className="text-xs text-muted-foreground">obrokov</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleScaleChange(scaledServings + 2)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Faktor:</span>
                        <Badge variant="secondary" className="text-sm font-bold">{scaleFactor.toFixed(2)}x</Badge>
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
                        {scaleFactor.toFixed(2)}x
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
              {selectedRecipe.instructions.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ChefHat className="h-4 w-4" /> Navodila za pripravo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedRecipe.instructions.map((step, idx) => (
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
            </>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="p-8 text-center">
                <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-lg font-medium">Izberite recept</p>
                <p className="text-sm text-muted-foreground">Kliknite na recept na levi za raztegovanje</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
})
