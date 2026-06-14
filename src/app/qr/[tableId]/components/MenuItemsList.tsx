'use client'

import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus, UtensilsCrossed, Search } from 'lucide-react'
import { allergenLabels } from '../types'
import type { TranslationValue } from '../translations'
import type { MenuItemType, CartItem, CategoryType } from '../types'

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
  item,
  categoryName,
  cart,
  t,
  onAddToCart,
  onUpdateQuantity,
  onOpenDetail,
}: MenuItemCardProps) {
  const cartQty = cart
    .filter(c => c.menuItemId === item.id)
    .reduce((sum, c) => sum + c.quantity, 0)

  return (
    <motion.div
      layout
      className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow"
    >
      <div
        className="flex cursor-pointer"
        onClick={() => onOpenDetail(item)}
      >
        {/* Image */}
        {item.image && (
          <div className="w-24 h-24 flex-shrink-0">
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 p-3 min-w-0">
          {categoryName && (
            <p className="text-[10px] text-amber-500 font-medium mb-0.5 uppercase tracking-wide">{categoryName}</p>
          )}
          <h3 className="font-semibold text-sm leading-tight mb-0.5 truncate">{item.name}</h3>
          {item.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">{item.description}</p>
          )}

          {/* Allergens */}
          {item.allergens && (
            <div className="flex gap-0.5 mb-1.5">
              {item.allergens.split(',').map(a => (
                <span key={a} className="text-[10px]" title={`Alergen ${a}`}>
                  {allergenLabels[a.trim()] || `A${a.trim()}`}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-600 text-sm">
              {item.price.toFixed(2)} {t.currency}
            </span>

            {/* Add/Quantity controls */}
            {cartQty === 0 ? (
              <button
                onClick={(e) => { e.stopPropagation(); onAddToCart(item) }}
                className="flex items-center gap-1 px-3 py-1 bg-amber-500 text-white rounded-full text-xs font-medium hover:bg-amber-600 transition-colors"
              >
                <Plus className="h-3 w-3" />
                {t.addToCart}
              </button>
            ) : (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onUpdateQuantity(item.id, '', -1)}
                  className="w-7 h-7 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="font-bold text-sm w-5 text-center">{cartQty}</span>
                <button
                  onClick={() => onAddToCart(item)}
                  className="w-7 h-7 flex items-center justify-center bg-amber-500 text-white rounded-full hover:bg-amber-600 transition-colors"
                >
                  <Plus className="h-3 w-3" />
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
  t,
  isSearching,
  searchResults,
  activeCategory,
  activeCategoryId,
  cart,
  onAddToCart,
  onUpdateQuantity,
  onOpenDetail,
}: MenuItemsListProps) {
  return (
    <main className="max-w-3xl mx-auto px-4 py-4">
      {isSearching ? (
        /* Search Results - flat list */
        <div>
          {searchResults.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                {t.searchResults.replace('{count}', String(searchResults.length))}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {searchResults.map(item => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    categoryName={item.categoryName}
                    cart={cart}
                    t={t}
                    onAddToCart={onAddToCart}
                    onUpdateQuantity={onUpdateQuantity}
                    onOpenDetail={onOpenDetail}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-muted-foreground">{t.emptyMenu}</p>
            </div>
          )}
        </div>
      ) : (
        /* Normal category view */
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategoryId}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15 }}
          >
            {activeCategory?.menuItems?.length === 0 ? (
              <div className="text-center py-12">
                <UtensilsCrossed className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-muted-foreground">{t.emptyMenu}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeCategory?.menuItems?.map(item => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    cart={cart}
                    t={t}
                    onAddToCart={onAddToCart}
                    onUpdateQuantity={onUpdateQuantity}
                    onOpenDetail={onOpenDetail}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* VAT note */}
      <p className="text-center text-xs text-muted-foreground mt-6">{t.vatIncluded}</p>
    </main>
  )
})
