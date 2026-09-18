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

// ─── RUNDA 45: bonus točk po nivoju (perk izkoriščanje) ───
// Ugodnosti iz perk opisov so ZDAJ DEJANSKO izkoriščene ob earn:
//   silver +5 % / gold +10 % / platinum +15 % dodatnih točk na vsako
// pridobitev. Bonus se šteje na OSNOVNE točke (base = floor(earnBase ×
// pointsPerEuro)), zaokroži se NAVZDOL (nikoli ne darimo frakcij),
// in se zapiše kot LOČENA transakcija ('earn', reason "Bonus nivoa …"),
// da je zgodovina pregledna in revizijsko sledljiva.

/** Bonus odstotkov dodatnih točk per nivo (0 pri bronze) */
export const TIER_EARN_BONUS_PCT: Readonly<Record<TierName, number>> = {
  bronze: 0,
  silver: 5,
  gold: 10,
  platinum: 15,
} as const

/** Bonus % za znani nivo; neznano ime → 0 (varno privzeto brez bonusa) */
export function tierEarnBonusPct(tier: string): number {
  const pct = (TIER_EARN_BONUS_PCT as Record<string, number | undefined>)[tier]
  return typeof pct === 'number' && Number.isFinite(pct) && pct > 0 ? pct : 0
}

export interface TierBonusBreakdown {
  /** Osnovne točke brez bonusa (floor) */
  base: number
  /** Bonus točke (floor(base × pct / 100)) */
  bonus: number
  /** Skupaj za nakazati = base + bonus */
  total: number
  /** Uveljavljen bonus odstotek (0–15) */
  pct: number
}

/** Razčleni earn točke na osnovne + bonus za dani nivo.
 *  Enoten vir resnice za BACKEND (handleLoyaltyEarn) in UI (preview badge),
 *  da se preview NIKOLI ne razlikuje od dejanskega nakazila. */
export function applyTierBonus(basePoints: number, tier: string): TierBonusBreakdown {
  const base = Number.isFinite(basePoints) && basePoints > 0 ? Math.floor(basePoints) : 0
  const pct = base > 0 ? tierEarnBonusPct(tier) : 0
  const bonus = pct > 0 ? Math.floor((base * pct) / 100) : 0
  return { base, bonus, total: base + bonus, pct }
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
