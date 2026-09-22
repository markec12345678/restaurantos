'use client'

import { memo } from 'react'
import { ArrowUpCircle } from 'lucide-react'
import { tierConfig, formatPoints } from './constants'
import { tierProgress } from '@/lib/loyalty-tiers'

// ============================================
// NAPREDEK NIVOJA (TIER PROGRESS)
// Runda 44: prvič živ prikaz napredka do naslednjega nivoja.
// Pragovi prihajajo iz src/lib/loyalty-tiers.ts (enotni vir resnice,
// isti izračun kot samodejno povišanje v plačilnem toku).
// ============================================

/** Barvni gradient vrstice napredka per nivo (design jezik R42/R43) */
const tierBarGradient: Record<string, string> = {
  bronze: 'from-amber-500 to-amber-400',
  silver: 'from-gray-400 to-gray-300',
  gold: 'from-yellow-500 to-yellow-400',
  platinum: 'from-purple-500 to-purple-400',
}

interface LoyaltyTierProgressProps {
  lifetimePoints: number
  tier: string
  /** 'card' = polna kartica (zgodovina), 'inline' = miniaturna vrstica (tabela) */
  variant?: 'card' | 'inline'
}

export const LoyaltyTierProgress = memo(function LoyaltyTierProgress({
  lifetimePoints,
  tier,
  variant = 'card',
}: LoyaltyTierProgressProps) {
  const progress = tierProgress(lifetimePoints, tier)
  const currentTier = tierConfig[progress.current] || tierConfig.bronze
  const nextTier = progress.next ? tierConfig[progress.next] : null
  const gradient = tierBarGradient[progress.current] || tierBarGradient.bronze

  if (variant === 'inline') {
    return (
      <div
        className="w-full"
        title={
          progress.next
            ? `${formatPoints(progress.pointsToNext ?? 0)} točk do ${nextTier?.label} (${progress.progressPct} %)`
            : 'Najvišji nivo dosežen'
        }
      >
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress.progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={`Napredek do nivoja ${nextTier?.label ?? 'platinum'}`}>
          <div
            className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
            style={{ width: `${progress.progressPct}%` }}
          />
        </div>
        <p className="mt-1 text-[10px] leading-tight text-muted-foreground tabular-nums">
          {progress.next
            ? `${progress.progressPct} % do ${nextTier?.label}`
            : 'Najvišji nivo'}
        </p>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border ${currentTier.borderColor} ${currentTier.bgColor} p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ArrowUpCircle className={`h-4 w-4 ${currentTier.color}`} />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Napredek nivoja</span>
        </div>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {formatPoints(progress.lifetimePoints)} točk skupaj
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-sm font-bold ${currentTier.color}`}>{currentTier.label}</span>
        {progress.next && nextTier ? (
          <span className="text-xs text-muted-foreground">
            → {nextTier.label} ({formatPoints(progress.nextThreshold ?? 0)} točk)
          </span>
        ) : (
          <span className="text-xs font-medium text-purple-700 dark:text-purple-400">Najvišji dosežen nivo</span>
        )}
      </div>

      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-background/70" role="progressbar" aria-valuenow={progress.progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={`Napredek do nivoja ${nextTier?.label ?? 'platinum'}`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
          style={{ width: `${progress.progressPct}%` }}
        />
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
        {progress.next
          ? `Še ${formatPoints(progress.pointsToNext ?? 0)} točk do ${nextTier?.label} — ${progress.progressPct} %`
          : 'Čestitamo — dosegli ste vrh programa zvestobe.'}
      </p>
    </div>
  )
})
