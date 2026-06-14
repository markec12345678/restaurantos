'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { Plus, MessageSquare, X } from 'lucide-react'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { allergenLabels } from '../types'
import type { TranslationValue } from '../translations'
import type { MenuItemType, CartItem } from '../types'

interface ItemDetailModalProps {
  t: TranslationValue
  detailItem: MenuItemType
  detailNote: string
  setDetailNote: (_note: string) => void
  cart: CartItem[]
  onAddToCart: (_item: MenuItemType) => void
  onAddToCartWithNote: (_item: MenuItemType, _note: string) => void
  onClose: () => void
}

export const ItemDetailModal = memo(function ItemDetailModal({
  t,
  detailItem,
  detailNote,
  setDetailNote,
  cart,
  onAddToCart,
  onAddToCartWithNote,
  onClose,
}: ItemDetailModalProps) {
  const detailModalRef = useFocusTrap<HTMLDivElement>(true)

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-50"
      />

      {/* Modal */}
      <motion.div
        ref={detailModalRef}
        role="dialog"
        aria-modal="true"
        aria-label={detailItem.name}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Close button */}
        <div className="flex justify-end px-4 pb-1">
          <button
            onClick={onClose}
            aria-label={t.close}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {/* Image */}
          {detailItem.image && (
            <div className="w-full h-48 rounded-2xl overflow-hidden mb-4">
              <img
                src={detailItem.image}
                alt={detailItem.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Name & Price */}
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-xl font-bold flex-1 pr-3">{detailItem.name}</h2>
            <span className="text-xl font-bold text-amber-600 flex-shrink-0">
              {detailItem.price.toFixed(2)} {t.currency}
            </span>
          </div>

          {/* Description */}
          {detailItem.description && (
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              {detailItem.description}
            </p>
          )}

          {/* Allergens */}
          {detailItem.allergens && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2 font-medium">{t.allergens}</p>
              <div className="flex flex-wrap gap-2">
                {detailItem.allergens.split(',').map(a => {
                  const trimmed = a.trim()
                  return (
                    <span
                      key={trimmed}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs"
                    >
                      <span>{allergenLabels[trimmed] || '\u{1F3F7}\uFE0F'}</span>
                      <span className="text-muted-foreground">#{trimmed}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Note Input */}
          <div className="mb-4">
            <label htmlFor="qr-item-detail-note" className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1 font-medium">
              <MessageSquare className="h-3 w-3" /> {t.addItemNote}
            </label>
            <input
              id="qr-item-detail-note"
              type="text"
              value={detailNote}
              onChange={e => setDetailNote(e.target.value)}
              placeholder={t.notePlaceholder}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Cart quantity for this item */}
          {(() => {
            const cartQty = cart
              .filter(c => c.menuItemId === detailItem.id)
              .reduce((sum, c) => sum + c.quantity, 0)
            return cartQty > 0 ? (
              <p className="text-xs text-muted-foreground mb-3">
                {t.quantity}: {cartQty}
              </p>
            ) : null
          })()}
        </div>

        {/* Add to Cart Button */}
        <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
          <button
            onClick={() => {
              if (detailNote.trim()) {
                onAddToCartWithNote(detailItem, detailNote)
              } else {
                onAddToCart(detailItem)
              }
              onClose()
            }}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-lg transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-5 w-5" />
            {t.addToCart}
          </button>
        </div>
      </motion.div>
    </>
  )
})
