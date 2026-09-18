'use client'

import { memo, type Dispatch, type SetStateAction } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Users, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { guestColors, guestTextColors } from './constants'
import type { OrderItemType, LoyaltyAccountItem } from './types'
import { formatEUR } from '@/lib/safe-format'
import { applyTierBonus, tierEarnBonusPct } from '@/lib/loyalty-tiers'
import { LoyaltySection } from './LoyaltySection'

interface ByItemsTabProps {
  order: {
    id: string
    orderNumber: number
    total: number
    orderItems: OrderItemType[]
  }
  splitCount: number
  guestAssignments: Record<string, number>
  setGuestAssignments: Dispatch<SetStateAction<Record<string, number>>>
  isProcessing: boolean
  processPaymentIsPending: boolean
  onPayByItems: () => void
  // RUNDA 47: pripni zvestobni račun — earn tudi po artiklih (isti shared stanje)
  loyaltyResults: LoyaltyAccountItem[]
  loyaltySearch: string
  setLoyaltySearch: (_val: string) => void
  selectedLoyaltyId: string | null
  setSelectedLoyaltyId: (_val: string | null) => void
  loyaltyConfig?: { enabled: boolean; pointsPerEuro: number; pointsValue: number } | null
}

export const ByItemsTab = memo(function ByItemsTab({
  order,
  splitCount,
  guestAssignments,
  setGuestAssignments,
  isProcessing,
  processPaymentIsPending,
  onPayByItems,
  loyaltyResults,
  loyaltySearch,
  setLoyaltySearch,
  selectedLoyaltyId,
  setSelectedLoyaltyId,
  loyaltyConfig,
}: ByItemsTabProps) {
  // FIX TypeError: t?.filter is not a function — order.orderItems je lahko undefined
  // če API vrača partial podatke ali če je order prišel iz drugačnega vira.
  const orderItems = Array.isArray(order?.orderItems) ? order.orderItems : []
  const orderTotal = order?.total ?? 0

  // RUNDA 47: per-gost earn preview (backend handleLoyaltyEarn teče PER delno
  // plačilo — vsak gostov znesek prisluži svoje točke; ista matematika kot
  // backend: floor(znesek × pointsPerEuro) + tier bonus iz izbranega računa).
  const selectedLoyalty = loyaltyResults.find(la => la.id === selectedLoyaltyId) || null
  const guestEarn = (guestTotal: number): number => {
    if (!loyaltyConfig?.enabled || !selectedLoyalty || guestTotal <= 0) return 0
    const base = Math.max(0, Math.floor(guestTotal * (loyaltyConfig.pointsPerEuro || 1)))
    return applyTierBonus(base, selectedLoyalty.tier).total
  }
  const totalEarn = Array.from({ length: Math.max(splitCount, 2) }).reduce((sum, _, i) => {
    const gTotal = orderItems
      .filter(oi => guestAssignments[oi.id] === i + 1)
      .reduce((s, oi) => s + oi.price * oi.quantity, 0)
    return sum + guestEarn(gTotal)
  }, 0)

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold mb-2">Dodeli artikle gostom</p>
        <p className="text-[10px] text-muted-foreground mb-2">Klikni na gostovo številko ob artiklu, da ga dodeliš</p>
        {/* Guest colors */}
        <div className="flex gap-1.5 mb-2">
          {Array.from({ length: Math.max(splitCount, 2) }).map((_, i) => {
            const guestNum = i + 1
            const guestTotal = orderItems
              .filter(oi => guestAssignments[oi.id] === guestNum)
              .reduce((sum, oi) => sum + oi.price * oi.quantity, 0)
            return (
              <div key={guestNum} className="flex items-center gap-1 text-xs">
                <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold', guestColors[i % guestColors.length])}>
                  {guestNum}
                </div>
                <span className="font-medium">{formatEUR(guestTotal)}</span>
              </div>
            )
          })}
        </div>
        {/* Items list with guest assignment */}
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {orderItems.map(oi => {
            const assignedGuest = guestAssignments[oi.id] || 0
            return (
              <div key={oi.id} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-muted/50 text-sm">
                <span className="flex-1 truncate">{oi.quantity}x {oi.menuItem?.name || 'Artikel'}</span>
                <span className="text-xs text-muted-foreground mr-2">{formatEUR(oi.price * oi.quantity)}</span>
                <div className="flex gap-1">
                  {/* FIX MEDIUM: Dinamični gumbi za goste glede na splitCount */}
                  {Array.from({ length: Math.max(splitCount, 2) }).map((_, gi) => {
                    const guestNum = gi + 1
                    return (
                      <button
                        key={guestNum}
                        onClick={() => {
                          setGuestAssignments(prev => {
                            const next = { ...prev }
                            if (next[oi.id] === guestNum) delete next[oi.id]
                            else next[oi.id] = guestNum
                            return next
                          })
                        }}
                        aria-label={`Dodeli ${oi.menuItem?.name || 'artikel'} gostu ${guestNum}`}
                        aria-pressed={assignedGuest === guestNum}
                        className={cn('w-6 h-6 rounded-full text-[9px] font-bold flex items-center justify-center transition-all touch-manipulation pointer-coarse:w-10 pointer-coarse:h-10 pointer-coarse:text-xs',
                          assignedGuest === guestNum ? cn(guestColors[gi % guestColors.length], 'text-white scale-110') : 'bg-muted text-muted-foreground hover:bg-accent'
                        )}
                      >{guestNum}</button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {/* Summary */}
      <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-xs">
        {Array.from({ length: Math.max(splitCount, 2) }).map((_, i) => {
          const guestNum = i + 1
          const guestItems = orderItems.filter(oi => guestAssignments[oi.id] === guestNum)
          const guestTotal = guestItems.reduce((sum, oi) => sum + oi.price * oi.quantity, 0)
          const earn = guestEarn(guestTotal)
          return (
            <div key={guestNum} className="flex justify-between">
              <span className={cn('font-semibold', guestTextColors[i % guestTextColors.length])}>
                Gost {guestNum}
                {earn > 0 && <span className="ml-1.5 font-normal text-emerald-600 dark:text-emerald-400 tabular-nums">+{earn} t.</span>}
              </span>
              <span className="font-bold tabular-nums">{formatEUR(guestTotal)}</span>
            </div>
          )
        })}
        <Separator />
        <div className="flex justify-between font-bold">
          <span>Skupaj</span>
          <span className="tabular-nums">{formatEUR(orderTotal)}</span>
        </div>
        {/* RUNDA 47: skupni earn preview */}
        {totalEarn > 0 && (
          <div className="flex items-center justify-between rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1.5">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              Točke (skupaj)
            </span>
            <span className="text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">+{totalEarn}</span>
          </div>
        )}
        {(() => {
          const assigned = Object.keys(guestAssignments).length
          const total = orderItems.length
          return assigned < total ? (
            <p className="text-amber-600 font-medium" role="status" aria-live="polite">Dodeli še {total - assigned} od {total} artiklov</p>
          ) : null
        })()}
      </div>
      {/* RUNDA 47: pripni zvestobni račun — earn tudi po artiklih */}
      <LoyaltySection
        loyaltyResults={loyaltyResults}
        loyaltySearch={loyaltySearch}
        setLoyaltySearch={setLoyaltySearch}
        selectedLoyaltyId={selectedLoyaltyId}
        setSelectedLoyaltyId={setSelectedLoyaltyId}
        variant="earn"
        previewPoints={totalEarn}
        tierBonusPct={selectedLoyalty ? tierEarnBonusPct(selectedLoyalty.tier) : 0}
        tierBonusTier={selectedLoyalty?.tier ?? ''}
        loyaltyEnabled={loyaltyConfig?.enabled ?? false}
      />
      <Button
        className="w-full h-12 text-base font-bold"
        disabled={processPaymentIsPending || isProcessing || Object.keys(guestAssignments).length < orderItems.length}
        onClick={onPayByItems}
      >
        {processPaymentIsPending ? 'Obdelujem...' : (
          <><Users className="h-4 w-4 mr-2" aria-hidden="true" />Plačaj po artiklih</>
        )}
      </Button>
    </div>
  )
})
