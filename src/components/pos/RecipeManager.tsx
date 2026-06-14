'use client'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookOpen, Plus, ChefHat, TrendingUp } from 'lucide-react'
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { useRecipeManager } from './recipe/useRecipeManager'

// Lazy-loaded podkomponente
const RecipeTab = dynamic(() => import('./recipe/RecipeTab').then(m => ({ default: m.RecipeTab })), { ssr: false })
const MarginsTab = dynamic(() => import('./recipe/MarginsTab').then(m => ({ default: m.MarginsTab })), { ssr: false })
const AddRecipeDialog = dynamic(() => import('./recipe/AddRecipeDialog').then(m => ({ default: m.AddRecipeDialog })), { ssr: false })
const EditRecipeDialog = dynamic(() => import('./recipe/EditRecipeDialog').then(m => ({ default: m.EditRecipeDialog })), { ssr: false })

// ============================================
// KOMPONENTA
// ============================================
export const RecipeManager = memo(function RecipeManager() {
  const {
    activeTab, setActiveTab,
    selectedMenuItemId, setSelectedMenuItemId,
    search, setSearch,
    filterMenu, setFilterMenu,
    addDialogOpen, setAddDialogOpen,
    addForm, setAddForm,
    editDialogOpen, setEditDialogOpen,
    editItem,
    editForm, setEditForm,
    menuItems, sortedInventoryItems, inventoryItems,
    recipeGroups,
    filteredMarginData, marginStats,
    selectedItem, selectedRecipes, selectedTotalCost,
    addMutation, editMutation, deleteMutation,
    openAddDialog, openEditDialog,
  } = useRecipeManager()

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

        {/* TAB: RECEPTI PO JEDEH */}
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

        {/* TAB: PREGLED MARŽ */}
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

      {/* DIALOG: DODAJ SESTAVINO */}
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

      {/* DIALOG: UREDI SESTAVINO */}
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
