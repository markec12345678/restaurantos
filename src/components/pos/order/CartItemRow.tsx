'use client'

import { memo } from 'react'
import Image from 'next/image'
import { formatEUR, formatNumberSl } from '@/lib/safe-format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { Plus, Minus, X, UtensilsCrossed } from 'lucide-react'
import type { CartItemType } from '@/lib/store'

// --- Props ---

interface CartItemRowProps {
  item: CartItemType
  removeFromCart: (_cartKey: string) => void
  updateCartQuantity: (_cartKey: string, _quantity: number) => void
}

// --- Komponenta ---

// UI-REFACTOR (Sales P0): pregledna 2-vrstična postavitev (prej: X nad +/− nad
// ceno = ~100px višine in nejasna hierarhija). Zdaj: sličica + ime/modifikatorji,
// pod njim stepper [−] količina [+] in skupna cena; X je subtilen ghost gumb
// zgoraj desno (rdeča barva ostane samo na hover). Funkcije (removeFromCart,
// updateCartQuantity, aria oznake, animacija) NESPREMENJENE.
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
      className="group flex items-start gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
    >
      {/* Thumbnail — enoten placeholder kot v menijski mreži */}
      {item.image ? (
        <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 relative bg-muted">
          <Image src={item.image} alt={item.name} fill sizes="40px" className="object-cover" />
        </div>
      ) : (
        <div className="w-10 h-10 rounded-md bg-muted flex-shrink-0 flex items-center justify-center" aria-hidden="true">
          <UtensilsCrossed className="h-4 w-4 text-muted-foreground/30" strokeWidth={1.5} />
        </div>
      )}
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <p className="text-xs font-semibold leading-tight line-clamp-1" title={item.name}>{item.name}</p>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zapri"
            className="h-6 w-6 flex-shrink-0 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 touch-manipulation"
            onClick={() => removeFromCart(item.cartKey)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        {item.modifiers.length > 0 && (
          <div className="flex flex-wrap gap-0.5 mt-0.5">
            {item.modifiers.map(m => (
              <Badge key={m.id} variant="outline" className="text-[8px] h-3.5 px-1 py-0">
                {m.name}{m.price > 0 ? ` +${formatNumberSl(m.price)}` : ''}
              </Badge>
            ))}
          </div>
        )}
        {item.notes && <p className="text-[9px] text-primary italic mt-0.5">📝 {item.notes}</p>}
        {/* Stepper + cena — jasna vrstica: [−] količina [+] .... skupaj */}
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
            {/* QA (runda 11): pointer-coarse = 40px dotična tarča (WCAG 2.5.5),
                namizje kompaktno (h-7) */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Zmanjšaj"
              className="h-7 w-7 pointer-coarse:h-10 pointer-coarse:w-10 touch-manipulation"
              onClick={() => updateCartQuantity(item.cartKey, item.quantity - 1)}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="text-sm font-bold w-6 text-center tabular-nums" aria-live="polite" aria-label="Količina">{item.quantity}</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Dodaj"
              className="h-7 w-7 pointer-coarse:h-10 pointer-coarse:w-10 text-primary hover:bg-primary/10 hover:text-primary touch-manipulation"
              onClick={() => updateCartQuantity(item.cartKey, item.quantity + 1)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-muted-foreground leading-none">{formatEUR(item.price)} / kos</p>
            <p className="text-xs font-bold tabular-nums">{formatEUR(item.price * item.quantity)}</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
})
