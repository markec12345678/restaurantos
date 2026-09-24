'use client'

import { memo } from 'react'
import { ChevronRight, Plus, ShieldAlert, UtensilsCrossed } from 'lucide-react'
import type { MenuItemType, StockInfoType } from './types'
import { formatEUR } from '@/lib/safe-format'

// ============================================
// TIPI
// ============================================
export interface MenuItemCardProps {
  item: MenuItemType
  totalQty: number
  lastAddedId: string | null
  stockInfo: StockInfoType | undefined
  onClick: () => void
}

/** NOVO (runda 25): export — Recents hitra vrstica (MenuItemsGrid) in QR meni
    uporabljata isto barvno logiko za krog z začetnico artikla. */
export function stringToColor(str: string): string {
  const colors = [
    '#f97316', '#ea580c', '#dc2626', '#b91c1c',
    '#7c3aed', '#6d28d9', '#2563eb', '#1d4ed8',
    '#059669', '#047857', '#d97706', '#b45309',
    '#db2777', '#be185d', '#0891b2', '#0e7490',
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// ============================================
// MENU ITEM CARD — HITRI GUMB ARTIKLA (issue #113)
// ============================================
// UI-REFACTOR (issue #113 — profesionalni POS):
//  • Artikel je VELIK, JASEN TOUCH GUMB: naziv + cena — brez fotografije kot
//    primarnega elementa (fotografija je opcijska sekundarna informacija v
//    modifier dialogu; podatkovni model `MenuItem.image` ostane nespremenjen).
//  • hitrost vnosa: en tap doda artikel (ali odpre modifier dialog), ponovni
//    tap na isti artikel v košarici poveča količino (obstoječa logika store-a).
//  • brez image loading-a → ni layout shift-a, ni ponovnega nalaganja slik,
//    višja gostota mreže (več uporabnih artiklov na zaslonu).
//  • 86/unavailable, low-stock, modifier indikator, količina in alergeni
//    ostanejo jasno vidni; kontrast + focus-visible za tipkovnico.
// Logika klika/stocka/dodajanja NESPREMENJENA (izven vizualnega sloja).
export const MenuItemCard = memo(function MenuItemCard({
  item,
  totalQty,
  lastAddedId,
  stockInfo,
  onClick,
}: MenuItemCardProps) {
  const hasMods = item.modifierGroups?.length > 0
  const isOutOfStock = stockInfo?.status === 'out'
  const isLowStock = stockInfo?.status === 'low'
  const allergenCount = item.allergens ? item.allergens.split(',').filter(Boolean).length : 0

  return (
    <button
      onClick={onClick}
      aria-label={`${item.name}, ${formatEUR(item.price)}${hasMods ? ', ima dodatke' : ''}${isOutOfStock ? ', ni na zalogi' : ''}`}
      /* Kompakten gumb: celotna površina = touch target (≥ 44 px na vseh
         prekinitvah; pointer-coarse minimira višino na 64 px). */
      className={`relative h-full w-full flex flex-col justify-between gap-1.5 rounded-lg border px-2.5 py-2 text-left transition-all active:scale-[0.97] touch-manipulation min-h-[72px] pointer-coarse:min-h-[64px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
        isOutOfStock
          ? 'border-red-300 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20 cursor-not-allowed'
          : isLowStock
            ? 'border-amber-300 dark:border-amber-900/50 bg-card hover:bg-accent/50'
            : 'border-border bg-card hover:bg-accent/50'
      } ${lastAddedId === item.id ? 'ring-2 ring-primary ring-offset-1' : ''}`}
    >
      {/* Quantity badge — količina v trenutnem naročilu (desno zgoraj) */}
      {totalQty > 0 && (
        <div className="absolute -top-1.5 -right-1.5 z-20 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-md ring-2 ring-card px-1 tabular-nums">
          {totalQty}
        </div>
      )}

      {/* Naziv artikla — primarna informacija, 2 vrstici max */}
      <div className="flex items-start justify-between gap-1 pr-1">
        <p
          title={item.name}
          className={`font-semibold text-sm leading-tight line-clamp-2 break-words ${
            isOutOfStock ? 'text-muted-foreground line-through' : 'text-foreground'
          }`}
        >
          {item.name}
        </p>
        {allergenCount > 0 && (
          <span
            className="flex-shrink-0 flex items-center gap-0.5 rounded-full bg-muted text-muted-foreground text-[9px] font-semibold px-1.5 py-0.5 border border-border mt-0.5"
            title={`Alergeni: ${item.allergens}`}
            aria-label={`Vsebuje ${allergenCount} alergenov`}
          >
            <ShieldAlert className="h-2.5 w-2.5" aria-hidden="true" />
            {allergenCount}
          </span>
        )}
      </div>

      {/* Spodnja vrstica: cena (takoj berljiva) + indikatorji */}
      <div className="flex items-end justify-between gap-1">
        <div className="flex flex-col gap-0.5 min-w-0">
          {isLowStock && !isOutOfStock && (
            <span
              className="inline-flex w-fit items-center rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[9px] font-bold px-1 py-px whitespace-nowrap"
              aria-label={`Nizka zaloga, ${stockInfo?.available} servisov na voljo`}
            >
              Zaloga {stockInfo && stockInfo.available > 0 ? stockInfo.available : 'nizka'}
            </span>
          )}
          <p className={`font-bold text-sm leading-tight tabular-nums ${isOutOfStock ? 'text-muted-foreground' : 'text-foreground'}`}>
            {formatEUR(item.price)}
          </p>
          {hasMods && (
            <span className="inline-flex w-fit items-center gap-0.5 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
              <ChevronRight className="h-2.5 w-2.5" aria-hidden="true" />
              Izbira
            </span>
          )}
        </div>
        {/* [+]-afordans — oranžen krog = primarna akcija (dodaj artikel) */}
        {!isOutOfStock && (
          <span
            aria-hidden="true"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </span>
        )}
      </div>

      {/* NI ZALOGE — jasen overlay (86 stanje) */}
      {isOutOfStock && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-red-500/10 dark:bg-red-900/20">
          <span className="flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-white text-[10px] font-bold shadow" aria-label="Ni zaloge">
            <UtensilsCrossed className="h-3 w-3" aria-hidden="true" />
            NI ZALOGE
          </span>
        </div>
      )}
    </button>
  )
})
