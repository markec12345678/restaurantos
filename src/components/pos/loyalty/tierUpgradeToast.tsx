'use client'

// ============================================
// RUNDA 61: STILIZIRAN "CELEBRATE" TOAST ob samodejnem povišanju nivoja
// Pokliče se iz useLoyaltyMutations (adjust/update), ko odgovor API-ja
// nosi tierUpgrade flag. Vstopna točka: /api/loyalty/[id] PUT.
// ============================================

import { toast } from 'sonner'
import { tierConfig } from './constants'
import { tierLabelSi, TIER_THRESHOLDS } from '@/lib/loyalty-tiers'

export function toastTierUpgrade(toTier: string): void {
  const cfg = tierConfig[toTier]
  const Icon = cfg?.icon
  const label = tierLabelSi(toTier)
  const perk = TIER_THRESHOLDS.find((t) => t.tier === toTier)?.perk

  toast.success(
    <div className="flex items-start gap-3 py-0.5" data-testid="tier-upgrade-toast">
      <span className="flex h-9 w-9 shrink-0 animate-pulse items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md">
        {Icon ? <Icon className="h-5 w-5" /> : '★'}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-bold leading-tight">
          Napredovanje na <span className="text-violet-600 dark:text-violet-400">{label}</span> nivo!
        </p>
        {perk && <p className="text-xs text-muted-foreground">{perk}</p>}
        <p className="text-[11px] text-muted-foreground">SMS obvestilo je poslano stranki.</p>
      </div>
    </div>,
    { duration: 8000 },
  )
}
