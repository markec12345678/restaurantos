// ============================================
// WEBAUTHN CHALLENGE STORE
//
// In-memory store za WebAuthn challenge-je z automatskim TTL.
// Vsak challenge je vezan na employeeId (registration) ali sessionKey (login).
//
// ⚠️ Issue #39: V multi-replica deploymentu (Vercel/Render) to NE deluje
// pravilno — challenge se ustvari na repliki A, request pride na repliko B.
// Za produkcijo potrebujemo Redis adapter (naslednja faza).
// ============================================

interface ChallengeEntry {
  challenge: string
  expiresAt: number
}

const store = new Map<string, ChallengeEntry>()

const CLEANUP_INTERVAL_MS = 60_000
const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minut — FIDO2 spec priporoča 5 minutni timeout

let cleanupTimer: NodeJS.Timeout | null = null

function ensureCleanup() {
  if (cleanupTimer) return
  if (typeof setInterval === 'undefined') return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.expiresAt < now) store.delete(key)
    }
  }, CLEANUP_INTERVAL_MS)
  if (cleanupTimer && typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref()
  }
}

/**
 * Shrani challenge za določen ključ.
 */
export function saveChallenge(key: string, challenge: string, ttlMs: number = DEFAULT_TTL_MS): void {
  ensureCleanup()
  store.set(key, {
    challenge,
    expiresAt: Date.now() + ttlMs,
  })
}

/**
 * Vzame challenge in ga ATOMSKO odstrani (one-shot).
 *
 * Atomarnost: challenge je porabljen takoj ko je prebrana — tudi če
 * verifyAssertion() spodleti, challenge je NEUPORABLJIV (preprečuje replay).
 */
export function takeChallenge(key: string): string | null {
  const entry = store.get(key)
  if (!entry) return null

  store.delete(key)

  if (entry.expiresAt < Date.now()) {
    return null
  }
  return entry.challenge
}

/**
 * Število aktivnih challenge-jev (za debug).
 */
export function challengeStoreSize(): number {
  return store.size
}

/**
 * Počisti vse challenge-je (samo za teste).
 */
export function clearChallenges(): void {
  store.clear()
}
