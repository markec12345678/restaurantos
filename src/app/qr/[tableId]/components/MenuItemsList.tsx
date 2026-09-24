'use client'

import { memo } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus } from 'lucide-react'
import { allergenLabels } from '../types'
import type { TranslationValue } from '../translations'
import type { MenuItemType, CartItem, CategoryType } from '../types'
import { EmptySearchResults, EmptyCategory } from './MenuEmptyStates'
import { safeToFixed } from '@/lib/safe-format'

// ============================================
// POSAMEZNA KARTICA MENIJSKEGA ARTIKLA
// ============================================
interface MenuItemCardProps {
  item: MenuItemType
  categoryName?: string
  cart: CartItem[]
  t: TranslationValue
  onAddToCart: (_item: MenuItemType) => void
  onUpdateQuantity: (_menuItemId: string, _notes: string, _delta: number) => void
  onOpenDetail: (_item: MenuItemType) => void
}

export const MenuItemCard = memo(function MenuItemCard({
  item, categoryName, cart, t, onAddToCart, onUpdateQuantity, onOpenDetail,
}: MenuItemCardProps) {
  const cartQty = cart.filter(c => c.menuItemId === item.id).reduce((sum, c) => sum + c.quantity, 0)
  // R124 (P0-03): sold-out stanje — izprodano = znižana prosojnost + onemogočeno dodajanje
  const soldOut = item.stockStatus === 'out'
  const lowStock = item.stockStatus === 'low' && item.stockAvailable != null

  return (
    <motion.div layout className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow ${soldOut ? 'opacity-60' : ''}`}>
      <div className="flex cursor-pointer" onClick={() => onOpenDetail(item)}>
        {item.image && (
          <div className="w-24 h-24 flex-shrink-0 relative">
            <Image src={item.image} alt={item.name} fill sizes="96px" className="object-cover" />
          </div>
        )}
        <div className="flex-1 p-3 min-w-0">
          {categoryName && <p className="text-[10px] text-amber-500 font-medium mb-0.5 uppercase tracking-wide">{categoryName}</p>}
          <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
            <h3 className="font-semibold text-sm leading-tight truncate">{item.name}</h3>
            {soldOut && (
              <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[10px] font-semibold uppercase tracking-wide">{t.soldOut}</span>
            )}
          </div>
          {item.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">{item.description}</p>}
          {lowStock && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">{t.stockLow.replace('{count}', String(item.stockAvailable))}</p>
          )}
          {item.allergens && (
            <div className="flex gap-0.5 mb-1.5">
              {item.allergens.split(',').map(a => (
                <span key={a} className="text-[10px]" title={`Alergen ${a}`}>{allergenLabels[a.trim()] || `A${a.trim()}`}</span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-600 text-sm">{safeToFixed(item.price, 2)} {t.currency}</span>
            {cartQty === 0 ? (
              <button onClick={(e) => { e.stopPropagation(); onAddToCart(item) }} disabled={soldOut} className={`flex items-center gap-1 px-3 py-1 bg-amber-500 text-white rounded-full text-xs font-medium transition-colors ${soldOut ? 'opacity-50 cursor-not-allowed' : 'hover:bg-amber-600'}`}>
                <Plus className="h-3 w-3" />{t.addToCart}
              </button>
            ) : (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                {/* P2-UX FIX (touch target): 28px → 40px + touch-manipulation (44px na dotik) */}
                <button onClick={() => onUpdateQuantity(item.id, '', -1)} aria-label="Zmanjšaj količino" className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors touch-manipulation">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="font-bold text-sm w-5 text-center">{cartQty}</span>
                <button onClick={() => onAddToCart(item)} disabled={soldOut} aria-label="Povečaj količino" className={`w-10 h-10 flex items-center justify-center bg-amber-500 text-white rounded-full transition-colors touch-manipulation ${soldOut ? 'opacity-50 cursor-not-allowed' : 'hover:bg-amber-600'}`}>
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
})

// ============================================
// SEZNAM MENIJSKIH ARTIKLOV
// ============================================
interface MenuItemsListProps {
  t: TranslationValue
  isSearching: boolean
  searchResults: (MenuItemType & { categoryName: string })[]
  activeCategory: CategoryType | undefined
  activeCategoryId: string
  cart: CartItem[]
  onAddToCart: (_item: MenuItemType) => void
  onUpdateQuantity: (_menuItemId: string, _notes: string, _delta: number) => void
  onOpenDetail: (_item: MenuItemType) => void
}

export const MenuItemsList = memo(function MenuItemsList({
  t, isSearching, searchResults, activeCategory, activeCategoryId, cart, onAddToCart, onUpdateQuantity, onOpenDetail,
}: MenuItemsListProps) {
  return (
    <main className="max-w-3xl mx-auto px-4 py-4">
      {isSearching ? (
        <div>
          {searchResults.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground mb-3">{t.searchResults.replace('{count}', String(searchResults.length))}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {searchResults.map(item => (
                  <MenuItemCard key={item.id} item={item} categoryName={item.categoryName} cart={cart} t={t} onAddToCart={onAddToCart} onUpdateQuantity={onUpdateQuantity} onOpenDetail={onOpenDetail} />
                ))}
              </div>
            </>
          ) : (
            <EmptySearchResults t={t} />
          )}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={activeCategoryId} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }}>
            {activeCategory?.menuItems?.length === 0 ? (
              <EmptyCategory t={t} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeCategory?.menuItems?.map(item => (
                  <MenuItemCard key={item.id} item={item} cart={cart} t={t} onAddToCart={onAddToCart} onUpdateQuantity={onUpdateQuantity} onOpenDetail={onOpenDetail} />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
      <p className="text-center text-xs text-muted-foreground mt-6">{t.vatIncluded}</p>
    </main>
  )
})
