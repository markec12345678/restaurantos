// ============================================
// WEBAUTHN CHALLENGE STORE
//
// Per-request nonce za WebAuthn login/register.
//
// ✅ Issue #39 FIXED: zdaj uporablja CacheAdapter (Memory ali Redis)
//   - Single-instance deploy (default): MemoryCacheAdapter
//   - Multi-replica deploy (Vercel/Render/ECS): nastavi REDIS_URL
// ============================================

import { getCacheAdapter } from '@/lib/cache'

const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minut — FIDO2 spec priporoča

/**
 * Shrani challenge za določen ključ.
 */
export async function saveChallenge(
  key: string,
  challenge: string,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<void> {
  await getCacheAdapter().set(key, challenge, ttlMs)
}

/**
 * Vzame challenge in ga ATOMSKO odstrani (one-shot).
 *
 * Atomarnost: challenge je porabljen takoj ko je prebrana — tudi če
 * verifyAssertion() spodleti, challenge je NEUPORABLJIV (preprečuje replay).
 */
export async function takeChallenge(key: string): Promise<string | null> {
  const value = await getCacheAdapter().take(key)
  // CacheValue je string | number — WebAuthn challenge je vedno string
  if (value === null) return null
  return String(value)
}

/**
 * Število aktivnih challenge-jev (za debug).
 */
export async function challengeStoreSize(): Promise<number> {
  return await getCacheAdapter().size()
}

/**
 * Počisti vse challenge-je (samo za teste).
 */
export async function clearChallenges(): Promise<void> {
  await getCacheAdapter().clear()
}
