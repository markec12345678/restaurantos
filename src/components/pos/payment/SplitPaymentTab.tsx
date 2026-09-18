'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Split, TrendingUp } from 'lucide-react'
import { formatEUR } from '@/lib/safe-format'
import { applyTierBonus } from '@/lib/loyalty-tiers'
import { LoyaltySection } from './LoyaltySection'
import type { LoyaltyAccountItem, AltPaymentItem } from './types'

interface SplitPaymentTabProps {
  splitCount: number
  setSplitCount: (_val: number) => void
  totalWithTip: number
  tipAmount: number
  splitAmount: number
  isProcessing: boolean
  processPaymentIsPending: boolean
  onPaySplit: () => void
  // RUNDA 46: zvestobni earn ob deljenem plačilu (isti shared stanje kot Eno plačilo)
  loyaltyResults: LoyaltyAccountItem[]
  loyaltySearch: string
  setLoyaltySearch: (_val: string) => void
  selectedLoyaltyId: string | null
  setSelectedLoyaltyId: (_val: string | null) => void
  loyaltyConfig?: { enabled: boolean; pointsPerEuro: number; pointsValue: number } | null
  // AlternatePaymentSection (typy, ki jih tab ni uporabljal — ostane za združljivost klica)
  altPayments?: AltPaymentItem[]
}

export const SplitPaymentTab = memo(function SplitPaymentTab({
  splitCount,
  setSplitCount,
  totalWithTip,
  tipAmount,
  splitAmount,
  isProcessing,
  processPaymentIsPending,
  onPaySplit,
  loyaltyResults,
  loyaltySearch,
  setLoyaltySearch,
  selectedLoyaltyId,
  setSelectedLoyaltyId,
  loyaltyConfig,
}: SplitPaymentTabProps) {
  // RUNDA 46: tier-aware earn preview za deljeno plačilo — vsako delno plačilo
  // prisluži svoj del (backend handleLoyaltyEarn teče PER plačilo). Prikazujemo
  // per-osobo in skupaj; ista matematika kot backend (applyTierBonus).
  const selectedLoyalty = loyaltyResults.find(la => la.id === selectedLoyaltyId) || null
  const earnPreview = (() => {
    if (!loyaltyConfig?.enabled || !selectedLoyalty) return { perPerson: 0, total: 0, bonusPct: 0 }
    const basePer = Math.max(0, Math.floor(Math.max(0, splitAmount - tipAmount / splitCount) * (loyaltyConfig.pointsPerEuro || 1)))
    const breakdown = applyTierBonus(basePer, selectedLoyalty.tier)
    return { perPerson: breakdown.total, total: breakdown.total * splitCount, bonusPct: breakdown.pct }
  })()

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold mb-2">Število oseb</p>
        <div className="flex gap-1.5">
          {[2, 3, 4, 5, 6].map(n => (
            <button
              key={n}
              onClick={() => setSplitCount(n)}
              aria-label={`${n} oseb`}
              aria-pressed={splitCount === n}
              className={`flex-1 py-2 rounded-md text-sm font-bold transition-colors touch-manipulation pointer-coarse:py-3 ${
                splitCount === n
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-muted/50 rounded-lg p-3 space-y-2">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Vsaka oseba plača</p>
          <p className="text-3xl font-bold text-primary">{formatEUR(splitAmount)}</p>
        </div>
        <Separator />
        <div className="space-y-1">
          {Array.from({ length: splitCount }).map((_, i) => (
            <div key={i} className="flex items-center justify-between text-sm py-1">
              <span className="text-muted-foreground">Oseba {i + 1}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{formatEUR(splitAmount)}</span>
              </div>
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Skupaj ({splitCount} oseb)</span>
          <span className="font-bold">{formatEUR(totalWithTip)}</span>
        </div>
        {tipAmount > 0 && (
          <div className="flex justify-between text-xs text-rose-600">
            <span>Od tega napitnina</span>
            <span>{formatEUR(tipAmount)} ({formatEUR(tipAmount / splitCount)}/osebo)</span>
          </div>
        )}
        {/* RUNDA 46: earn preview — vsako delno plačilo prisluži točke */}
        {earnPreview.total > 0 && (
          <div className="flex items-center justify-between rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1.5">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              Točke (skupaj)
            </span>
            <span className="text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              +{earnPreview.total}
              <span className="font-normal text-muted-foreground"> ({splitCount} × {earnPreview.perPerson})</span>
            </span>
          </div>
        )}
      </div>
      {/* RUNDA 46: pripni zvestobni račun — earn tudi ob deljenem plačilu */}
      <LoyaltySection
        loyaltyResults={loyaltyResults}
        loyaltySearch={loyaltySearch}
        setLoyaltySearch={setLoyaltySearch}
        selectedLoyaltyId={selectedLoyaltyId}
        setSelectedLoyaltyId={setSelectedLoyaltyId}
        variant="earn"
        previewPoints={earnPreview.perPerson}
        tierBonusPct={earnPreview.bonusPct}
        tierBonusTier={selectedLoyalty?.tier ?? ''}
        loyaltyEnabled={loyaltyConfig?.enabled ?? false}
      />
      <Button
        className="w-full h-12 text-base font-bold"
        disabled={processPaymentIsPending || isProcessing}
        onClick={onPaySplit}
      >
        {processPaymentIsPending ? (
          'Obdelujem...'
        ) : (
          <>
            <Split className="h-4 w-4 mr-2" aria-hidden="true" />
            Plačaj deljeno ({splitCount}x {formatEUR(splitAmount)})
          </>
        )}
      </Button>
    </div>
  )
})
