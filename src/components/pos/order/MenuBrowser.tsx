'use client'

import { useState, useMemo } from 'react'
import { AllergenFilterBar } from './AllergenFilterBar'
import { OrderTypeBar } from './OrderTypeBar'
import { MenuCategoryNav } from './MenuCategoryNav'
import { MenuItemsGrid } from './MenuItemsGrid'
import { ModifierDialog } from './ModifierDialog'
import { useModifierSelection } from './useModifierSelection'
import type { SelectedModifier } from '@/lib/store'
import type {
  MenuItemType, MenuType,
  SuperGroupType, StockInfoType,
} from './types'

// Re-izvoz tipov za združljivost z obstoječimi uvozi
export type { ModifierGroupType, MenuItemType, MenuType, SuperGroupType, StockInfoType } from './types'

export interface MenuBrowserProps {
  // Podatki
  menus: MenuType[] | undefined
  menuItems: MenuItemType[] | undefined
  tables: { id: string; number: number; capacity: number; status: string }[] | undefined
  diningOptions: { id: string; name: string; type: string }[] | undefined
  discounts: { id: string; name: string; type: string; amount: number }[] | undefined
  menuStockMap: Record<string, StockInfoType> | undefined
  // Store state
  orderType: string
  setOrderType: (_type: string) => void
  selectedTable: string | null
  setSelectedTable: (_tableId: string | null) => void
  activeMenuId: string | null
  setActiveMenuId: (_menuId: string | null) => void
  diningOptionId: string | null
  setDiningOptionId: (_id: string | null) => void
  discount: number
  setDiscount: (_discount: number) => void
  appliedDiscountId: string | null
  setAppliedDiscountId: (_id: string | null) => void
  subtotal: number
  // Cart info za badge
  cart: { id: string; quantity: number }[]
  // Editing
  editingOrderId: string | null
  editingOrderNumber: number | null
  // Loading
  menusLoading: boolean
  menuLoading: boolean
  // Handlerji
  onAddToCart: (_item: { id: string; name: string; price: number; categoryId: string; image: string; modifiers?: SelectedModifier[] }) => void
  onSetLastAddedId: (_id: string | null) => void
  lastAddedId: string | null
}

