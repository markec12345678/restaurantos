'use client'

import { memo } from 'react'
import type { ReceiptItem } from '../types'
import { fmtEur } from '../constants'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Seznam artiklov na računu
// ═══════════════════════════════════════════════════════════════

interface ReceiptItemsListProps {
  items: ReceiptItem[]
}

export const ReceiptItemsList = memo(function ReceiptItemsList({ items }: ReceiptItemsListProps) {
  return (
    <div className="space-y-2">
      {items
        .filter((i) => !i.isVoided)
        .map((item, idx) => {
          const itemTotal = item.price * item.quantity
          return (
            <div key={idx}>
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <span className="font-medium">
                    {item.quantity}x {item.name}
                  </span>
                  {item.vatRate > 0 && (
                    <span className="text-xs text-gray-400 ml-1">
                      ({item.vatRate}%)
                    </span>
                  )}
                </div>
                <span className="font-semibold ml-2 flex-shrink-0">
                  {fmtEur(itemTotal)}
                </span>
              </div>
              {item.modifiers?.map((mod, mIdx) => (
                <div
                  key={mIdx}
                  className="flex justify-between pl-6 text-sm text-gray-500"
                >
                  <span>+ {mod.name}</span>
                  {mod.price > 0 && <span>{fmtEur(mod.price)}</span>}
                </div>
              ))}
            </div>
          )
        })}
    </div>
  )
})
