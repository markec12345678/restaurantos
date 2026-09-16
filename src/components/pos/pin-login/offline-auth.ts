'use client'
// ============================================
// OFFLINE-FIRST AUTH —_cached device session z TTL
// ============================================
//
// NAMEN (worklog Task 4 → naslednji korak "offline-first auth"):
// Ko naprava IZGUBI mrežo, se POS ni mogel prijaviti (PIN validacija je
// server-side) → natakar je obstal na prijavnem ekranu, četudi bi lahko
// naročila šla v offline vrsto (offline-orders.ts). Zdaj: ob uspešni ONLINE
// prijavi shranimo "device session" (PIN-verifikator + uporabnik + TTL).
// Ob naslednji prijavi BREZ mreže lahko natakar s pravilnim PIN-om odpre
// degradiran offline sejs — naročila se vrstijo lokalno in gredo na
// strežnik ob vrnitvi povezave.
//
// VARNOST:
// - Verifikator je SHA-256(PIN + salt + employeeId) — NE sam PIN.
// - TTL 12h — po tem offline prijava ni več mogoča (mora biti online).
// - Brute-force zaščita: max 5 poskusov / 15 min (4-6 mestni PIN je
//   sicer šibek, ampak naprava je fizično v restavraciji; 5 poskusov
//   zadošča za POS kontekst).
// - Seja se izbriše ob odjavi (clearOfflineSession).

import type { AuthUser } from './constants'

const STORAGE_KEY = 'pos_offline_session'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12 ur
const MAX_ATTEMPTS = 5
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000

interface OfflineSession {
  employee: AuthUser
  /** SHA-256(PIN + salt + employeeId) kot hex — za primerjavo, ne za razbijanje */
  pinVerifier: string
  cachedAt: number
  expiresAt: number
}

interface AttemptRecord {
  count: number
  windowStart: number
}

function storageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage
  } catch {
    return false
  }
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function pinVerifier(pin: string, employeeId: string): Promise<string> {
  return sha256Hex(`${pin}:restaurantos-offline-session:${employeeId}`)
}

/** Ob uspešni ONLINE prijavi — shrani sejo za morebitne offline prijave. */
export async function cacheOfflineSession(employee: AuthUser, pin: string): Promise<void> {
  if (!storageAvailable() || !employee?.id || !pin) return
  try {
    const now = Date.now()
    const session: OfflineSession = {
      employee,
      pinVerifier: await pinVerifier(pin, employee.id),
      cachedAt: now,
      expiresAt: now + SESSION_TTL_MS,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Neuspelo shranjevanje ne sme porušiti ONLINE prijave
  }
}

export function clearOfflineSession(): void {
  if (!storageAvailable()) return
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

function getAttempts(): AttemptRecord {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:attempts`)
    if (raw) return JSON.parse(raw) as AttemptRecord
  } catch { /* ignore */ }
  return { count: 0, windowStart: 0 }
}

function isRateLimited(): boolean {
  const a = getAttempts()
  if (a.windowStart === 0) return false
  if (Date.now() - a.windowStart > ATTEMPT_WINDOW_MS) return false // okno poteče
  return a.count >= MAX_ATTEMPTS
}

function recordAttempt(): void {
  const now = Date.now()
  const a = getAttempts()
  const next: AttemptRecord = (now - a.windowStart > ATTEMPT_WINDOW_MS)
    ? { count: 1, windowStart: now }
    : { count: a.count + 1, windowStart: a.windowStart }
  try { localStorage.setItem(`${STORAGE_KEY}:attempts`, JSON.stringify(next)) } catch { /* ignore */ }
}

function clearAttempts(): void {
  try { localStorage.removeItem(`${STORAGE_KEY}:attempts`) } catch { /* ignore */ }
}

export interface OfflineLoginResult {
  employee: AuthUser
  /** Seja poteče čez toliko ms — UI lahko pokaže opozorilo */
  expiresInMs: number
}

/** Ob OFFLINE prijavi — preveri PIN proti cached session-u.
    Vrne null če: session ne obstaja / potečen / rate-limited / napačen PIN.
    Ločevanje vzrokov pusti klicatelju (vrnejo se specifični exceptioni). */
export async function verifyOfflinePin(pin: string): Promise<OfflineLoginResult | null> {
  if (!storageAvailable() || !pin) return null
  if (isRateLimited()) {
    throw new Error('Preveč neuspešnih offline poskusov — poskusite čez 15 minut')
  }
  let session: OfflineSession | null = null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    session = JSON.parse(raw) as OfflineSession
  } catch {
    return null
  }
  if (!session?.employee?.id || !session.pinVerifier) return null
  if (Date.now() > session.expiresAt) {
    clearOfflineSession()
    return null
  }
  recordAttempt()
  const verifier = await pinVerifier(pin, session.employee.id)
  if (verifier !== session.pinVerifier) return null
  clearAttempts()
  return {
    employee: session.employee,
    expiresInMs: session.expiresAt - Date.now(),
  }
}

/** Ali je za to napravo na voljo offline prijava (za UI namig na prijavnem ekranu)? */
export function hasOfflineSession(): boolean {
  if (!storageAvailable()) return false
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const session = JSON.parse(raw) as OfflineSession
    return Date.now() <= session.expiresAt && !!session.employee?.id
  } catch {
    return false
  }
}
