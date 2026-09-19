'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Coins, ArrowUpCircle, ArrowDownCircle, RotateCcw, Trophy, Gem } from 'lucide-react'
import { type LoyaltyAccount, formatPoints } from './constants'
import { maybeTierUpgrade, tierProgress, tierLabelSi, TIER_THRESHOLDS } from '@/lib/loyalty-tiers'

interface AdjustData {
  type: 'earn' | 'redeem' | 'adjust'
  points: string
  reason: string
  monetaryValue: string
}

interface LoyaltyAdjustFormProps {
  adjustAccount: LoyaltyAccount | null
  adjustData: AdjustData
  isPending: boolean
  onAdjustDataChange: (_data: AdjustData) => void
  onSubmit: () => void
  onCancel: () => void
}

export const LoyaltyAdjustForm = memo(function LoyaltyAdjustForm({
  adjustAccount,
  adjustData,
  isPending,
  onAdjustDataChange,
  onSubmit,
  onCancel,
}: LoyaltyAdjustFormProps) {
  return (
    <div className="space-y-4">
      {adjustAccount && (
        <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/50">
          <span className="text-sm text-muted-foreground">Trenutno stanje točk</span>
          <span className="font-bold text-lg">{formatPoints(adjustAccount.pointsBalance)}</span>
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">Vrsta transakcije</Label>
        <Select value={adjustData.type} onValueChange={(v) => onAdjustDataChange({ ...adjustData, type: v as 'earn' | 'redeem' | 'adjust' })}>
          <SelectTrigger autoFocus><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="earn"><span className="flex items-center gap-2"><ArrowUpCircle className="h-3.5 w-3.5 text-emerald-600" />Prislužene točke</span></SelectItem>
            <SelectItem value="redeem"><span className="flex items-center gap-2"><ArrowDownCircle className="h-3.5 w-3.5 text-blue-600" />Unovči točke</span></SelectItem>
            <SelectItem value="adjust"><span className="flex items-center gap-2"><RotateCcw className="h-3.5 w-3.5 text-amber-600" />Prilagoditev</span></SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">Število točk *</Label>
        <DecimalInput placeholder="npr. 100" value={adjustData.points} onValueChange={(n) => onAdjustDataChange({ ...adjustData, points: String(n) })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">Denarna vrednost (€)</Label>
        <DecimalInput placeholder="npr. 5.00" value={adjustData.monetaryValue} onValueChange={(n) => onAdjustDataChange({ ...adjustData, monetaryValue: String(n) })} />
        <p className="text-xs text-muted-foreground">Neobvezno — vnesite, če točke ustrezajo določenemu znesku</p>
      </div>
      {(() => {
        // RUNDA 61: ŽIVI PREDOGLED nivo toka — isti izračun kot backend
        // (maybeTierUpgrade) → napoved "s to prilagoditvijo bo napredoval v X"
        // PRED oddajo. Unovčenje (redeem) lifetime ne poveča → brez napovedi.
        if (!adjustAccount || adjustData.type === 'redeem') return null
        const delta = Number.parseFloat(adjustData.points)
        if (!Number.isFinite(delta) || delta <= 0) return null
        const newLifetime = adjustAccount.lifetimePoints + Math.floor(delta)
        const upgradedTo = maybeTierUpgrade(adjustAccount.tier, newLifetime)
        if (upgradedTo) {
          const UpgradeIcon = upgradedTo === 'platinum' ? Gem : Trophy
          return (
            <div className="flex items-start gap-2.5 rounded-lg border border-violet-300/60 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-950/30" data-testid="adjust-upgrade-preview">
              <UpgradeIcon className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
              <div className="space-y-0.5 text-xs">
                <p className="font-semibold text-violet-700 dark:text-violet-300">
                  S to prilagoditvijo stranka samodejno napreduje v {tierLabelSi(upgradedTo)} nivo!
                </p>
                <p className="text-violet-600/80 dark:text-violet-400/80">
                  {TIER_THRESHOLDS.find((t) => t.tier === upgradedTo)?.perk ?? 'Povišanje se zapiše v zgodovino računa.'}
                </p>
              </div>
            </div>
          )
        }
        const progress = tierProgress(newLifetime, adjustAccount.tier)
        if (!progress.next || !progress.nextThreshold) return null
        return (
          <div className="space-y-1.5 rounded-lg border bg-muted/40 p-3" data-testid="adjust-progress-preview">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Napredek do nivoja {tierLabelSi(progress.next)}</span>
              <span className="font-semibold">{formatPoints(progress.pointsToNext ?? 0)} točk manjka</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress.progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={`Napredek do nivoja ${tierLabelSi(progress.next)}`}>
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500" style={{ width: `${progress.progressPct}%` }} />
            </div>
          </div>
        )
      })()}
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">Razlog *</Label>
        <Textarea placeholder="npr. Rojstnodnevni bonus, kompenzacija, napaka..." value={adjustData.reason} onChange={(e) => onAdjustDataChange({ ...adjustData, reason: e.target.value })} rows={2} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Prekliči</Button>
        <Button onClick={onSubmit} disabled={isPending}>
          {isPending ? (<><span className="animate-spin mr-2">⏳</span>Prilagajam...</>) : (<><Coins className="h-4 w-4 mr-1.5" />Potrdi</>)}
        </Button>
      </div>
    </div>
  )
})

export type { AdjustData }
