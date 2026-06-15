'use client'

import { useState, useMemo } from 'react'
import { AllergenFilterBar } from './AllergenFilterBar'
import { OrderTypeBar } from './OrderTypeBar'
import { MenuCategoryNav } from './MenuCategoryNav'
import { MenuItemsGrid } from './MenuItemsGrid'
import { ModifierDialog } from './ModifierDialog'
import { useModifierSelection } from './useModifierSelection'
import { useMenuBrowserLogic, buildSuperGroups } from './useMenuBrowserLogic'
import type { SelectedModifier } from '@/lib/store'
import type {
  MenuItemType, MenuType,
  SuperGroupType, StockInfoType,
} from './types'

// Re-izvoz tipov za združljivost z obstoječimi uvozi
export type { ModifierGroupType, MenuItemType, MenuType, SuperGroupType, StockInfoType } from './types'

export interface MenuBrowserProps {
  menus: MenuType[] | undefined
  menuItems: MenuItemType[] | undefined
  tables: { id: string; number: number; capacity: number; status: string }[] | undefined
  diningOptions: { id: string; name: string; type: string }[] | undefined
  discounts: { id: string; name: string; type: string; amount: number }[] | undefined
  menuStockMap: Record<string, StockInfoType> | undefined
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
  cart: { id: string; quantity: number }[]
  editingOrderId: string | null
  editingOrderNumber: number | null
  menusLoading: boolean
  menuLoading: boolean
  onAddToCart: (_item: { id: string; name: string; price: number; categoryId: string; image: string; modifiers?: SelectedModifier[] }) => void
  onSetLastAddedId: (_id: string | null) => void
  lastAddedId: string | null
}

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
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [activeSuperGroup, setActiveSuperGroup] = useState<string>('all')
  const [itemSearch, setItemSearch] = useState<string>('')

  const {
    modifierDialogItem,
    selectedModifiers,
    modifierExtraPrice,
    handleItemClick,
    handleModifierToggle,
    handleModifierConfirm,
    closeModifierDialog,
  } = useModifierSelection({ onAddToCart, onSetLastAddedId })

  const superGroups: SuperGroupType[] = useMemo(() => {
    // Need to get categories first for buildSuperGroups
    const resolvedMenuId = activeMenuId || (menus && menus.length > 0 ? menus[0].id : null)
    const activeMenu = menus?.find((m: MenuType) => m.id === resolvedMenuId)
    const categoriesForMenu = activeMenu?.categories || []
    return buildSuperGroups(categoriesForMenu || [])
  }, [activeMenuId, menus])

  const { resolvedMenuId, categoriesForMenu, filteredMenuItems } = useMenuBrowserLogic({
    menus,
    menuItems,
    activeMenuId,
    activeCategory,
    activeSuperGroup,
    superGroups,
    itemSearch,
  })

  const onItemClicked = (item: MenuItemType) => {
    const stockInfo = menuStockMap?.[item.id]
    handleItemClick(item, stockInfo ? { status: stockInfo.status, available: stockInfo.available } : undefined)
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
      <AllergenFilterBar />
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
