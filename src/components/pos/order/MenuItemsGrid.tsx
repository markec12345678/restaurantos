'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronDown, History, PackageOpen, Plus, Search, Star, X } from 'lucide-react'
import { MenuItemCard } from './MenuItemCard'
import { AllergenFilterPopover } from './AllergenFilterBar'
import { StarterCatalogDialog } from './StarterCatalogDialog'
import { formatEUR } from '@/lib/safe-format'
import { useFavoritesStore } from '@/lib/favorites-store'
import { useRecentsStore, RECENTS_MAX } from '@/lib/recents-store'
import { usePOSStore } from '@/lib/store'
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

  // UI-REFACTOR (Sales P0): "Dodaj še kaj?" v košarici — fokus iskalnega polja.
  // Signal (števec) prihaja iz usePOSStore; input ref držimo lokalno.
  const searchInputRef = useRef<HTMLInputElement>(null)
  const cartQuickAddSignal = usePOSStore((s) => s.cartQuickAddSignal)
  useEffect(() => {
    if (cartQuickAddSignal > 0) searchInputRef.current?.focus()
  }, [cartQuickAddSignal])

  // UI-REFACTOR (runda 112): poštena "/" bližnjica — fokusira iskanje artikla.
  // Prej je kbd hint v inputu vabil ⌘K, a ta odpira globalni CommandPalette
  // (doda artikel po ID) — zavajajoč afordans. "/" je standardni search-focus
  // pattern (GitHub/YouTube) in ne kolidira z F2/F4/F5/F8 bližnjicami.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      e.preventDefault()
      searchInputRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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

  // RUNDA 42: OKNO UPODAUBLJANJA — "Vse kategorije" pokaže do 241 artiklov
  // (merjeno na prod) = 3500+ DOM vozlišč → upočasni drsenje/odpiranje na
  // slabših tablicah. Okno: 90 kompaktnih gumbov (issue #113: manjša kartica
  // brez fotografije = več artiklov na zaslonu; okno povečano 60 → 90, da
  // okno pokrije isti vidni zaslon) + "Prikaži še" gumb (inkrementalno,
  // Square/Linear pattern). Iskanje NI okvirano (popolni zadetki).
  // Reset ob zamenjavi kategorije/menija dela MENU BROWSER prek `key` propa
  // (remount = čisto stanje, brez setState-in-effect).
  const WINDOW_STEP = 90
  const [visibleCount, setVisibleCount] = useState(WINDOW_STEP)
  const windowedItems = useMemo(() => {
    if (itemSearch) return visibleItems // iskanje = popolni zadetki
    return visibleItems.slice(0, visibleCount)
  }, [visibleItems, visibleCount, itemSearch])
  const hiddenCount = itemSearch ? 0 : visibleItems.length - windowedItems.length

  // Števec priljubljenih ZA NOTRANJI prikaz (med trenutno vidnimi artikli)
  const favoritesInView = useMemo(
    () => filteredMenuItems.filter((i) => favoriteSet.has(i.id)).length,
    [filteredMenuItems, favoriteSet],
  )

  const toggleFav = (id: string) => {
    toggleFavorite(id)
  }

  // NOVO (issue #113 + #114): prazni katalog ≠ pokvarjen sistem. Ko meni
  // sploh NIMA artiklov (ne samo aktivna kategorija), ponudimo naslednji
  // korak: starter katalog (onboarding) ali skok v MenuManager.
  const [starterDialogOpen, setStarterDialogOpen] = useState(false)
  const setActiveModule = usePOSStore((s) => s.setActiveModule)
  const isCatalogEmpty = !itemSearch && !favoritesOnly && (allMenuItems?.length ?? 0) === 0

  return (
    <>
      {/* SEARCH — vedno viden na vrhu (UI-REFACTOR: prej skrit za pavšalnim
          gumbom s preslednim trikom ' '; iskanje je primarna akcija poleg
          mize) + hitri filter Priljubljeni + alergeni Popover (runda 112:
          prej stalna vrstica pod kategorijami) */}
      <div className="px-3 pt-2 flex items-center gap-2 flex-shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <Input
            ref={searchInputRef}
            placeholder="Išči artikel..."
            value={itemSearch}
            onChange={e => onItemSearchChange(e.target.value)}
            className="h-9 text-sm pl-8 pr-12 pointer-coarse:h-11 bg-card"
            aria-label="Išči artikel"
          />
          {itemSearch ? (
            <Button variant="ghost" size="icon" aria-label="Zapri" className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7 pointer-coarse:h-9 pointer-coarse:w-9" onClick={() => onItemSearchChange('')}>
              <X className="h-3 w-3" />
            </Button>
          ) : (
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] bg-muted px-1.5 py-0.5 rounded border font-mono text-muted-foreground pointer-events-none">/</kbd>
          )}
        </div>
        {itemSearch && (
          <Badge variant="secondary" className="text-[10px] h-6 flex-shrink-0">{filteredMenuItems.length}</Badge>
        )}
        {/* UI-REFACTOR (runda 112): alergeni kot Popover — funkcionalnost ista,
            brez stalne vrstice kroma */}
        <AllergenFilterPopover />
        {/* NOVO (runda 4): hitri filter Priljubljeni — viden samo če obstajajo */}
        {favoriteIds.length > 0 && (
          <button
            onClick={() => setFavoritesOnly((v) => !v)}
            aria-pressed={favoritesOnly}
            aria-label={`Priljubljeni artikli: ${favoritesInView} v trenutnem pogledu`}
            className={`flex items-center gap-1.5 px-3 py-2 pointer-coarse:py-2.5 rounded-lg border text-sm font-medium transition-colors flex-shrink-0 ${
              favoritesOnly
                ? 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-300'
                : 'border-border bg-card text-muted-foreground hover:border-amber-300 hover:text-amber-700 dark:hover:text-amber-300'
            }`}
          >
            <Star className={`h-4 w-4 ${favoritesOnly ? 'fill-amber-400 text-amber-400' : ''}`} aria-hidden="true" />
            <span className="hidden sm:inline">Priljubljeni</span>
            <span className="text-[10px] font-bold bg-background/60 rounded-full px-1.5 py-0.5 tabular-nums">{favoritesInView}</span>
          </button>
        )}
      </div>
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
                  {/* UI-REFACTOR: enoten nevtralen krog z začetnico (prej
                      naključni gradient — neenoten z novim placeholder sistemom) */}
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary flex-shrink-0"
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
          /* Skeleton grid razredi = realni grid (issue #113: 2/3/4/5/6) —
             kompaktne višine (brez fotografije je kartica nižja) */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {[...Array(12)].map((_, i) => <Skeleton key={i} className="h-[72px] rounded-lg" />)}
          </div>
        ) : visibleItems.length === 0 && isCatalogEmpty ? (
          /* NOVO (issue #113 §9 + #114 §9): prazen katalog — jasna ponudba
             naslednjega koraka namesto slepega "Ni artiklov" */
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-3 px-6 text-center">
            <PackageOpen className="h-10 w-10 opacity-40" aria-hidden="true" />
            <p className="font-medium text-foreground">Vaš meni še nima artiklov.</p>
            <p className="text-xs text-muted-foreground/80 max-w-sm">Ustvarite starter katalog za vaš tip lokala (v nekaj minutah do delujočega POS-a) ali dodajte prvi artikel ročno.</p>
            <div className="flex flex-col sm:flex-row gap-2 mt-1">
              <Button size="sm" onClick={() => setStarterDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Uporabi starter katalog
              </Button>
              <Button variant="outline" size="sm" onClick={() => setActiveModule('menu')}>
                <PackageOpen className="h-3.5 w-3.5" aria-hidden="true" />
                Dodaj prvi artikel
              </Button>
            </div>
            {/* NOVO (#114): dialog za izbiro tipa lokala + idempotentno
                ustvarjanje starter kataloga (POST /api/onboarding/starter-catalog) */}
            <StarterCatalogDialog open={starterDialogOpen} onOpenChange={setStarterDialogOpen} />
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
                  onClick={() => searchInputRef.current?.focus()}
                  className="mt-1"
                >
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  Poišči artikel
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {windowedItems.map((item: MenuItemType) => {
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
                    onClick={() => !isOutOfStock && onItemClick(item)}
                  />
                  {/* NOVO (runda 4, issue #113): priljubljeni ★ — spodaj desno,
                      pred [+]-afordansom (brez fotografije je prosti kot); ne
                      prekriva cene/modifikatorjev (levi spodaj) niti [+]; vedno
                      viden (tablice nimajo hoverja) */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFav(item.id) }}
                    aria-pressed={isFav}
                    aria-label={isFav ? `Odstrani ${item.name} iz priljubljenih` : `Dodaj ${item.name} med priljubljene`}
                    title={isFav ? 'Odstrani iz priljubljenih' : 'Dodaj med priljubljene'}
                    className={`absolute bottom-1 right-10 z-10 flex h-7 w-7 pointer-coarse:h-9 pointer-coarse:w-9 items-center justify-center rounded-full transition-all active:scale-90 touch-manipulation ${
                      isFav
                        ? 'bg-amber-400/90 text-white shadow-md'
                        : 'text-muted-foreground/50 hover:bg-muted hover:text-amber-600'
                    }`}
                  >
                    <Star className={`h-3.5 w-3.5 ${isFav ? 'fill-white' : ''}`} aria-hidden="true" />
                  </button>
                </div>
              )
            })}
            {/* RUNDA 42: "Prikaži še" — inkrementalno okno (60 na klik).
                Gradient fade + števec, disabled ni — vedno en korak do vseh. */}
            {hiddenCount > 0 && (
              <button
                onClick={() => setVisibleCount((c) => c + WINDOW_STEP)}
                className="col-span-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-gradient-to-b from-transparent to-muted/60 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground pointer-coarse:py-4"
                aria-label={`Prikaži še ${Math.min(hiddenCount, WINDOW_STEP)} od ${hiddenCount} preostalih artiklov`}
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
                <span>
                  Prikaži še <span className="font-bold tabular-nums text-foreground">{Math.min(hiddenCount, WINDOW_STEP)}</span>
                  {' '}(skupaj {visibleItems.length})
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
})
