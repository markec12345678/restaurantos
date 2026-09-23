'use client'

import { memo } from 'react'
import Image from 'next/image'
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
  /** NOVO (QA 2026-09-17): eager nalaganje za zgornji vidni del (LCP fix) */
  eager?: boolean
}


// NOVO (runda 25): export — Recents hitra vrstica (MenuItemsGrid) uporablja
// isto barvno logiko za krog z začetnico artikla (enotna identiteta artikla)
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
// MENU ITEM CARD - Kartica artikla v mreži
// ============================================
// UI-REFACTOR (Sales P0):
//  • ENOTEN placeholder sistem — vsi artikli brez slike dobijo ISTO nevtralno
//    površino (muted + ikona jedilnika) namesto naključnih barvnih gradientov
//    (prej: vsak artikel druga barva → vizualni šum, neenotna mreža).
//  • Fotografija 4:3 (namesto 1:1) — kartice kompaktnejše, več artiklov na
//    zaslonu, manj drsenja na POS tablici.
//  • Cena NEVTRALNA (foreground) — oranžna je poudarek samo za AKCIJO (+ gumb).
//  • Alergeni: subtilen nevtralen chip (rdeča ostane rezervirana za napake).
//  • [+]] affordance — oranžen krog v kotu (dekortiven span, klik je na kartici;
//    gnezdenje gumba v gumbu je neveljavno HTML).
// Logika (stock, modifier, qty badge, LCP eager, onError fallback) NESPREMENJENA.
export const MenuItemCard = memo(function MenuItemCard({
  item,
  totalQty,
  lastAddedId,
  stockInfo,
  onClick,
  eager = false,
}: MenuItemCardProps) {
  const hasMods = item.modifierGroups?.length > 0
  const isOutOfStock = stockInfo?.status === 'out'
  const isLowStock = stockInfo?.status === 'low'

  return (
    <button
      onClick={onClick}
      /* w-full: gumbi se NE raztegujejo kot bloki (shrink-to-fit) — brez tega
         kartica ne zapolni mrežne celice (prej: ozke kartice, ★ plavala v reki) */
      className={`relative h-full w-full flex flex-col rounded-xl border bg-card hover:bg-accent/50 active:scale-[0.97] transition-all text-left overflow-hidden group ${
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
          <span className="flex items-center gap-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[8px] font-bold px-1.5 py-0.5 shadow-sm whitespace-nowrap" aria-label={`Nizka zaloga, ${stockInfo?.available} servisov na voljo`}>
            Nizka zal. {stockInfo && stockInfo.available > 0 ? `(${stockInfo.available})` : ''}
          </span>
        </div>
      )}
      {/* Quantity badge */}
      {totalQty > 0 && (
        <div className="absolute top-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-md ring-2 ring-card">
          {totalQty}
        </div>
      )}
      {/* Modifier indicator */}
      {hasMods && !isLowStock && (
        <div className="absolute top-1.5 left-1.5 z-10">
          <span className="flex items-center gap-0.5 rounded-full bg-background/90 text-foreground text-[9px] font-medium px-1.5 py-0.5 shadow-sm border border-border backdrop-blur-sm">
            <ChevronRight className="h-2.5 w-2.5" />
            Izbira
          </span>
        </div>
      )}
      {/* Image — ENOTEN sistem: prava fotografija ALI nevtralen placeholder */}
      <div className="w-full aspect-[4/3] bg-muted relative overflow-hidden">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            /* LCP fix (QA 2026-09-17): zgornji vidni artikli se naložijo takoj */
            loading={eager ? 'eager' : 'lazy'}
            className={`object-cover group-hover:scale-105 transition-transform duration-200 ${isOutOfStock ? 'grayscale' : ''}`}
            onError={() => {
              // Skrij <Image> in prikaži fallback (isti nevtralen placeholder)
              const imgEl = document.getElementById(`img-${item.id}`)
              const fbEl = document.getElementById(`fallback-${item.id}`)
              if (imgEl) imgEl.style.display = 'none'
              if (fbEl) fbEl.style.display = 'flex'
            }}
            id={`img-${item.id}`}
          />
        ) : null}
        {/* ENOTEN placeholder: nevtralna površina + ikona (identično za VSE
            artikle brez slike — brez naključnih barv) */}
        <div
          id={`fallback-${item.id}`}
          className="absolute inset-0 flex items-center justify-center bg-muted"
          style={{ display: item.image ? 'none' : 'flex' }}
          aria-hidden="true"
        >
          <UtensilsCrossed className="h-8 w-8 text-muted-foreground/25" strokeWidth={1.5} />
        </div>
      </div>
      {/* Info — kompakt: ime + opis + cena + [+] */}
      <div className="p-2 flex-1 flex flex-col justify-between gap-1">
        <div>
          <div className="flex items-start justify-between gap-1">
            <p title={item.name} className={`font-semibold text-xs leading-tight line-clamp-2 ${isOutOfStock ? 'text-muted-foreground line-through' : ''}`}>{item.name}</p>
            {item.allergens && (
              <span className="flex-shrink-0 flex items-center gap-0.5 rounded-full bg-muted text-muted-foreground text-[8px] font-semibold px-1 py-0.5 border border-border" title={`Alergeni: ${item.allergens}`}>
                <ShieldAlert className="h-2.5 w-2.5" aria-hidden="true" />
                {item.allergens.split(',').length}
              </span>
            )}
          </div>
          {item.description && (
            <p title={item.description} className="text-[10px] text-muted-foreground leading-tight line-clamp-1 mt-0.5">{item.description}</p>
          )}
        </div>
        {/* Cena + [+] affordance — oranžna = dodajanje artikla (primarna akcija).
            pr-8: nahrbtnik ★ (priljubljeni) leži nad tem kotom — + se premakne levo od njega. */}
        <div className="flex items-center justify-between gap-1 pr-8">
          <p className={`font-bold text-sm ${isOutOfStock ? 'text-muted-foreground' : 'text-foreground'}`}>{formatEUR(item.price)}</p>
          {!isOutOfStock && (
            <span
              aria-hidden="true"
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
          )}
        </div>
      </div>
    </button>
  )
})
