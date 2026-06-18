'use client'

import { memo } from 'react'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { Plus, Minus, X, ImageIcon } from 'lucide-react'
import type { CartItemType } from '@/lib/store'

// --- Props ---

interface CartItemRowProps {
  item: CartItemType
  removeFromCart: (_cartKey: string) => void
  updateCartQuantity: (_cartKey: string, _quantity: number) => void
}

// --- Komponenta ---

export const CartItemRow = memo(function CartItemRow({
  item,
  removeFromCart,
  updateCartQuantity,
}: CartItemRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="flex items-start gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
    >
      {/* Thumbnail */}
      {item.image ? (
        <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0">
          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-10 h-10 rounded-md bg-muted flex-shrink-0 flex items-center justify-center">
          <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
        </div>
      )}
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{item.name}</p>
        <p className="text-[10px] text-muted-foreground">€{safeToFixed(item.price, 2)} na kos</p>
        {item.modifiers.length > 0 && (
          <div className="flex flex-wrap gap-0.5 mt-0.5">
            {item.modifiers.map(m => (
              <Badge key={m.id} variant="outline" className="text-[8px] h-3.5 px-1 py-0">
                {m.name}{m.price > 0 ? ` +€${safeToFixed(m.price, 2)}` : ''}
              </Badge>
            ))}
          </div>
        )}
        {item.notes && <p className="text-[9px] text-primary italic mt-0.5">📝 {item.notes}</p>}
      </div>
      {/* Controls */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <Button variant="ghost" size="icon" aria-label="Zapri" className="h-8 w-8 text-destructive touch-manipulation" onClick={() => removeFromCart(item.cartKey)}>
          <X className="h-3.5 w-3.5" />
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Zmanjšaj" className="h-10 w-10 touch-manipulation" onClick={() => updateCartQuantity(item.cartKey, item.quantity - 1)}>
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="text-sm font-bold w-7 text-center">{item.quantity}</span>
          <Button variant="outline" size="icon" aria-label="Dodaj" className="h-10 w-10 touch-manipulation" onClick={() => updateCartQuantity(item.cartKey, item.quantity + 1)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-xs font-bold">€{(item.price * item.quantity).toFixed(2)}</p>
      </div>
    </motion.div>
  )
})
