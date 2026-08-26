'use client'

import { memo } from 'react'
import { ChevronRight, ImageIcon, ShieldAlert } from 'lucide-react'
import type { MenuItemType, StockInfoType } from './types'
import { safeToFixed, safeNum } from '@/lib/safe-format'

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


// Generate a consistent color from a string (for placeholder backgrounds)
function stringToColor(str: string): string {
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

  return (
    <button
      onClick={onClick}
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
          <span className="flex items-center gap-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[8px] font-bold px-1.5 py-0.5 shadow-sm whitespace-nowrap" aria-label={`Nizka zaloga, ${stockInfo?.available} servisov na voljo`}>
            Nizka zal. {stockInfo && stockInfo.available > 0 ? `(${stockInfo.available})` : ''}
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
              const fallback = target.nextElementSibling as HTMLElement | null
              if (fallback) fallback.style.display = 'flex'
            }}
          />
        ) : null}
        {/* Fallback: colored circle with first letter of item name */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ display: item.image ? 'none' : 'flex', background: `linear-gradient(135deg, ${stringToColor(item.name)}, ${stringToColor(item.name + 'x')})` }}
        >
          <span className="text-3xl font-bold text-white/90 drop-shadow-lg">
            {item.name.charAt(0).toUpperCase()}
          </span>
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
        <p className={`font-bold text-sm mt-1 ${isOutOfStock ? 'text-muted-foreground' : 'text-primary'}`}>€{safeToFixed(item.price, 2)}</p>
      </div>
    </button>
  )
})