// ============================================
// MENU BROWSER - Brskanje po meniju
// ============================================
export function MenuBrowser({
  menus,
  menuItems,
  tables,
  diningOptions,
  discounts: _discounts,
  menuStockMap,
  orderType,
  setOrderType,
  selectedTable,
  setSelectedTable,
  activeMenuId,
  setActiveMenuId,
  diningOptionId,
  setDiningOptionId,
  discount: _discount,
  setDiscount: _setDiscount,
  appliedDiscountId: _appliedDiscountId,
  setAppliedDiscountId: _setAppliedDiscountId,
  subtotal: _subtotal,
  cart,
  editingOrderId: _editingOrderId,
  editingOrderNumber: _editingOrderNumber,
  menusLoading,
  menuLoading,
  onAddToCart,
  onSetLastAddedId,
  lastAddedId,
}: MenuBrowserProps) {
  // Lokalno stanje za kategorije, super-skupine, iskanje
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [activeSuperGroup, setActiveSuperGroup] = useState<string>('all')
  const [itemSearch, setItemSearch] = useState<string>('')

  // Modifier selection hook
  const {
    modifierDialogItem,
    selectedModifiers,
    modifierExtraPrice,
    handleItemClick,
    handleModifierToggle,
    handleModifierConfirm,
    closeModifierDialog,
  } = useModifierSelection({ onAddToCart, onSetLastAddedId })

  // Izračuni
  const resolvedMenuId = useMemo(() => {
    if (activeMenuId) return activeMenuId
    if (menus && menus.length > 0) return menus[0].id
    return null
  }, [activeMenuId, menus])

  const activeMenu = menus?.find((m: MenuType) => m.id === resolvedMenuId)
  const categoriesForMenu = activeMenu?.categories || []

  // SUPER-GROUPS for drinks menu (Toast POS style sub-groups)
  const superGroups: SuperGroupType[] = useMemo(() => {
    const catNames = categoriesForMenu.map((c: { name: string }) => c.name)
    // Only define super-groups for the drinks menu (Pijača)
    if (!catNames.includes('Penine in Šampanjci')) return []
    return [
      { id: 'vina', name: 'Vina', icon: '🍷', color: '#7c2d12', categoryIds: categoriesForMenu.filter((c: { name: string }) => ['Penine in Šampanjci', 'Bela Vina', 'Rosé Vino', 'Rdeča Vina', 'Tuja Vina', 'Likersko Vino'].includes(c.name)).map((c: { id: string }) => c.id) },
      { id: 'piva', name: 'Piva', icon: '🍺', color: '#d97706', categoryIds: categoriesForMenu.filter((c: { name: string }) => ['Točeno Pivo', 'Pivo', 'Craft Piva', 'Brezalkoholno Pivo'].includes(c.name)).map((c: { id: string }) => c.id) },
      { id: 'zganepijace', name: 'Žgane pijače', icon: '🥃', color: '#6b21a8', categoryIds: categoriesForMenu.filter((c: { name: string }) => ['Viski', 'Gin', 'Likerji', 'Grenčice', 'Destilati, Konjak in Rum'].includes(c.name)).map((c: { id: string }) => c.id) },
      { id: 'napitki', name: 'Napitki', icon: '☕', color: '#92400e', categoryIds: categoriesForMenu.filter((c: { name: string }) => ['Topli Napitki', 'Mešane Pijače'].includes(c.name)).map((c: { id: string }) => c.id) },
      { id: 'brezalkoholne', name: 'Brezalkoholne', icon: '🥤', color: '#0ea5e9', categoryIds: categoriesForMenu.filter((c: { name: string }) => ['Vode', 'Naravni Sokovi', 'Sokovi', 'Gazirane Pijače'].includes(c.name)).map((c: { id: string }) => c.id) },
    ]
  }, [categoriesForMenu])

  const filteredMenuItems = useMemo(() => {
    return menuItems?.filter(
      (item: MenuItemType) => {
        const matchesMenu = !resolvedMenuId || item.category?.menu?.id === resolvedMenuId
        const matchesCategory = activeCategory === 'all' || item.categoryId === activeCategory
        const matchesSuperGroup = activeSuperGroup === 'all' ||
          superGroups.some(sg => sg.id === activeSuperGroup && sg.categoryIds.includes(item.categoryId))
        const matchesSearch = !itemSearch || item.name.toLowerCase().includes(itemSearch.toLowerCase())
        return matchesMenu && matchesCategory && matchesSuperGroup && matchesSearch && item.isAvailable
      }
    ) || []
  }, [menuItems, resolvedMenuId, activeCategory, activeSuperGroup, superGroups, itemSearch])

  // Wrapper za handleItemClick z stock info
  const onItemClicked = (item: MenuItemType) => {
    const stockInfo = menuStockMap?.[item.id]
    handleItemClick(item, stockInfo ? { status: stockInfo.status, available: stockInfo.available } : undefined)
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Order Type + Table Bar */}
      <OrderTypeBar
        orderType={orderType}
        setOrderType={setOrderType}
        diningOptionId={diningOptionId}
        setDiningOptionId={setDiningOptionId}
        selectedTable={selectedTable}
        setSelectedTable={setSelectedTable}
        tables={tables}
        diningOptions={diningOptions}
      />
      {/* Menu Tabs + Category Navigation */}
      <MenuCategoryNav
        menus={menus}
        resolvedMenuId={resolvedMenuId}
        activeMenuId={activeMenuId}
        setActiveMenuId={setActiveMenuId}
        categoriesForMenu={categoriesForMenu}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        activeSuperGroup={activeSuperGroup}
        setActiveSuperGroup={setActiveSuperGroup}
        superGroups={superGroups}
      />
      {/* ALLERGEN FILTER BAR - EU 1169/2011 */}
      <AllergenFilterBar />
      {/* Items Grid s search */}
      <MenuItemsGrid
        filteredMenuItems={filteredMenuItems}
        menuStockMap={menuStockMap}
        cart={cart}
        lastAddedId={lastAddedId}
        itemSearch={itemSearch}
        onItemSearchChange={setItemSearch}
        onItemClick={onItemClicked}
        menusLoading={menusLoading}
        menuLoading={menuLoading}
      />
      {/* MODIFIER DIALOG */}
      <ModifierDialog
        modifierDialogItem={modifierDialogItem}
        selectedModifiers={selectedModifiers}
        modifierExtraPrice={modifierExtraPrice}
        onToggle={handleModifierToggle}
        onConfirm={handleModifierConfirm}
        onClose={closeModifierDialog}
      />
    </div>
  )
}
