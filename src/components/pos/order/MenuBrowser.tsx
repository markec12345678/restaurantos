'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Search, X, ChevronRight, Check, Users, ImageIcon, ShieldAlert } from 'lucide-react'
import { useState, useMemo } from 'react'
import { AllergenFilterBar } from './AllergenFilterBar'
import type { SelectedModifier } from '@/lib/store'

// ============================================
// TIPI
// ============================================
export interface ModifierGroupType {
  id: string
  sortOrder: number
  modifierGroup: {
    id: string
    name: string
    required: boolean
    minSelect: number
    maxSelect: number | null
    modifiers: { id: string; name: string; price: number; sortOrder: number }[]
  }
}
export interface MenuItemType {
  id: string
  name: string
  description: string
  price: number
  image: string
  isAvailable: boolean
  sortOrder: number
  categoryId: string
  allergens?: string
  category: { id: string; name: string; menu: { id: string; name: string } }
  modifierGroups: ModifierGroupType[]
}
export interface MenuType {
  id: string
  name: string
  icon: string
  color: string
  isActive: boolean
  categories: { id: string; name: string; icon: string; color: string; menuItems: MenuItemType[] }[]
}
export interface SuperGroupType {
  id: string
  name: string
  icon: string
  color: string
  categoryIds: string[]
}
export interface StockInfoType {
  status: 'ok' | 'low' | 'out'
  available: number
  unit: string
}

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
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
        <Select value={orderType} onValueChange={setOrderType}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dine-in">🍽️ Na mestu</SelectItem>
            <SelectItem value="takeout">📦 Za s seboj</SelectItem>
            <SelectItem value="delivery">🚚 Dostava</SelectItem>
          </SelectContent>
        </Select>
        {/* Dining option iz konfiguracije */}
        {diningOptions && diningOptions.length > 0 && (
          <Select value={diningOptionId || 'none'} onValueChange={(v) => setDiningOptionId(v === 'none' ? null : v)}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Način postrežbe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Privzeto</SelectItem>
              {diningOptions.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.type === 'dine-in' ? '🍽️' : opt.type === 'takeout' ? '📦' : '🚚'} {opt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {orderType === 'dine-in' && (
          <Select value={selectedTable || ''} onValueChange={setSelectedTable}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Izberi mizo" />
            </SelectTrigger>
            <SelectContent>
              {tables?.filter((t) => t.status === 'available' || t.status === 'occupied').map((table) => (
                <SelectItem key={table.id} value={table.id}>
                  Miza {table.number} ({table.capacity} mest)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {selectedTable && orderType === 'dine-in' && (
          <Badge variant="outline" className="text-xs h-6">
            <Users className="h-3 w-3 mr-1" />
            Miza {tables?.find((t) => t.id === selectedTable)?.number}
          </Badge>
        )}
      </div>
      {/* MENU TABS - Toast Style (Food / Drinks) */}
      <div className="flex gap-1.5 px-4 py-2.5 border-b border-border flex-shrink-0">
        {menus?.map((menu: MenuType, idx: number) => {
          const isActive = resolvedMenuId === menu.id || (!resolvedMenuId && idx === 0)
          return (
            <button
              key={menu.id}
              onClick={() => { setActiveMenuId(menu.id); setActiveCategory('all'); setActiveSuperGroup('all') }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-base font-bold transition-all duration-150 ${
                isActive
                  ? 'text-white shadow-md scale-[1.02]'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
              style={isActive ? { backgroundColor: menu.color } : {}}
            >
              <span className="text-lg">{menu.icon}</span>
              {menu.name}
            </button>
          )
        })}
      </div>
      {/* ALLERGEN FILTER BAR - EU 1169/2011 */}
      <AllergenFilterBar />
      {/* CATEGORY NAVIGATION - Smart layout for large category counts */}
      {categoriesForMenu.length > 10 ? (
        /* GROUPED CATEGORIES for drinks menu (21 categories) */
        <div className="border-b border-border flex-shrink-0">
          {/* Super-group tabs */}
          <div className="flex gap-1 px-4 py-1.5 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => { setActiveCategory('all'); setActiveSuperGroup('all') }}
              className={`flex-shrink-0 px-3 py-1 rounded-md text-[11px] font-bold transition-colors ${
                activeCategory === 'all' && activeSuperGroup === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              Vse
            </button>
            {superGroups.map((sg) => (
              <button
                key={sg.id}
                onClick={() => { setActiveSuperGroup(sg.id); setActiveCategory('all') }}
                className={`flex-shrink-0 px-3 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  activeSuperGroup === sg.id
                    ? 'text-white'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
                style={activeSuperGroup === sg.id ? { backgroundColor: sg.color } : {}}
              >
                {sg.icon} {sg.name}
              </button>
            ))}
          </div>
          {/* Sub-categories within active super-group */}
          {activeSuperGroup !== 'all' && (
            <div className="flex gap-1 px-4 py-1.5 overflow-x-auto custom-scrollbar">
              {categoriesForMenu
                .filter((cat: { id: string; name: string; icon: string; color: string }) => {
                  const sg = superGroups.find(s => s.categoryIds.includes(cat.id))
                  return sg?.id === activeSuperGroup
                })
                .map((cat: { id: string; name: string; icon: string; color: string }) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                      activeCategory === cat.id
                        ? 'text-white'
                        : 'bg-muted/60 text-muted-foreground hover:bg-accent'
                    }`}
                    style={activeCategory === cat.id ? { backgroundColor: cat.color || '#6b7280' } : {}}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
            </div>
          )}
        </div>
      ) : (
        /* SIMPLE PILLS for food menu (8 categories) */
        <div className="flex gap-1.5 px-4 py-2 border-b border-border overflow-x-auto flex-shrink-0 custom-scrollbar">
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              activeCategory === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            Vse
          </button>
          {categoriesForMenu.map((cat: { id: string; name: string; icon: string; color: string }) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeCategory === cat.id
                  ? 'text-white'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
              style={activeCategory === cat.id ? { backgroundColor: cat.color || '#6b7280' } : {}}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      )}
      {/* ITEMS GRID - Toast Style Large Buttons */}
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
              const hasMods = item.modifierGroups?.length > 0
              const stockInfo = menuStockMap?.[item.id]
              const isOutOfStock = stockInfo?.status === 'out'
              const isLowStock = stockInfo?.status === 'low'
              return (
                <button
                  key={item.id}
                  onClick={() => !isOutOfStock && handleItemClick(item)}
                  className={`relative flex flex-col rounded-xl border bg-card hover:bg-accent/50 active:scale-[0.97] transition-all text-left overflow-hidden group ${
                    isOutOfStock
                      ? 'border-red-300 dark:border-red-900/50 opacity-60 cursor-not-allowed'
                      : isLowStock
                        ? 'border-amber-300 dark:border-amber-900/50'
                        : 'border-border'
                  } ${lastAddedId === item.id ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                >
                  {/* Stock indicator - OUT OF STOCK overlay */}
                  {isOutOfStock && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-red-500/10 dark:bg-red-900/20">
                      <span className="rounded-md bg-red-600 px-2 py-0.5 text-white text-[10px] font-bold shadow" aria-label="Ni zaloge">NI ZALOGE</span>
                    </div>
                  )}
                  {/* Low stock badge */}
                  {isLowStock && !isOutOfStock && (
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10">
                      <span className="flex items-center gap-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[8px] font-bold px-1.5 py-0.5 shadow-sm whitespace-nowrap" aria-label={`Nizka zaloga, ${stockInfo.available} servisov na voljo`}>
                        Nizka zal. {stockInfo.available > 0 ? `(${stockInfo.available})` : ''}
                      </span>
                    </div>
                  )}
                  {/* Quantity badge */}
                  {totalQty > 0 && (
                    <div className="absolute top-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm">
                      {totalQty}
                    </div>
                  )}
                  {/* Modifier indicator */}
                  {hasMods && !isLowStock && (
                    <div className="absolute top-1.5 left-1.5 z-10">
                      <span className="flex items-center gap-0.5 rounded-full bg-secondary/80 text-secondary-foreground text-[9px] font-medium px-1.5 py-0.5">
                        <ChevronRight className="h-2.5 w-2.5" />
                        Izbira
                      </span>
                    </div>
                  )}
                  {/* Image */}
                  <div className="w-full aspect-square bg-muted/40 relative overflow-hidden">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 ${isOutOfStock ? 'grayscale' : ''}`}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          target.nextElementSibling?.classList.remove('hidden')
                        }}
                      />
                    ) : null}
                    <div className={`absolute inset-0 flex items-center justify-center ${item.image ? 'hidden' : ''}`}>
                      <ImageIcon className={`h-8 w-8 ${isOutOfStock ? 'text-red-300' : 'text-muted-foreground/30'}`} />
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-2 flex-1 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-1">
                      <p className={`font-semibold text-xs leading-tight line-clamp-2 ${isOutOfStock ? 'text-muted-foreground line-through' : ''}`}>{item.name}</p>
                      {item.allergens && (
                        <span className="flex-shrink-0 flex items-center gap-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-[8px] font-bold px-1 py-0.5 border border-red-200 dark:border-red-800" title={`Alergeni: ${item.allergens}`}>
                          <ShieldAlert className="h-2.5 w-2.5" />
                          {item.allergens.split(',').length}
                        </span>
                      )}
                    </div>
                    <p className={`font-bold text-sm mt-1 ${isOutOfStock ? 'text-muted-foreground' : 'text-primary'}`}>€{item.price.toFixed(2)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
      {/* MODIFIER DIALOG */}
      <Dialog open={!!modifierDialogItem} onOpenChange={(open) => { if (!open) { setModifierDialogItem(null); setSelectedModifiers(new Map()) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {modifierDialogItem?.image && (
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                  <img src={modifierDialogItem.image} alt={modifierDialogItem.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div>
                <p>{modifierDialogItem?.name}</p>
                <p className="text-sm font-normal text-muted-foreground">€{(modifierDialogItem?.price || 0).toFixed(2)}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-4 pr-3">
              {modifierDialogItem?.modifierGroups.map((mg: ModifierGroupType) => (
                <div key={mg.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{mg.modifierGroup.name}</span>
                    {mg.modifierGroup.required && <Badge variant="destructive" className="text-[9px] h-4 px-1">Obvezno</Badge>}
                    {mg.modifierGroup.maxSelect && <span className="text-[10px] text-muted-foreground">(max {mg.modifierGroup.maxSelect})</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {mg.modifierGroup.modifiers.map(mod => {
                      const isSelected = selectedModifiers.has(mod.id)
                      return (
                        <button
                          key={mod.id}
                          onClick={() => handleModifierToggle(mg.modifierGroup, mod)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card text-card-foreground border-border hover:bg-accent'
                          }`}
                        >
                          {mod.name}{mod.price > 0 ? ` +€${mod.price.toFixed(2)}` : ''}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setModifierDialogItem(null); setSelectedModifiers(new Map()) }} autoFocus>Prekliči</Button>
            <Button onClick={handleModifierConfirm}>
              <Check className="h-4 w-4 mr-1" />
              Potrdi €{((modifierDialogItem?.price || 0) + modifierExtraPrice).toFixed(2)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
