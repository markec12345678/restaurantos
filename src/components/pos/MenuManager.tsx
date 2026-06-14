'use client'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, UtensilsCrossed, Tag, BookOpen, Settings2 } from 'lucide-react'
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { useMenuManager } from './menu/useMenuManager'

// Lazy-loaded pod-komponente
const ItemsTab = dynamic(() => import('./menu/ItemsTab').then(m => ({ default: m.ItemsTab })), { ssr: false })
const CategoriesTab = dynamic(() => import('./menu/CategoriesTab').then(m => ({ default: m.CategoriesTab })), { ssr: false })
const MenusTab = dynamic(() => import('./menu/MenusTab').then(m => ({ default: m.MenusTab })), { ssr: false })
const ModifiersTab = dynamic(() => import('./menu/ModifiersTab').then(m => ({ default: m.ModifiersTab })), { ssr: false })
const ItemDialog = dynamic(() => import('./menu/ItemDialog').then(m => ({ default: m.ItemDialog })), { ssr: false })
const CategoryDialog = dynamic(() => import('./menu/CategoryDialog').then(m => ({ default: m.CategoryDialog })), { ssr: false })
const MenuDialog = dynamic(() => import('./menu/MenuDialog').then(m => ({ default: m.MenuDialog })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================
export const MenuManager = memo(function MenuManager() {
  const {
    viewMode, setViewMode, search, setSearch,
    filterCategory, setFilterCategory, filterMenu, setFilterMenu,
    activeTab, setActiveTab,
    dialogOpen, setDialogOpen, editingItem, itemForm, setItemForm,
    catDialogOpen, setCatDialogOpen, catForm, setCatForm,
    menuDialogOpen, setMenuDialogOpen, menuForm, setMenuForm,
    menus, categories, modifierGroups, menuItems: _menuItems, isLoading, filteredItems,
    createMenuMutation, deleteItemMutation, toggleAvailabilityMutation, createCatMutation,
    openCreateItem, openEditItem, handleItemSubmit,
    openCreateCategory, openCreateMenu,
  } = useMenuManager()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Upravljanje jedilnika</h2>
          <p className="text-muted-foreground">Upravljajte menije, kategorije in artikle</p>
        </div>
        <Button onClick={openCreateItem}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj artikel
        </Button>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="items">
            <UtensilsCrossed className="h-4 w-4 mr-1" />
            Artikli
          </TabsTrigger>
          <TabsTrigger value="categories">
            <Tag className="h-4 w-4 mr-1" />
            Kategorije
          </TabsTrigger>
          <TabsTrigger value="menus">
            <BookOpen className="h-4 w-4 mr-1" />
            Meniji
          </TabsTrigger>
          <TabsTrigger value="modifiers">
            <Settings2 className="h-4 w-4 mr-1" />
            Dodatki
          </TabsTrigger>
        </TabsList>
        {/* Tab artiklov */}
        <TabsContent value="items" className="space-y-4">
          <ItemsTab
            search={search}
            onSearchChange={setSearch}
            filterMenu={filterMenu}
            onFilterMenuChange={(v) => { setFilterMenu(v); setFilterCategory('all') }}
            filterCategory={filterCategory}
            onFilterCategoryChange={setFilterCategory}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            filteredItems={filteredItems}
            categories={categories}
            menus={menus}
            isLoading={isLoading}
            onEditItem={openEditItem}
            onDeleteItem={(id) => deleteItemMutation.mutate(id)}
            onToggleAvailability={(id, isAvailable) => toggleAvailabilityMutation.mutate({ id, isAvailable })}
          />
        </TabsContent>
        {/* Tab kategorij */}
        <TabsContent value="categories" className="space-y-4">
          <CategoriesTab
            menus={menus}
            categories={categories}
            onAddCategory={openCreateCategory}
          />
        </TabsContent>
        {/* Tab menijev */}
        <TabsContent value="menus" className="space-y-4">
          <MenusTab
            menus={menus}
            categories={categories}
            onAddMenu={openCreateMenu}
          />
        </TabsContent>
        {/* Tab dodatkov */}
        <TabsContent value="modifiers" className="space-y-4">
          <ModifiersTab modifierGroups={modifierGroups} />
        </TabsContent>
      </Tabs>
      {/* Item Dialog */}
      <ItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingItem={editingItem}
        itemForm={itemForm}
        onItemFormChange={setItemForm}
        menus={menus}
        categories={categories}
        modifierGroups={modifierGroups}
        onSubmit={handleItemSubmit}
      />
      {/* Category Dialog */}
      <CategoryDialog
        open={catDialogOpen}
        onOpenChange={setCatDialogOpen}
        catForm={catForm}
        onCatFormChange={setCatForm}
        menus={menus}
        onSubmit={() => createCatMutation.mutate(catForm as unknown as Record<string, unknown>)}
      />
      {/* Menu Dialog */}
      <MenuDialog
        open={menuDialogOpen}
        onOpenChange={setMenuDialogOpen}
        menuForm={menuForm}
        onMenuFormChange={setMenuForm}
        onSubmit={() => createMenuMutation.mutate(menuForm as unknown as Record<string, unknown>)}
      />
    </div>
  )
})
