// ============================================
// ZVESTOBNI NIVOJI (TIER ENGINE)
// Runda 44 — prej je bil tier SAMO ročni string na računu (privzeto 'bronze'),
// brez izračuna, brez pragov, brez UI napredka. Ta lib je enotni vir resnice:
//   • pragovi po lifetimePoints (doslej zbrane točke — nikoli ne padajo z unovčenjem)
//   • calculateTier() — določi nivo iz življenjskih točk
//   • tierProgress() — napredek do naslednjega nivoja (za UI vrstico napredka)
// Pragovi so zasnovani tako, da tipičen gost po ~10 obiskih (povp. račun 25 €,
// 1 točka/€) doseže silver; redni gost letno doseže gold.
// ============================================

export type TierName = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface TierThreshold {
  tier: TierName
  /** Minimalni lifetimePoints za ta nivo (vključno) */
  minLifetime: number
  /** Kratka opisna ugodnost nivoja (za UI namig) */
  perk: string
}

/** Pragovi naraščajo — seznam MORA ostati urejen po minLifetime naraščajoče. */
export const TIER_THRESHOLDS: readonly TierThreshold[] = [
  { tier: 'bronze', minLifetime: 0, perk: 'Osnovne ugodnosti' },
  { tier: 'silver', minLifetime: 500, perk: '5 % bonus točk ob vsakem obisku' },
  { tier: 'gold', minLifetime: 2000, perk: '10 % bonus točk + brezplačna pijača' },
  { tier: 'platinum', minLifetime: 5000, perk: 'VIP mize + 15 % bonus točk' },
] as const

/** Vrni nivo za podane življenjske točke. Varianta izplača najvišji doseženi prag. */
export function calculateTier(lifetimePoints: number): TierName {
  const points = Number.isFinite(lifetimePoints) && lifetimePoints > 0 ? Math.floor(lifetimePoints) : 0
  let resolved: TierName = 'bronze'
  for (const t of TIER_THRESHOLDS) {
    if (points >= t.minLifetime) resolved = t.tier
    else break
  }
  return resolved
}

export interface TierProgress {
  current: TierName
  /** Naslednji višji nivo ali null, če je gost že platinum */
  next: TierName | null
  /** Koliko točk manjka do naslednjega nivoja (null pri platinum) */
  pointsToNext: number | null
  /** 0–100 % napredek do naslednjega nivoja (100 pri platinum) */
  progressPct: number
  /** Prag naslednjega nivoja ali null */
  nextThreshold: number | null
  /** Trenutni skupni seštevek (normaliziran) */
  lifetimePoints: number
}

/** Rang nivoja (0=bronze … 3=platinum); neznano ime → -1 */
export function tierRank(tier: string): number {
  return TIER_THRESHOLDS.findIndex(t => t.tier === tier)
}

/** Napredek do naslednjega nivoja — za UI vrstico napredka.
 *  currentTierOverride: ročno nastavljen nivo na računu; če je VIŠJI od
 *  izračunanega, se šteje kot trenutni (samodejno povišanje NIKOLI ne
 *  poniža ročno dodeljenega višjega nivoja). */
export function tierProgress(lifetimePoints: number, currentTierOverride?: string): TierProgress {
  const points = Number.isFinite(lifetimePoints) && lifetimePoints > 0 ? Math.floor(lifetimePoints) : 0
  const computed = calculateTier(points)
  const computedRank = tierRank(computed)
  const overrideRank = currentTierOverride ? tierRank(currentTierOverride) : -1
  const current = overrideRank > computedRank ? currentTierOverride as TierName : computed
  const idx = tierRank(current)
  const nextDef = idx >= 0 ? TIER_THRESHOLDS[idx + 1] : undefined

  if (!nextDef) {
    return { current, next: null, pointsToNext: null, progressPct: 100, nextThreshold: null, lifetimePoints: points }
  }

  const base = TIER_THRESHOLDS[idx].minLifetime
  const span = nextDef.minLifetime - base
  const into = Math.max(0, points - base)
  const progressPct = span > 0 ? Math.min(100, Math.round((into / span) * 100)) : 100

  return {
    current,
    next: nextDef.tier,
    pointsToNext: Math.max(0, nextDef.minLifetime - points),
    progressPct,
    nextThreshold: nextDef.minLifetime,
    lifetimePoints: points,
  }
}
