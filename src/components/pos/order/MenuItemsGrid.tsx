'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { History, Plus, Search, Star, X } from 'lucide-react'
import { MenuItemCard, stringToColor } from './MenuItemCard'
import { formatEUR } from '@/lib/safe-format'
import { useFavoritesStore } from '@/lib/favorites-store'
import { useRecentsStore, RECENTS_MAX } from '@/lib/recents-store'
import type { MenuItemType, StockInfoType } from './types'

// --- Props ---

interface MenuItemsGridProps {
  filteredMenuItems: MenuItemType[]
  /** NOVO (runda 25): VSI artikli menija — Recents hitra vrstica dela
      ponovni dodatek čez kategorije (artikel ni več v trenutnem filtru) */
  allMenuItems?: MenuItemType[]
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
  allMenuItems,
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

  // NOVO (runda 25 — Square "Recents" vzorec): nedavno dodani artikli.
  // record() pokličemo OB POTRJENEM dodajanju (lastAddedId nastavi
  // useModifierSelection/direkten dodatek), ne pri kliku (ta lahko odpre
  // modifier dialog — to ni dodatek).
  const recentIds = useRecentsStore((s) => s.ids)

  useEffect(() => {
    // skipHydration: ročna rehidracija po mountu (brez SSR mismatcha).
    void useFavoritesStore.persist.rehydrate()
    void useRecentsStore.persist.rehydrate()
  }, [])

  useEffect(() => {
    if (lastAddedId) useRecentsStore.getState().record(lastAddedId)
  }, [lastAddedId])

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds])

  // Recents lookup čez VSE artikle (ne samo trenutni filter kategorije)
  const recentItems = useMemo(() => {
    if (recentIds.length === 0 || !allMenuItems || allMenuItems.length === 0) return []
    const byId = new Map(allMenuItems.map((i) => [i.id, i]))
    return recentIds
      .map((id) => byId.get(id))
      .filter((i): i is MenuItemType => Boolean(i))
      .slice(0, RECENTS_MAX)
  }, [recentIds, allMenuItems])

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
              className="h-8 text-xs pl-8 pr-8 pointer-coarse:h-11"
              aria-label="Išči artikel"
              autoFocus
            />
            <Button variant="ghost" size="icon" aria-label="Zapri" className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7 pointer-coarse:h-9 pointer-coarse:w-9" onClick={() => onItemSearchChange('')}>
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
            className="flex items-center gap-2 flex-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-2 px-3 pointer-coarse:py-2.5 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5"
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
              className={`flex items-center gap-1.5 px-3 py-2 pointer-coarse:py-2.5 rounded-lg border text-sm font-medium transition-colors flex-shrink-0 ${
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
      {/* NOVO (runda 25 — Square "Recents" vzorec): hitra vrstica nedavno
          dodanih artiklov — 1-tap ponovno naročilo brez iskanja po kategorijah.
          Skrita med iskanjem in v favoritesOnly pogledu (tam je rdeča nitka
          že ožja kot “vsi” pogled). */}
      {!itemSearch && !favoritesOnly && recentItems.length > 0 && (
        <div className="px-3 pt-2 pb-1 flex-shrink-0" aria-label="Nedavno dodani artikli">
          <div className="flex items-center gap-1.5 mb-1">
            <History className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Nedavno
            </span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
            {recentItems.map((item) => {
              const stock = menuStockMap?.[item.id]
              const isOut = stock?.status === 'out'
              return (
                <button
                  key={item.id}
                  onClick={() => !isOut && onItemClick(item)}
                  disabled={isOut}
                  title={isOut ? `${item.name} — ni zaloge` : `Ponovno dodaj: ${item.name}`}
                  aria-label={`Ponovno dodaj ${item.name} (${formatEUR(item.price)})`}
                  className={`flex-shrink-0 flex items-center gap-1.5 pl-1.5 pr-2.5 min-h-[32px] pointer-coarse:min-h-[40px] rounded-full border bg-card text-xs font-medium transition-all active:scale-95 touch-manipulation ${
                    isOut
                      ? 'opacity-50 cursor-not-allowed border-border text-muted-foreground line-through'
                      : 'border-border hover:border-primary/50 hover:bg-primary/5 text-foreground'
                  }`}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${stringToColor(item.name)}, ${stringToColor(item.name + 'x')})` }}
                    aria-hidden="true"
                  >
                    {item.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-[110px] truncate">{item.name}</span>
                  <Plus className="h-3 w-3 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                </button>
              )
            })}
          </div>
        </div>
      )}
      {/* ITEMS GRID */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {menuLoading || menusLoading ? (
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-2.5">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
          </div>
        ) : visibleItems.length === 0 ? (
          /* NOVO (runda 32): akcijska prazna stanja — vsaka veja ponudi
             naslednji korak namesto slepega "Ni artiklov" */
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-3 px-6 text-center">
            {favoritesOnly ? (
              <>
                <Star className="h-8 w-8 text-amber-300" aria-hidden="true" />
                <p>Ni priljubljenih artiklov v tem pogledu.</p>
                <p className="text-xs text-muted-foreground/80">Tapni ★ na kartici artikla, da ga dodaš med priljubljene.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFavoritesOnly(false)}
                  className="mt-1"
                >
                  <Star className="h-3.5 w-3.5" aria-hidden="true" />
                  Pokaži vse artikle
                </Button>
              </>
            ) : itemSearch.trim() ? (
              <>
                <Search className="h-8 w-8 opacity-40" aria-hidden="true" />
                <p>Ni zadetkov za “<span className="font-medium text-foreground">{itemSearch.trim()}</span>”.</p>
                <p className="text-xs text-muted-foreground/80">Preveri črkovanje ali išči po drugem imenu.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onItemSearchChange('')}
                  className="mt-1"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Počisti iskanje
                </Button>
              </>
            ) : (
              <>
                <Search className="h-8 w-8 opacity-40" aria-hidden="true" />
                <p>Ni artiklov v tej kategoriji.</p>
                <p className="text-xs text-muted-foreground/80">Poišči artikel čez vse kategorije.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onItemSearchChange(' ')}
                  className="mt-1"
                >
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  Odpri iskanje artikla
                </Button>
              </>
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
                    className={`absolute bottom-1.5 right-1.5 z-10 flex h-8 w-8 pointer-coarse:h-11 pointer-coarse:w-11 items-center justify-center rounded-full backdrop-blur-sm transition-all active:scale-90 touch-manipulation ${
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
