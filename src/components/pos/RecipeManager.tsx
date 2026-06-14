'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { BookOpen, Plus, ChefHat, TrendingUp } from 'lucide-react'
import { useState, useMemo, memo } from 'react'
import dynamic from 'next/dynamic'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { RecipeItemData, AddFormState, EditFormState } from './recipe/constants'

// Lazy-loaded podkomponente
const RecipeTab = dynamic(() => import('./recipe/RecipeTab').then(m => ({ default: m.RecipeTab })), { ssr: false })
const MarginsTab = dynamic(() => import('./recipe/MarginsTab').then(m => ({ default: m.MarginsTab })), { ssr: false })
const AddRecipeDialog = dynamic(() => import('./recipe/AddRecipeDialog').then(m => ({ default: m.AddRecipeDialog })), { ssr: false })
const EditRecipeDialog = dynamic(() => import('./recipe/EditRecipeDialog').then(m => ({ default: m.EditRecipeDialog })), { ssr: false })

// ============================================
// KOMPONENTA
// ============================================
export const RecipeManager = memo(function RecipeManager() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('recipes')
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [filterMenu, setFilterMenu] = useState('all')

  // Dodajanje sestavine dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addForm, setAddForm] = useState<AddFormState>({
    menuItemId: '', inventoryItemId: '', quantityPerServing: '', unit: '', notes: ''
  })

  // Urejanje sestavine dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<RecipeItemData | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>({ quantityPerServing: '', unit: '', notes: '' })

  // ============================================
  // QUERIES
  // ============================================
  const { data: recipes } = useQuery<RecipeItemData[]>({
    queryKey: queryKeys.recipes.all,
    queryFn: async () => {
      const res = await authFetch('/api/recipes')
      return res.json()
    },
  })

  const { data: menuItems } = useQuery<import('./recipe/constants').MenuItemData[]>({
    queryKey: queryKeys.menuItems.all,
    queryFn: async () => {
      const res = await authFetch('/api/menu-items')
      return res.json()
    },
  })

  const { data: inventoryItems } = useQuery<import('./recipe/constants').InventoryData[]>({
    queryKey: queryKeys.inventory.all,
    queryFn: async () => {
      const res = await authFetch('/api/inventory')
      return res.json()
    },
  })

  const sortedInventoryItems = useMemo(() => inventoryItems ? [...inventoryItems].sort((a, b) => a.name.localeCompare(b.name)) : [], [inventoryItems])

  // ============================================
  // MUTATIONS
  // ============================================
  const addMutation = useMutation({
    mutationFn: async (data: AddFormState) => {
      const res = await authFetch('/api/recipes', {
        method: 'POST',
        body: JSON.stringify({
          menuItemId: data.menuItemId,
          inventoryItemId: data.inventoryItemId,
          quantityPerServing: parseFloat(data.quantityPerServing) || 0,
          unit: data.unit,
          notes: data.notes,
        }),
      })
      return res.json()
    },
    onSuccess: () => { toast.success('Sestavina dodana'); queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all }); setAddDialogOpen(false) },
    onError: (err: Error) => toast.error(err.message),
  })

  const editMutation = useMutation({
    mutationFn: async (data: { id: string } & EditFormState) => {
      const res = await authFetch('/api/recipes', {
        method: 'PUT',
        body: JSON.stringify({
          id: data.id,
          quantityPerServing: parseFloat(data.quantityPerServing) || 0,
          unit: data.unit,
          notes: data.notes,
        }),
      })
      return res.json()
    },
    onSuccess: () => { toast.success('Sestavina posodobljena'); queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all }); setEditDialogOpen(false); setEditItem(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/recipes?id=${id}`, { method: 'DELETE' })
      return res.json()
    },
    onSuccess: () => { toast.success('Sestavina odstranjena'); queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all }) },
  })

  // ============================================
  // IZRACUNI
  // ============================================
  // Skupine receptov po menijih
  const recipeGroups = useMemo(() => {
    if (!recipes || !menuItems) return { hrana: [], pijaca: [] }
    const hranaItems = menuItems.filter(mi => mi.category?.menu?.name === 'Hrana')
    const pijacaItems = menuItems.filter(mi => mi.category?.menu?.name === 'Pijaca')

    const groupItems = (items: import('./recipe/constants').MenuItemData[]) => items.map(mi => {
      const itemRecipes = recipes.filter(r => r.menuItemId === mi.id)
      const totalCost = itemRecipes.reduce((sum, r) => sum + r.costPerServing, 0)
      // Fallback na inventory costPerServing ce ni recepta
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

  // Pregled marz - vsi artikli
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Recepti in normativi
          </h2>
          <p className="text-muted-foreground">Upravljanje receptov, normativov in pregled marz</p>
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
            <TrendingUp className="h-3.5 w-3.5" /> Pregled marz
          </TabsTrigger>
        </TabsList>

        {/* ===================== TAB: RECEPTI PO JEDEH ===================== */}
        <TabsContent value="recipes" className="mt-4">
          <RecipeTab
            recipeGroups={recipeGroups}
            search={search}
            onSearchChange={setSearch}
            selectedMenuItemId={selectedMenuItemId}
            onSelectedMenuItemIdChange={setSelectedMenuItemId}
            selectedItem={selectedItem ?? null}
            selectedRecipes={selectedRecipes}
            selectedTotalCost={selectedTotalCost}
            onOpenAddDialog={openAddDialog}
            onOpenEditDialog={openEditDialog}
            onDeleteRecipe={(id) => deleteMutation.mutate(id)}
          />
        </TabsContent>

        {/* ===================== TAB: PREGLED MARŽ ===================== */}
        <TabsContent value="margins" className="mt-4">
          <MarginsTab
            search={search}
            onSearchChange={setSearch}
            filterMenu={filterMenu}
            onFilterMenuChange={setFilterMenu}
            filteredMarginData={filteredMarginData}
            marginStats={marginStats}
          />
        </TabsContent>
      </Tabs>

      {/* ===================== DIALOG: DODAJ SESTAVINO ===================== */}
      <AddRecipeDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        form={addForm}
        onFormChange={setAddForm}
        menuItems={menuItems}
        sortedInventoryItems={sortedInventoryItems}
        inventoryItems={inventoryItems}
        isPending={addMutation.isPending}
        onSubmit={() => addMutation.mutate(addForm)}
      />

      {/* ===================== DIALOG: UREDI SESTAVINO ===================== */}
      <EditRecipeDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editItem={editItem}
        form={editForm}
        onFormChange={setEditForm}
        isPending={editMutation.isPending}
        onSubmit={() => editItem && editMutation.mutate({ id: editItem.id, ...editForm })}
      />
    </div>
  )
})
