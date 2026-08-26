'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { Plus, X } from 'lucide-react'
import { useFocusTrap } from '@/lib/use-focus-trap'
import type { TranslationValue } from '../translations'
import type { MenuItemType, CartItem } from '../types'

const ItemContentSection = dynamic(() => import('./ItemContentSection').then(m => ({ default: m.ItemContentSection })), { ssr: false })

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
        <ItemContentSection t={t} detailItem={detailItem} detailNote={detailNote} setDetailNote={setDetailNote} cart={cart} />

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
