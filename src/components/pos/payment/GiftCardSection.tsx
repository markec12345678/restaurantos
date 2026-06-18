'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Gift } from 'lucide-react'
import type { GiftCardItem } from './types'
import { safeToFixed, safeNum } from '@/lib/safe-format'

interface GiftCardSectionProps {
  giftCards: GiftCardItem[]
  giftCardNumber: string
  setGiftCardNumber: (_val: string) => void
  selectedGiftCardId: string | null
  setSelectedGiftCardId: (_val: string | null) => void
}

export const GiftCardSection = memo(function GiftCardSection({
  giftCards,
  giftCardNumber,
  setGiftCardNumber,
  selectedGiftCardId,
  setSelectedGiftCardId,
}: GiftCardSectionProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold">Izberi darilno kartico</p>
      <Input
        placeholder="Išči po številki kartice..."
        value={giftCardNumber}
        onChange={e => setGiftCardNumber(e.target.value)}
        className="h-8 text-xs"
        aria-label="Išči darilno kartico"
      />
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {(giftCards || [])
          .filter(gc =>
            gc.status === 'active' && gc.balance > 0 &&
            (!giftCardNumber || gc.cardNumber.toLowerCase().includes(giftCardNumber.toLowerCase()))
          )
          .map(gc => (
            <button
              key={gc.id}
              onClick={() => setSelectedGiftCardId(gc.id)}
              className={`w-full flex items-center justify-between p-2 rounded-md text-xs transition-colors ${
                selectedGiftCardId === gc.id
                  ? 'bg-primary/10 border-primary border'
                  : 'bg-muted/50 hover:bg-muted'
              }`}
            >
              <div className="flex items-center gap-2">
                <Gift className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="font-mono font-medium">{gc.cardNumber}</span>
                {gc.ownerName && <span className="text-muted-foreground">({gc.ownerName})</span>}
              </div>
              <span className="font-bold">€{safeToFixed(gc.balance, 2)}</span>
            </button>
          ))}
      </div>
    </div>
  )
})
