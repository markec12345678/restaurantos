'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Split, TrendingUp, Ticket, AlertTriangle } from 'lucide-react'
import { formatEUR } from '@/lib/safe-format'
import { applyTierBonus, redeemPointsNeeded } from '@/lib/loyalty-tiers'
import { splitAmountBreakdown } from '@/lib/split-math'
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
  // RUNDA 49: unovčenje — vsak delni plačilo gre kot type 'loyalty' s točkami
  loyaltyRedeem?: boolean
  setLoyaltyRedeem?: (_val: boolean) => void
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
  loyaltyRedeem = false,
  setLoyaltyRedeem,
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

  // RUNDA 49: unovčenje preview — ISTA matematika kot executor (split-math
  // breakdown + ceil per del). Točke pokrijejo znesek BREZ napitnine (enako
  // kot Eno plačilo, kjer loyaltyPointsUsed = ceil(orderTotal / vrednost)).
  const pointsValue = loyaltyConfig?.pointsValue && loyaltyConfig.pointsValue > 0 ? loyaltyConfig.pointsValue : 0.01
  const redeemPreview = (() => {
    if (!selectedLoyalty) return { perPerson: 0, total: 0, feasible: false }
    // executor deli orderTotal (BREZ tipa) — totalWithTip − tipAmount
    const orderTotalNoTip = Math.max(0, totalWithTip - tipAmount)
    const parts = splitAmountBreakdown(orderTotalNoTip, splitCount)
    const perPart = parts.map(a => redeemPointsNeeded(a, pointsValue))
    const total = perPart.reduce((s, p) => s + p, 0)
    return {
      perPerson: perPart[0] ?? 0,
      total,
      feasible: selectedLoyalty.pointsBalance >= total,
    }
  })()
  const redeemToggleEnabled = !!selectedLoyalty && redeemPreview.total > 0

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
        {/* RUNDA 46: earn preview — vsako delno plačilo prisluži točke (SKRITO ob unovčenju — type 'loyalty' ne earn-a) */}
        {!loyaltyRedeem && earnPreview.total > 0 && (
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
        {/* RUNDA 49: unovčenje preview — točke pokrijejo celoten znesek (brez napitnine) */}
        {loyaltyRedeem && redeemPreview.total > 0 && (
          <div className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 ${
            redeemPreview.feasible
              ? 'border-violet-500/30 bg-violet-500/5'
              : 'border-amber-500/40 bg-amber-500/5'
          }`} aria-live="polite">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Ticket className={`h-3 w-3 ${redeemPreview.feasible ? 'text-violet-600 dark:text-violet-400' : 'text-amber-600'}`} aria-hidden="true" />
              Unovčenje (skupaj)
            </span>
            <span className={`text-xs font-bold tabular-nums ${
              redeemPreview.feasible ? 'text-violet-600 dark:text-violet-400' : 'text-amber-600 dark:text-amber-400'
            }`}>
              −{redeemPreview.total}
              <span className="font-normal text-muted-foreground"> ({splitCount} × {redeemPreview.perPerson})</span>
            </span>
          </div>
        )}
        {loyaltyRedeem && !redeemPreview.feasible && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5" role="alert">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            Stanje {selectedLoyalty?.pointsBalance ?? 0} točk ne pokrije potrebnih {redeemPreview.total} — plačilo bo zavrnjeno.
          </p>
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
        previewPoints={loyaltyRedeem ? 0 : earnPreview.perPerson}
        tierBonusPct={loyaltyRedeem ? 0 : earnPreview.bonusPct}
        tierBonusTier={selectedLoyalty?.tier ?? ''}
        redeemActive={loyaltyRedeem}
        loyaltyEnabled={loyaltyConfig?.enabled ?? false}
      />
      {/* RUNDA 49: preklop unovčenja — točke pokrijejo vsak del zneska.
        Vidno ŠELE ko je račun pripet (brez računa ni vir točk). */}
      {selectedLoyalty && setLoyaltyRedeem && (
        <button
          type="button"
          role="switch"
          aria-checked={loyaltyRedeem}
          disabled={!redeemToggleEnabled}
          onClick={() => setLoyaltyRedeem(!loyaltyRedeem)}
          className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors touch-manipulation ${
            loyaltyRedeem
              ? 'border-violet-500/50 bg-violet-500/10'
              : redeemToggleEnabled
                ? 'border-border hover:bg-accent'
                : 'border-border/60 opacity-50 cursor-not-allowed'
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <Ticket className={`h-4 w-4 flex-shrink-0 ${loyaltyRedeem ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground'}`} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-xs font-semibold">Plačilo s točkami (unovčenje)</span>
              <span className="block text-[10px] text-muted-foreground tabular-nums">
                {redeemToggleEnabled
                  ? `${selectedLoyalty.pointsBalance} točk na voljo · pokrije vse ${splitCount} delov`
                  : 'Znesek prenizek za unovčenje'}
              </span>
            </span>
          </span>
          <span
            aria-hidden="true"
            className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
              loyaltyRedeem ? 'bg-violet-600' : 'bg-muted-foreground/30'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              loyaltyRedeem ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`} />
          </span>
        </button>
      )}
      <Button
        className="w-full h-12 text-base font-bold"
        disabled={
          processPaymentIsPending || isProcessing ||
          // RUNDA 49: unovčenje brez dovolj točk → gumb onemogočen (amber opozorilo zgoraj pove zakaj)
          (loyaltyRedeem && redeemPreview.total > 0 && !redeemPreview.feasible)
        }
        onClick={onPaySplit}
      >
        {processPaymentIsPending ? (
          'Obdelujem...'
        ) : (
          <>
            <Split className="h-4 w-4 mr-2" aria-hidden="true" />
            {loyaltyRedeem && redeemPreview.total > 0
              ? `Plačaj s točkami (${splitCount} × ${redeemPreview.perPerson} t.)`
              : `Plačaj deljeno (${splitCount}x ${formatEUR(splitAmount)})`}
          </>
        )}
      </Button>
    </div>
  )
})
