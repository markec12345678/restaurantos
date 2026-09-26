// ============================================
// ŽIVLJENJSKI CIKEL ZVESTOBE — KONSTANTE + ČISTI POMOČNIKI
// R143-b (epic #115 #30 Loyalty / customer lifecycle)
// ============================================
// ENOTEN VIR RESNICE za segmentacijo življenjskega cikla — rabi strežnik
// (GET /api/loyalty/lifecycle + expiry_notify akcija) IN UI (R143-c, brez
// dupliciranja pragov po BUG-04 kanonu literarnih map).
//
// Semantika (R143-a kontrakt (b)) — segment po DNEVAH OD ZADNJE
// LoyaltyTransaction na AKTIVNEM računu:
//   new      → račun še BREZ transakcij (ničelar — prišel, ni kupil)
//   active   → zadnja transakcija ≤ LIFECYCLE_ACTIVE_MAX_DAYS dni
//   at_risk  → 61–LIFECYCLE_AT_RISK_MAX_DAYS dni (okno za winback!)
//   churned  → > LIFECYCLE_AT_RISK_MAX_DAYS dni
//
// Prag 60 dni je namerno 1:1 z WINBACK_INACTIVE_DAYS (lib/loyalty-automation)
// — "inactive60d" v totals in segment at_risk pripovedujeta isto zgodbo.

/** Zgornja meja "active" segmenta (dnevi od zadnje transakcije, vključno). */
export const LIFECYCLE_ACTIVE_MAX_DAYS = 60
/** Zgornja meja "at_risk" segmenta (dnevi, vključno); nad tem → churned. */
export const LIFECYCLE_AT_RISK_MAX_DAYS = 180

/**
 * FIFO približek okna za "točke, ki potečejo v 30 dneh": točke veljajo 365 dni
 * (POINTS_EXPIRY_DAYS kanon v lib/loyalty-automation), zato so danes "nevarne"
 * tiste, ki jih račun NI prislužil v zadnjih 365 − 30 = 335 dneh.
 */
export const LIFECYCLE_EXPIRY_WINDOW_DAYS = 335

/**
 * Bounded take za agregacije po računih (buckets + FIFO expiring izračun).
 * Tipična lokacija ima < nekaj tisoč aktivnih računov; cap je varovalo proti
 * nefinantnemu full-scanu na velikih tenantih. Ob doseženem capu je izračun
 * PODOBREŠEN (vrnjen je pošten `capped` flag, kjer kontrakt zahteva).
 */
export const LIFECYCLE_ACCOUNT_CAP = 2000

/** Velikost topAccounts seznama (kontrakt R143-b: top 5 po pointsBalance). */
export const LIFECYCLE_TOP_ACCOUNTS = 5

export type LifecycleBucket = 'new' | 'active' | 'at_risk' | 'churned'

/** Literarni seznam segmentov (UI iteracija po BUG-04 kanonu). */
export const LIFECYCLE_BUCKETS: readonly LifecycleBucket[] = ['new', 'active', 'at_risk', 'churned'] as const

/**
 * Čisti pomožnik: segment za podano število dni od zadnje transakcije.
 * null/undefined (brez transakcij) → 'new'. Delni dnevi se FLOOR-ajo
 * (60 dni 23 h = 60 → še 'active'; 180 dni 23 h → še 'at_risk').
 * Ne-finite vrednosti (NaN — futurni/pokvarjeni podatki) → 'new' (varno).
 */
export function lifecycleBucketForDays(daysSinceLastTx: number | null | undefined): LifecycleBucket {
  if (daysSinceLastTx == null || !Number.isFinite(daysSinceLastTx)) return 'new'
  const days = Math.floor(Math.max(0, daysSinceLastTx))
  if (days <= LIFECYCLE_ACTIVE_MAX_DAYS) return 'active'
  if (days <= LIFECYCLE_AT_RISK_MAX_DAYS) return 'at_risk'
  return 'churned'
}
