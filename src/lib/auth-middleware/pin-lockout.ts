// ============================================
// PIN LOCKOUT — Per-PIN zaščita pred brute-force (P1-12)
// ============================================
// Problem: IP rate limit (5 poskusov / 15 min) ščiti pred enim napadalcem,
// vendar NE pred distribuiranimi napadi (več IP-jev, X-Forwarded-For forgery
// na napačno konfiguriranih proxyjih) niti pred počasnim brute-forceom
// (1 poskus / 15 min = 96 PIN-ov na dan na IP).
//
// Rešitev: sledimo NEUSPELNIM poskusom PO PIN-u (ne po uporabniku!).
// Ključ = HMAC-SHA256(NEXTAUTH_SECRET, pin) — isti izračun kot Employee.pinLookup:
//   - brez razkritja PIN-a v pomnilniku ali logih
//   - en PIN = en ključ = en "tarčni uporabniški račun"
//   - če PIN ni v bazi, ključ vseeno sledi poskusu ugibanja
//
// Fallback (NEXTAUTH_SECRET ni nastavljen): sha256('pin-lockout|' + pin).
// To je NAMENOMO Drugačen prefix od pinLookup (slednji se ne izračuna brez
// secret-a). Fallback ključ živi samo v pomnilniku (30 min) in se nikjer
// ne persistira — offline rainbow table na pomnilniški ključ ni smislena,
// ker napadalec z dostopom do procesa že ima vse.
//
// Lockout je IN-MEMORY (single-instance) +AuditLog sled (LOGIN_FAILED_LOCKOUT).
// Na Vercelu vsaka serverless instanca vzdržuje svoj števec — primarno
// zaščito tam še vedno nosita IP rate limit + bcrypt cost 12 + timing
// equalization; lockout je dodatna plast za long-lived instanco (Docker).
// ============================================

import crypto from 'crypto'
import { PIN_LOCKOUT_THRESHOLD, PIN_LOCKOUT_MS } from './constants'

interface PinFailureRecord {
  count: number
  firstFailedAt: number
  lockedUntil: number | null
}

const pinFailures = new Map<string, PinFailureRecord>()

/** Samodejni čiščeniški interval — prepreči rast mapa na večdnevnih instancah */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
const RECORD_TTL_MS = Math.max(PIN_LOCKOUT_MS, 30 * 60 * 1000)

let cleanupTimer: ReturnType<typeof setInterval> | null = null

function ensureCleanup(): void {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, rec] of pinFailures) {
      const expiredAt = rec.lockedUntil ?? rec.firstFailedAt + RECORD_TTL_MS
      if (expiredAt < now) pinFailures.delete(key)
    }
  }, CLEANUP_INTERVAL_MS)
  // Ne drži procesa živega zaradi intervala
  if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref()
}

/**
 * Ključ za sledenje poskusom — HMAC če je secret na voljo, sicer sha256 prefix.
 * Vrne PRAZEN string samo, če je pin prazen (ne sledimo).
 */
function pinLockoutKey(pin: string): string {
  if (!pin) return ''
  const secret = process.env.NEXTAUTH_SECRET
  if (secret) {
    return crypto.createHmac('sha256', secret).update(pin).digest('hex')
  }
  return crypto.createHash('sha256').update(`pin-lockout|${pin}`).digest('hex')
}

/**
 * Ali je ta PIN trenutno zaklenjen (preveč neuspelih poskusov)?
 */
export function isPinLocked(pin: string): boolean {
  if (!pin) return false
  const key = pinLockoutKey(pin)
  if (!key) return false
  const rec = pinFailures.get(key)
  if (!rec || rec.lockedUntil === null) return false
  if (rec.lockedUntil <= Date.now()) {
    // Zaklep je potekel — počisti in dovoli nov poskus
    pinFailures.delete(key)
    return false
  }
  return true
}

/**
 * Koliko časa še traja zaklep (0, če ni zaklenjen).
 */
export function pinLockoutRemainingMs(pin: string): number {
  if (!pin) return 0
  const key = pinLockoutKey(pin)
  const rec = key ? pinFailures.get(key) : undefined
  if (!rec || rec.lockedUntil === null) return 0
  return Math.max(0, rec.lockedUntil - Date.now())
}

export interface PinFailureResult {
  /** št. zaporednih neuspelih poskusov (po tem zapisu) */
  count: number
  /** ali je ta zapis sprožil zaklep */
  locked: boolean
  /** ms do odklepa (0, če ni zaklenjen) */
  lockedForMs: number
}

/**
 * Zapiši NEUSPELEN poskus prijave s tem PIN-om.
 * Po PIN_LOCKOUT_THRESHOLD zaporednih neuspelih poskusov zakleni PIN
 * za PIN_LOCKOUT_MS.
 */
export function recordPinFailure(pin: string): PinFailureResult {
  const key = pinLockoutKey(pin)
  if (!key) return { count: 0, locked: false, lockedForMs: 0 }
  ensureCleanup()

  const now = Date.now()
  const prev = pinFailures.get(key)
  // Reset, če je zadnja serija starejša od TTL (ne kaznuj čez noč)
  const stale = !prev || (prev.lockedUntil ?? prev.firstFailedAt + RECORD_TTL_MS) < now
  const count = stale ? 1 : prev.count + 1

  let locked = false
  let lockedForMs = 0
  let lockedUntil: number | null = null
  if (count >= PIN_LOCKOUT_THRESHOLD) {
    locked = true
    lockedForMs = PIN_LOCKOUT_MS
    lockedUntil = now + PIN_LOCKOUT_MS
  }
  pinFailures.set(key, { count, firstFailedAt: stale ? now : prev.firstFailedAt, lockedUntil })
  return { count, locked, lockedForMs }
}

/**
 * Uspešna prijava — ponastavi števec neuspelih poskusov za ta PIN.
 */
export function clearPinFailures(pin: string): void {
  const key = pinLockoutKey(pin)
  if (key) pinFailures.delete(key)
}

/**
 * Progresivni delay (P1-12): ms "kazni" pred odgovorom glede na št. dosedanjih
 * neuspelih poskusov — upočasni avtomatizirano ugibanje brez blokade legitimate
 * uporabnike (1. napaka = 250ms).
 */
export function progressiveDelayMs(count: number): number {
  if (count <= 1) return 0
  return Math.min(count * 250, 4000)
}

/** Test-only: ponastavi celoten lockout state */
export function resetPinLockoutForTests(): void {
  pinFailures.clear()
}

/** Test-only: pridobi ključ za PIN (brez izračuna v testu) */
export function _pinLockoutKeyForTests(pin: string): string {
  return pinLockoutKey(pin)
}
