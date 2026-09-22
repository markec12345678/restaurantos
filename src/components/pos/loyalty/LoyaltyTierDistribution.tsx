'use client'

import { memo, useMemo } from 'react'
import { tierConfig, formatPoints } from './constants'
import { TIER_THRESHOLDS } from '@/lib/loyalty-tiers'

// ============================================
// PORAZDELITEV NIVOJEV (TIER DISTRIBUTION STRIP)
// Runda 44: en vrstični pregled koliko računov je na katerem nivoju
// + skupni seštevek točk per nivo. Klik na ploščico nastavi filter
// tabele na ta nivo (še en klik ga odstrani).
// ============================================

interface AccountLite {
  tier: string
  pointsBalance: number
  lifetimePoints: number
}

interface LoyaltyTierDistributionProps {
  accounts: AccountLite[]
  activeFilter: string
  onSelectTier: (_tier: string) => void
}

export const LoyaltyTierDistribution = memo(function LoyaltyTierDistribution({
  accounts,
  activeFilter,
  onSelectTier,
}: LoyaltyTierDistributionProps) {
  const stats = useMemo(() => {
    const map = new Map<string, { count: number; points: number }>()
    for (const t of TIER_THRESHOLDS) map.set(t.tier, { count: 0, points: 0 })
    for (const a of accounts) {
      const entry = map.get(a.tier) || map.get('bronze')!
      entry.count += 1
      entry.points += a.pointsBalance || 0
    }
    return TIER_THRESHOLDS.map(t => ({
      tier: t.tier,
      perk: t.perk,
      ...(map.get(t.tier) as { count: number; points: number }),
    }))
  }, [accounts])

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="Porazdelitev nivojev">
      {stats.map(({ tier, count, points, perk }, i) => {
        const cfg = tierConfig[tier] || tierConfig.bronze
        const Icon = cfg.icon
        const isActive = activeFilter === tier
        return (
          <button
            key={tier}
            type="button"
            onClick={() => onSelectTier(isActive ? 'all' : tier)}
            aria-pressed={isActive}
            title={`Prag: ${formatPoints(TIER_THRESHOLDS[i].minLifetime)} točk — ${perk}`}
            className={`group text-left rounded-lg border p-3 transition-all duration-300 animate-fade-in-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${cfg.borderColor} ${cfg.bgColor} ${
              isActive ? 'ring-2 ring-primary/50 shadow-sm scale-[1.01]' : 'hover:shadow-md hover:-translate-y-0.5'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background/70 ${cfg.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={`text-xs font-semibold truncate ${cfg.color}`}>{cfg.label}</span>
              </div>
              <span className={`text-lg font-bold tabular-nums leading-none ${cfg.color}`}>{count}</span>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground tabular-nums truncate">
              {formatPoints(points)} točk stanje
            </p>
          </button>
        )
      })}
    </div>
  )
})
