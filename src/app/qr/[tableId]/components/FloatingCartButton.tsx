'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { ShoppingCart } from 'lucide-react'

interface FloatingCartButtonProps {
  cartCount: number
  cartTotal: number
  onOpenCart: () => void
  itemLabel: string
  itemsLabel: string
  currency: string
}

export const FloatingCartButton = memo(function FloatingCartButton({
  cartCount,
  cartTotal,
  onOpenCart,
  itemLabel,
  itemsLabel,
  currency,
}: FloatingCartButtonProps) {
  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-50 p-4"
    >
      <div className="max-w-3xl mx-auto">
        <button
          onClick={onOpenCart}
          className="w-full flex items-center justify-between bg-amber-500 hover:bg-amber-600 text-white py-4 px-6 rounded-2xl shadow-2xl shadow-amber-500/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingCart className="h-6 w-6" />
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-white text-amber-600 rounded-full text-xs font-bold flex items-center justify-center">
                {cartCount}
              </span>
            </div>
            <span className="font-semibold">
              {cartCount} {cartCount === 1 ? itemLabel : itemsLabel}
            </span>
          </div>
          <span className="text-lg font-bold">{cartTotal.toFixed(2)} {currency}</span>
        </button>
      </div>
    </motion.div>
  )
})
