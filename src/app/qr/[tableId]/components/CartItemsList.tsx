'use client'

import { memo } from 'react'
import Image from 'next/image'
import { Plus, Minus, Trash2 } from 'lucide-react'
import type { CartItem } from '../types'
import { safeToFixed, safeNum } from '@/lib/safe-format'

interface CartItemsListProps {
  cart: CartItem[]
  updateQuantity: (_menuItemId: string, _notes: string, _delta: number) => void
  removeItem: (_menuItemId: string, _notes: string) => void
}

export const CartItemsList = memo(function CartItemsList({
  cart,
  updateQuantity,
  removeItem,
}: CartItemsListProps) {
  return (
    <div className="space-y-3">
      {cart.map((c, i) => (
        <div
          key={`${c.menuItemId}-${c.notes}-${i}`}
          className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3"
        >
          {c.image && (
            <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
              <Image src={c.image} alt={c.name} fill sizes="48px" className="object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{c.name}</h4>
            <p className="text-xs text-muted-foreground">{safeToFixed(c.price, 2)}</p>
            {c.notes && (
              <p className="text-xs text-amber-600 mt-0.5">{c.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateQuantity(c.menuItemId, c.notes, -1)}
              className="w-7 h-7 flex items-center justify-center bg-white dark:bg-gray-700 rounded-full border border-gray-200 dark:border-gray-600"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="font-bold text-sm w-5 text-center">{c.quantity}</span>
            <button
              onClick={() => updateQuantity(c.menuItemId, c.notes, 1)}
              className="w-7 h-7 flex items-center justify-center bg-amber-500 text-white rounded-full"
            >
              <Plus className="h-3 w-3" />
            </button>
            <button
              onClick={() => removeItem(c.menuItemId, c.notes)}
              className="p-1 text-red-400 hover:text-red-600 ml-1"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
})
