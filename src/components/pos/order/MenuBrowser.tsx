'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Search, X } from 'lucide-react'
import { useState, useMemo } from 'react'
import { AllergenFilterBar } from './AllergenFilterBar'
import { OrderTypeBar } from './OrderTypeBar'
import { MenuCategoryNav } from './MenuCategoryNav'
import { MenuItemCard } from './MenuItemCard'
import { ModifierDialog } from './ModifierDialog'
import type { SelectedModifier } from '@/lib/store'
import type {
  ModifierGroupType, MenuItemType, MenuType,
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
  // Lokalno stanje za kategorije, super-skupine, iskanje, modifier dialog
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [activeSuperGroup, setActiveSuperGroup] = useState<string>('all')
  const [itemSearch, setItemSearch] = useState<string>('')
  // Modifier dialog
  const [modifierDialogItem, setModifierDialogItem] = useState<MenuItemType | null>(null)
  const [selectedModifiers, setSelectedModifiers] = useState<Map<string, SelectedModifier>>(new Map())

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

  // Handlerji
  const handleItemClick = (item: MenuItemType) => {
    const stockInfo = menuStockMap?.[item.id]
    if (stockInfo?.status === 'out') {
      toast.error(`"${item.name}" ni na zalogi!`, { description: 'Artikla ni mogoče naročiti.' })
      return
    }
    if (stockInfo?.status === 'low') {
      toast.warning(`Nizka zaloga: "${item.name}"`, { description: `Na voljo samo ${stockInfo.available} servisov.` })
    }
    if (item.modifierGroups?.length > 0) {
      setModifierDialogItem(item)
      setSelectedModifiers(new Map())
    } else {
      onAddToCart({ id: item.id, name: item.name, price: item.price, categoryId: item.categoryId, image: item.image })
      onSetLastAddedId(item.id)
      setTimeout(() => onSetLastAddedId(null), 500)
    }
  }

  const handleModifierToggle = (group: ModifierGroupType['modifierGroup'], modifier: { id: string; name: string; price: number }) => {
    setSelectedModifiers(prev => {
      const newMap = new Map(prev)
      const key = modifier.id
      if (group.maxSelect && !newMap.has(key)) {
        const currentCount = Array.from(newMap.values()).filter(m => m.modifierGroupId === group.id).length
        if (currentCount >= group.maxSelect) {
          const toRemove = Array.from(newMap.entries()).find(([_, v]) => v.modifierGroupId === group.id)
          if (toRemove) newMap.delete(toRemove[0])
        }
      }
      if (newMap.has(key)) { newMap.delete(key) }
      else {
        newMap.set(key, { id: modifier.id, name: modifier.name, price: modifier.price, modifierGroupId: group.id, modifierGroupName: group.name })
      }
      return newMap
    })
  }

  const handleModifierConfirm = () => {
    if (!modifierDialogItem) return
    const unmetRequired = modifierDialogItem.modifierGroups
      .filter(mg => mg.modifierGroup.required)
      .filter(mg => {
        const selected = Array.from(selectedModifiers.values()).filter(m => m.modifierGroupId === mg.modifierGroup.id)
        return selected.length < (mg.modifierGroup.minSelect || 1)
      })
    if (unmetRequired.length > 0) {
      toast.error(`Obvezna izbira: ${unmetRequired.map(mg => mg.modifierGroup.name).join(', ')}`)
      return
    }
    const modifiers = Array.from(selectedModifiers.values())
    onAddToCart({ id: modifierDialogItem.id, name: modifierDialogItem.name, price: modifierDialogItem.price, categoryId: modifierDialogItem.categoryId, image: modifierDialogItem.image, modifiers })
    onSetLastAddedId(modifierDialogItem.id)
    setTimeout(() => onSetLastAddedId(null), 500)
    setModifierDialogItem(null)
    setSelectedModifiers(new Map())
  }

  const modifierExtraPrice = modifierDialogItem ? Array.from(selectedModifiers.values()).reduce((s, m) => s + m.price, 0) : 0

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
      {/* Quick Search */}
      {itemSearch && (
        <div className="px-3 pt-2 flex items-center gap-2 flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Išči artikel..."
              value={itemSearch}
              onChange={e => setItemSearch(e.target.value)}
              className="h-8 text-xs pl-8 pr-8"
              aria-label="Išči artikel"
              autoFocus
            />
            <Button variant="ghost" size="icon" aria-label="Zapri" className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setItemSearch('')}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <Badge variant="secondary" className="text-[10px] h-6 flex-shrink-0">{filteredMenuItems.length}</Badge>
        </div>
      )}
      {!itemSearch && (
        <div className="px-3 pt-2 flex-shrink-0">
          <button
            onClick={() => setItemSearch(' ')}
            className="flex items-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 px-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5"
          >
            <Search className="h-4 w-4" />
            <span>Išči artikel...</span>
            <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded border font-mono">⌘K</kbd>
          </button>
        </div>
      )}
      {/* ITEMS GRID */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {menuLoading || menusLoading ? (
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-2.5">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
          </div>
        ) : filteredMenuItems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Ni artiklov v tej kategoriji
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {filteredMenuItems.map((item: MenuItemType) => {
              const inCart = cart.filter(c => c.id === item.id)
              const totalQty = inCart.reduce((sum, c) => sum + c.quantity, 0)
              const stockInfo = menuStockMap?.[item.id]
              const isOutOfStock = stockInfo?.status === 'out'
              return (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  totalQty={totalQty}
                  lastAddedId={lastAddedId}
                  stockInfo={stockInfo}
                  onClick={() => !isOutOfStock && handleItemClick(item)}
                />
              )
            })}
          </div>
        )}
      </div>
      {/* MODIFIER DIALOG */}
      <ModifierDialog
        modifierDialogItem={modifierDialogItem}
        selectedModifiers={selectedModifiers}
        modifierExtraPrice={modifierExtraPrice}
        onToggle={handleModifierToggle}
        onConfirm={handleModifierConfirm}
        onClose={() => { setModifierDialogItem(null); setSelectedModifiers(new Map()) }}
      />
    </div>
  )
}
