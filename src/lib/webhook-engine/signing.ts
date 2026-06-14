// ============================================
// WEBHOOK ENGINE — Podpisovanje
// HMAC-SHA256 podpisovanje in preverjanje
// ============================================

import crypto from 'crypto'

/**
 * Ustvari HMAC-SHA256 podpis za webhook payload
 * Format: sha256=<hex-digest> (enako kot GitHub/Stripe webhooks)
 */
export function signPayload(payload: string, secret: string): string {
  if (!secret) return ''
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  return `sha256=${hmac.digest('hex')}`
}

/**
 * Preveri HMAC-SHA256 podpis (za prejem webhooks)
 * FIX MEDIUM: timingSafeEqual zahteva enako dolžino bufferjev — padding za varno primerjavo
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false
  const expected = signPayload(payload, secret)
  try {
    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(expected)
    // FIX: Če sta bufferja različnih dolžin, primerjamo z začasnimi bufferji enake dolžine
    // timingSafeEqual zahteva enako dolžino — različna dolžina že razkrije informacijo
    const maxLen = Math.max(sigBuf.length, expBuf.length)
    const sigPadded = Buffer.alloc(maxLen)
    const expPadded = Buffer.alloc(maxLen)
    sigBuf.copy(sigPadded)
    expBuf.copy(expPadded)
    return crypto.timingSafeEqual(sigPadded, expPadded)
  } catch {
    return false
  }
}
