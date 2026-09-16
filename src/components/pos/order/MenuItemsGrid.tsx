'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Star, X } from 'lucide-react'
import { MenuItemCard } from './MenuItemCard'
import { useFavoritesStore } from '@/lib/favorites-store'
import type { MenuItemType, StockInfoType } from './types'

// --- Props ---

interface MenuItemsGridProps {
  filteredMenuItems: MenuItemType[]
  menuStockMap: Record<string, StockInfoType> | undefined
  cart: { id: string; quantity: number }[]
  lastAddedId: string | null
  itemSearch: string
  onItemSearchChange: (_value: string) => void
  onItemClick: (_item: MenuItemType) => void
  menusLoading: boolean
  menuLoading: boolean
}

// --- Komponenta ---

export const MenuItemsGrid = memo(function MenuItemsGrid({
  filteredMenuItems,
  menuStockMap,
  cart,
  lastAddedId,
  itemSearch,
  onItemSearchChange,
  onItemClick,
  menusLoading,
  menuLoading,
}: MenuItemsGridProps) {
  // NOVO (QA 2026-09-17, runda 4): Priljubljeni artikli — hiter dostop do
  // najpogosteje naročanih artiklov čez vse kategorije. Persist per naprava.
  const favoriteIds = useFavoritesStore((s) => s.ids)
  const toggleFavorite = useFavoritesStore((s) => s.toggle)
  const [favoritesOnly, setFavoritesOnly] = useState(false)

  useEffect(() => {
    // skipHydration: ročna rehidracija po mountu (brez SSR mismatcha).
    // Posebnega "hydrated" flaga ni treba — rehydrate sproži store update,
    // komponenta se sama ponovno rendra (lint: brez sync setState v efektu).
    void useFavoritesStore.persist.rehydrate()
  }, [])

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds])

  const visibleItems = useMemo(() => {
    if (!favoritesOnly) return filteredMenuItems
    return filteredMenuItems.filter((i) => favoriteSet.has(i.id))
  }, [filteredMenuItems, favoritesOnly, favoriteSet])

  // Števec priljubljenih ZA NOTRANJI prikaz (med trenutno vidnimi artikli)
  const favoritesInView = useMemo(
    () => filteredMenuItems.filter((i) => favoriteSet.has(i.id)).length,
    [filteredMenuItems, favoriteSet],
  )

  const toggleFav = (id: string) => {
    toggleFavorite(id)
  }

  return (
    <>
      {/* Quick Search */}
      {itemSearch && (
        <div className="px-3 pt-2 flex items-center gap-2 flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Išči artikel..."
              value={itemSearch}
              onChange={e => onItemSearchChange(e.target.value)}
              className="h-8 text-xs pl-8 pr-8"
              aria-label="Išči artikel"
              autoFocus
            />
            <Button variant="ghost" size="icon" aria-label="Zapri" className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => onItemSearchChange('')}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <Badge variant="secondary" className="text-[10px] h-6 flex-shrink-0">{filteredMenuItems.length}</Badge>
        </div>
      )}
      {!itemSearch && (
        <div className="px-3 pt-2 flex-shrink-0 flex items-center gap-2">
          <button
            onClick={() => onItemSearchChange(' ')}
            className="flex items-center gap-2 flex-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-2 px-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5"
          >
            <Search className="h-4 w-4" />
            <span>Išči artikel...</span>
            <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded border font-mono">⌘K</kbd>
          </button>
          {/* NOVO (runda 4): hitri filter Priljubljeni — viden samo če obstajajo */}
          {favoriteIds.length > 0 && (
            <button
              onClick={() => setFavoritesOnly((v) => !v)}
              aria-pressed={favoritesOnly}
              aria-label={`Priljubljeni artikli: ${favoritesInView} v trenutnem pogledu`}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors flex-shrink-0 ${
                favoritesOnly
                  ? 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-300'
                  : 'border-dashed border-border text-muted-foreground hover:border-amber-300 hover:text-amber-700 dark:hover:text-amber-300'
              }`}
            >
              <Star className={`h-4 w-4 ${favoritesOnly ? 'fill-amber-400 text-amber-400' : ''}`} aria-hidden="true" />
              <span className="hidden sm:inline">Priljubljeni</span>
              <span className="text-[10px] font-bold bg-background/60 rounded-full px-1.5 py-0.5 tabular-nums">{favoritesInView}</span>
            </button>
          )}
        </div>
      )}
      {/* ITEMS GRID */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {menuLoading || menusLoading ? (
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-2.5">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2 px-6 text-center">
            {favoritesOnly ? (
              <>
                <Star className="h-8 w-8 text-amber-300" aria-hidden="true" />
                <p>Ni priljubljenih artiklov v tem pogledu.</p>
                <p className="text-xs text-muted-foreground/80">Tapni ★ na kartici artikla, da ga dodaš med priljubljene.</p>
              </>
            ) : (
              'Ni artiklov v tej kategoriji'
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {visibleItems.map((item: MenuItemType, idx: number) => {
              const inCart = cart.filter(c => c.id === item.id)
              const totalQty = inCart.reduce((sum, c) => sum + c.quantity, 0)
              const stockInfo = menuStockMap?.[item.id]
              const isOutOfStock = stockInfo?.status === 'out'
              const isFav = favoriteSet.has(item.id)
              return (
                /* Wrapper omogoča ★ gumb KOT SOSEDA kartice (gnezdenje gumba
                   v gumbu je neveljavno HTML + pokvari klik) */
                <div key={item.id} className="relative">
                  <MenuItemCard
                    item={item}
                    totalQty={totalQty}
                    lastAddedId={lastAddedId}
                    stockInfo={stockInfo}
                    /* LCP fix (QA 2026-09-17): prvih 10 zgornjih artiklov eager */
                    eager={idx < 10}
                    onClick={() => !isOutOfStock && onItemClick(item)}
                  />
                  {/* NOVO (runda 4): priljubljeni ★ — spodaj desno na sliki,
                      vedno viden (tablice nimajo hoverja) */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFav(item.id) }}
                    aria-pressed={isFav}
                    aria-label={isFav ? `Odstrani ${item.name} iz priljubljenih` : `Dodaj ${item.name} med priljubljene`}
                    title={isFav ? 'Odstrani iz priljubljenih' : 'Dodaj med priljubljene'}
                    className={`absolute bottom-1.5 right-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition-all active:scale-90 ${
                      isFav
                        ? 'bg-amber-400/90 text-white shadow-md'
                        : 'bg-black/35 text-white/80 hover:bg-black/50 hover:text-white'
                    }`}
                  >
                    <Star className={`h-4 w-4 ${isFav ? 'fill-white' : ''}`} aria-hidden="true" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
})
