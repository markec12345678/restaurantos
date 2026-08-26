'use client'

import { memo } from 'react'
import { MessageSquare } from 'lucide-react'
import { allergenLabels } from '../types'
import type { TranslationValue } from '../translations'
import type { MenuItemType, CartItem } from '../types'
import { safeToFixed, safeNum } from '@/lib/safe-format'

interface ItemContentSectionProps {
  t: TranslationValue
  detailItem: MenuItemType
  detailNote: string
  setDetailNote: (_note: string) => void
  cart: CartItem[]
}

export const ItemContentSection = memo(function ItemContentSection({
  t,
  detailItem,
  detailNote,
  setDetailNote,
  cart,
}: ItemContentSectionProps) {
  return (
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
          {safeToFixed(detailItem.price, 2)} {t.currency}
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
  )
})
