'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  BookOpen, Plus, Trash2, Pencil, ChefHat, Package, DollarSign, Percent,
  AlertTriangle, ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown,
  Search, ChevronRight, MinusCircle
} from 'lucide-react'
import { useState, useMemo } from 'react'

// ============================================
// TIPI
// ============================================
interface RecipeItemData {
  id: string
  menuItemId: string
  inventoryItemId: string
  quantityPerServing: number
  unit: string
  notes: string
  menuItem: { id: string; name: string; price: number }
  inventoryItem: { id: string; name: string; unit: string; costPerUnit: number; quantity: number }
  costPerServing: number
}

interface MenuItemData {
  id: string
  name: string
  price: number
  vatRate: number
  category: { id: string; name: string; menu: { id: string; name: string } }
  inventory?: { id: string; name: string; costPerServing: number } | null
}

interface InventoryData {
  id: string
  name: string
  unit: string
  costPerUnit: number
  quantity: number
  category: string
}

// ============================================
// KOMPONENTA
// ============================================
export function RecipeManager() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('recipes')
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [filterMenu, setFilterMenu] = useState('all')

  // Dodajanje sestavine dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addForm, setAddForm] = useState({
    menuItemId: '', inventoryItemId: '', quantityPerServing: '', unit: '', notes: ''
  })

  // Urejanje sestavine dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<RecipeItemData | null>(null)
  const [editForm, setEditForm] = useState({ quantityPerServing: '', unit: '', notes: '' })

  // ============================================
  // QUERIES
  // ============================================
  const { data: recipes, isLoading: recipesLoading } = useQuery<RecipeItemData[]>({
    queryKey: ['recipes'],
    queryFn: async () => {
      const res = await fetch('/api/recipes')
      return res.json()
    },
  })

  const { data: menuItems } = useQuery<MenuItemData[]>({
    queryKey: ['menu-items'],
    queryFn: async () => {
      const res = await fetch('/api/menu-items')
      return res.json()
    },
  })

  const { data: inventoryItems } = useQuery<InventoryData[]>({
    queryKey: ['inventory'],
    queryFn: async () => {
      const res = await fetch('/api/inventory')
      return res.json()
    },
  })

  // ============================================
  // MUTATIONS
  // ============================================
  const addMutation = useMutation({
    mutationFn: async (data: typeof addForm) => {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuItemId: data.menuItemId,
          inventoryItemId: data.inventoryItemId,
          quantityPerServing: parseFloat(data.quantityPerServing) || 0,
          unit: data.unit,
          notes: data.notes,
        }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Napaka') }
      return res.json()
    },
    onSuccess: () => { toast.success('Sestavina dodana'); queryClient.invalidateQueries({ queryKey: ['recipes'] }); setAddDialogOpen(false) },
    onError: (err: Error) => toast.error(err.message),
  })

  const editMutation = useMutation({
    mutationFn: async (data: { id: string } & typeof editForm) => {
      const res = await fetch('/api/recipes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: data.id,
          quantityPerServing: parseFloat(data.quantityPerServing) || 0,
          unit: data.unit,
          notes: data.notes,
        }),
      })
      if (!res.ok) throw new Error('Napaka pri urejanju')
      return res.json()
    },
    onSuccess: () => { toast.success('Sestavina posodobljena'); queryClient.invalidateQueries({ queryKey: ['recipes'] }); setEditDialogOpen(false); setEditItem(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/recipes?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka pri brisanju')
      return res.json()
    },
    onSuccess: () => { toast.success('Sestavina odstranjena'); queryClient.invalidateQueries({ queryKey: ['recipes'] }) },
  })

  // ============================================
  // IZRAČUNI
  // ============================================
  // Skupine receptov po menijih
  const recipeGroups = useMemo(() => {
    if (!recipes || !menuItems) return { hrana: [], pijaca: [] }
    const hranaItems = menuItems.filter(mi => mi.category?.menu?.name === 'Hrana')
    const pijacaItems = menuItems.filter(mi => mi.category?.menu?.name === 'Pijača')

    const groupItems = (items: MenuItemData[]) => items.map(mi => {
      const itemRecipes = recipes.filter(r => r.menuItemId === mi.id)
      const totalCost = itemRecipes.reduce((sum, r) => sum + r.costPerServing, 0)
      // Fallback na inventory costPerServing če ni recepta
      const fallbackCost = mi.inventory?.costPerServing || 0
      const effectiveCost = totalCost > 0 ? totalCost : fallbackCost
      return {
        ...mi,
        recipes: itemRecipes,
        totalCost: effectiveCost,
        hasRecipe: itemRecipes.length > 0,
      }
    })

    return {
      hrana: groupItems(hranaItems),
      pijaca: groupItems(pijacaItems),
    }
  }, [recipes, menuItems])

  // Pregled marž - vsi artikli
  const marginData = useMemo(() => {
    if (!menuItems || !recipes) return []
    return menuItems.map(mi => {
      const itemRecipes = recipes.filter(r => r.menuItemId === mi.id)
      const recipeCost = itemRecipes.reduce((sum, r) => sum + r.costPerServing, 0)
      const fallbackCost = mi.inventory?.costPerServing || 0
      const cost = recipeCost > 0 ? recipeCost : fallbackCost
      const price = mi.price
      const marginEur = price - cost
      const marginPct = price > 0 ? (marginEur / price) * 100 : 0
      return {
        id: mi.id,
        name: mi.name,
        price,
        cost,
        marginEur,
        marginPct,
        hasRecipe: itemRecipes.length > 0 || !!mi.inventory,
        recipeCount: itemRecipes.length,
        category: mi.category?.name || '',
        menu: mi.category?.menu?.name || '',
      }
    })
  }, [menuItems, recipes])

  const filteredMarginData = useMemo(() => {
    let data = marginData
    if (filterMenu !== 'all') data = data.filter(d => d.menu === filterMenu)
    if (search) data = data.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
    return data.sort((a, b) => a.marginPct - b.marginPct)
  }, [marginData, filterMenu, search])

  const marginStats = useMemo(() => {
    if (filteredMarginData.length === 0) return null
    const withCost = filteredMarginData.filter(d => d.cost > 0)
    const avgMargin = withCost.length > 0 ? withCost.reduce((s, d) => s + d.marginPct, 0) / withCost.length : 0
    const below40 = filteredMarginData.filter(d => d.marginPct < 40 && d.cost > 0).length
    const noRecipe = filteredMarginData.filter(d => !d.hasRecipe).length
    const totalItems = filteredMarginData.length
    return { avgMargin, below40, noRecipe, totalItems, withCostCount: withCost.length }
  }, [filteredMarginData])

  // Izbran meni artikel
  const selectedItem = useMemo(() => {
    if (!selectedMenuItemId || !menuItems) return null
    return menuItems.find(mi => mi.id === selectedMenuItemId)
  }, [selectedMenuItemId, menuItems])

  const selectedRecipes = useMemo(() => {
    if (!selectedMenuItemId || !recipes) return []
    return recipes.filter(r => r.menuItemId === selectedMenuItemId)
  }, [selectedMenuItemId, recipes])

  const selectedTotalCost = selectedRecipes.reduce((sum, r) => sum + r.costPerServing, 0)

  // ============================================
  // HANDLERJI
  // ============================================
  const openAddDialog = (menuItemId?: string) => {
    setAddForm({
      menuItemId: menuItemId || selectedMenuItemId || '',
      inventoryItemId: '',
      quantityPerServing: '',
      unit: '',
      notes: '',
    })
    setAddDialogOpen(true)
  }

  const openEditDialog = (item: RecipeItemData) => {
    setEditItem(item)
    setEditForm({
      quantityPerServing: String(item.quantityPerServing),
      unit: item.unit,
      notes: item.notes,
    })
    setEditDialogOpen(true)
  }

  const marginColor = (pct: number) => {
    if (pct >= 60) return 'text-emerald-600'
    if (pct >= 40) return 'text-amber-600'
    return 'text-red-600'
  }

  const marginBg = (pct: number) => {
    if (pct >= 60) return 'bg-emerald-50 dark:bg-emerald-950/30'
    if (pct >= 40) return 'bg-amber-50 dark:bg-amber-950/30'
    return 'bg-red-50 dark:bg-red-950/30'
  }

  const marginBadge = (pct: number) => {
    if (pct >= 60) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
    if (pct >= 40) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Recepti in normativi
          </h2>
          <p className="text-muted-foreground">Upravljanje receptov, normativov in pregled marž</p>
        </div>
        <Button onClick={() => openAddDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj sestavino
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="recipes" className="gap-1.5">
            <ChefHat className="h-3.5 w-3.5" /> Recepti po jedeh
          </TabsTrigger>
          <TabsTrigger value="margins" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Pregled marž
          </TabsTrigger>
        </TabsList>

        {/* ===================== TAB: RECEPTI PO JEDEH ===================== */}
        <TabsContent value="recipes" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-280px)]">
            {/* Levo: seznam meni artiklov */}
            <div className="lg:col-span-1 border rounded-lg overflow-hidden flex flex-col">
              <div className="p-3 border-b bg-muted/30">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Išči artikle..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
                </div>
              </div>
              <div className="overflow-y-auto flex-1 custom-scrollbar">
                {/* Hrana */}
                {recipeGroups.hrana.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 bg-muted/50 text-xs font-semibold text-muted-foreground sticky top-0">HRANA</div>
                    {recipeGroups.hrana
                      .filter(mi => mi.name.toLowerCase().includes(search.toLowerCase()))
                      .map(mi => (
                        <button
                          key={mi.id}
                          onClick={() => setSelectedMenuItemId(mi.id)}
                          className={`w-full px-3 py-2.5 flex items-center justify-between text-sm hover:bg-accent/50 transition-colors border-b ${
                            selectedMenuItemId === mi.id ? 'bg-accent' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`h-2 w-2 rounded-full flex-shrink-0 ${mi.hasRecipe ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                            <span className="truncate font-medium">{mi.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-xs text-muted-foreground">€{mi.price.toFixed(2)}</span>
                            {mi.totalCost > 0 && (
                              <Badge className={`text-[9px] h-4 px-1 ${marginBadge(mi.totalCost > 0 ? ((mi.price - mi.totalCost) / mi.price * 100) : 0)}`}>
                                {((mi.price - mi.totalCost) / mi.price * 100).toFixed(0)}%
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                  </div>
                )}
                {/* Pijača */}
                {recipeGroups.pijaca.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 bg-muted/50 text-xs font-semibold text-muted-foreground sticky top-0">PIJAČA</div>
                    {recipeGroups.pijaca
                      .filter(mi => mi.name.toLowerCase().includes(search.toLowerCase()))
                      .map(mi => (
                        <button
                          key={mi.id}
                          onClick={() => setSelectedMenuItemId(mi.id)}
                          className={`w-full px-3 py-2.5 flex items-center justify-between text-sm hover:bg-accent/50 transition-colors border-b ${
                            selectedMenuItemId === mi.id ? 'bg-accent' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`h-2 w-2 rounded-full flex-shrink-0 ${mi.hasRecipe ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                            <span className="truncate font-medium">{mi.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-xs text-muted-foreground">€{mi.price.toFixed(2)}</span>
                            {mi.totalCost > 0 && (
                              <Badge className={`text-[9px] h-4 px-1 ${marginBadge(mi.totalCost > 0 ? ((mi.price - mi.totalCost) / mi.price * 100) : 0)}`}>
                                {((mi.price - mi.totalCost) / mi.price * 100).toFixed(0)}%
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Desno: podrobnosti recepta */}
            <div className="lg:col-span-2 border rounded-lg overflow-y-auto custom-scrollbar">
              {selectedItem ? (
                <div className="p-4 space-y-4">
                  {/* Glava */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold">{selectedItem.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedItem.category?.name || ''} · €{selectedItem.price.toFixed(2)}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => openAddDialog(selectedItem.id)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Dodaj sestavino
                    </Button>
                  </div>

                  {/* Primerjava cen */}
                  <Card className={marginBg(selectedTotalCost > 0 ? ((selectedItem.price - selectedTotalCost) / selectedItem.price * 100) : 0)}>
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
                          <p className={`text-lg font-bold ${marginColor(selectedTotalCost > 0 ? ((selectedItem.price - selectedTotalCost) / selectedItem.price * 100) : 0)}`}>
                            €{(selectedItem.price - selectedTotalCost).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Marža v %</p>
                          <p className={`text-lg font-bold ${marginColor(selectedTotalCost > 0 ? ((selectedItem.price - selectedTotalCost) / selectedItem.price * 100) : 0)}`}>
                            {selectedTotalCost > 0 ? ((selectedItem.price - selectedTotalCost) / selectedItem.price * 100).toFixed(1) : '—'}%
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
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(recipe)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(recipe.id)}>
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
                      <Button size="sm" onClick={() => openAddDialog(selectedItem.id)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Dodaj prvo sestavino
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                  <ChefHat className="h-16 w-16 opacity-20" />
                  <p className="text-lg font-medium">Izberite artikel</p>
                  <p className="text-sm">Izberite meni artikel na levi za pregled recepta</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ===================== TAB: PREGLED MARŽ ===================== */}
        <TabsContent value="margins" className="space-y-4 mt-4">
          {/* Filtri */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Išči artikle..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterMenu} onValueChange={setFilterMenu}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Vse kategorije</SelectItem>
                <SelectItem value="Hrana">Hrana</SelectItem>
                <SelectItem value="Pijača">Pijača</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Statistika */}
          {marginStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Povprečna marža</p>
                  <p className={`text-2xl font-bold ${marginColor(marginStats.avgMargin)}`}>
                    {marginStats.avgMargin.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Artikli z maržo &lt;40%</p>
                  <p className="text-2xl font-bold text-red-600">{marginStats.below40}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Brez recepta/normativa</p>
                  <p className="text-2xl font-bold text-amber-600">{marginStats.noRecipe}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Skupaj artiklov</p>
                  <p className="text-2xl font-bold">{marginStats.totalItems}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tabela marž */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-semibold">Artikel</th>
                      <th className="text-left p-3 font-semibold">Kategorija</th>
                      <th className="text-right p-3 font-semibold">Prodajna cena</th>
                      <th className="text-right p-3 font-semibold">Nabavni strošek</th>
                      <th className="text-right p-3 font-semibold">Marža (€)</th>
                      <th className="text-right p-3 font-semibold">Marža (%)</th>
                      <th className="text-center p-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMarginData.map(item => (
                      <tr key={item.id} className={`border-b hover:bg-accent/30 transition-colors ${!item.hasRecipe ? 'opacity-60' : ''}`}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium">{item.name}</span>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{item.category}</td>
                        <td className="p-3 text-right font-medium">€{item.price.toFixed(2)}</td>
                        <td className="p-3 text-right text-red-600">€{item.cost.toFixed(2)}</td>
                        <td className={`p-3 text-right font-semibold ${marginColor(item.marginPct)}`}>
                          €{item.marginEur.toFixed(2)}
                        </td>
                        <td className={`p-3 text-right font-bold ${marginColor(item.marginPct)}`}>
                          {item.cost > 0 ? `${item.marginPct.toFixed(1)}%` : '—'}
                        </td>
                        <td className="p-3 text-center">
                          {item.cost > 0 ? (
                            <Badge className={`text-[10px] ${marginBadge(item.marginPct)}`}>
                              {item.marginPct >= 60 ? 'Odlična' : item.marginPct >= 40 ? 'Zadostna' : 'Nizka'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Brez podatka
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredMarginData.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">Ni najdenih artiklov</p>
              )}
            </CardContent>
          </Card>

          {/* Legenda */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500" /> Odlična marža (≥60%)</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-500" /> Zadostna marža (40-60%)</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-500" /> Nizka marža (&lt;40%)</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-gray-300" /> Brez podatka</span>
          </div>
        </TabsContent>
      </Tabs>

      {/* ===================== DIALOG: DODAJ SESTAVINO ===================== */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Dodaj sestavino v recept
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Meni artikel *</Label>
              <Select value={addForm.menuItemId} onValueChange={v => setAddForm(prev => ({ ...prev, menuItemId: v }))}>
                <SelectTrigger><SelectValue placeholder="Izberite artikel iz jedilnika..." /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {menuItems?.map(mi => (
                    <SelectItem key={mi.id} value={mi.id}>{mi.name} (€{mi.price.toFixed(2)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Založni artikel *</Label>
              <Select value={addForm.inventoryItemId} onValueChange={v => {
                const inv = inventoryItems?.find(i => i.id === v)
                setAddForm(prev => ({
                  ...prev,
                  inventoryItemId: v,
                  unit: inv?.unit || '',
                }))
              }}>
                <SelectTrigger><SelectValue placeholder="Izberite sestavino iz zaloge..." /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {inventoryItems?.sort((a, b) => a.name.localeCompare(b.name)).map(inv => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.name} — €{inv.costPerUnit.toFixed(2)}/{inv.unit} (zaloga: {inv.quantity} {inv.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Količina na porcijo *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={addForm.quantityPerServing}
                  onChange={e => setAddForm(prev => ({ ...prev, quantityPerServing: e.target.value }))}
                  placeholder="npr. 0.25"
                />
              </div>
              <div className="space-y-2">
                <Label>Enota</Label>
                <Input value={addForm.unit} onChange={e => setAddForm(prev => ({ ...prev, unit: e.target.value }))} placeholder="npr. kg, L, kos" />
              </div>
            </div>
            {/* Predračun stroška */}
            {addForm.inventoryItemId && addForm.quantityPerServing && (() => {
              const inv = inventoryItems?.find(i => i.id === addForm.inventoryItemId)
              if (!inv) return null
              const cost = parseFloat(addForm.quantityPerServing) * inv.costPerUnit
              return (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Nabavna cena/enoto:</span><span>€{inv.costPerUnit.toFixed(2)}/{inv.unit}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Količina na porcijo:</span><span>{addForm.quantityPerServing} {addForm.unit || inv.unit}</span></div>
                  <div className="flex justify-between font-semibold"><span>Strošek na porcijo:</span><span className="text-red-600">€{cost.toFixed(2)}</span></div>
                </div>
              )
            })()}
            <div className="space-y-2">
              <Label>Opombe</Label>
              <Input value={addForm.notes} onChange={e => setAddForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Opombe za pripravo..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Prekliči</Button>
            <Button
              onClick={() => addMutation.mutate(addForm)}
              disabled={!addForm.menuItemId || !addForm.inventoryItemId || !addForm.quantityPerServing || addMutation.isPending}
            >
              {addMutation.isPending ? 'Dodajam...' : 'Dodaj sestavino'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== DIALOG: UREDI SESTAVINO ===================== */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Uredi sestavino
            </DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Artikel:</span><span className="font-medium">{editItem.menuItem.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Sestavina:</span><span className="font-medium">{editItem.inventoryItem.name}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Količina na porcijo</Label>
                  <Input type="number" step="0.01" value={editForm.quantityPerServing} onChange={e => setEditForm(prev => ({ ...prev, quantityPerServing: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Enota</Label>
                  <Input value={editForm.unit} onChange={e => setEditForm(prev => ({ ...prev, unit: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Opombe</Label>
                <Input value={editForm.notes} onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Prekliči</Button>
            <Button onClick={() => editItem && editMutation.mutate({ id: editItem.id, ...editForm })} disabled={editMutation.isPending}>
              {editMutation.isPending ? 'Shranjujem...' : 'Shrani'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
