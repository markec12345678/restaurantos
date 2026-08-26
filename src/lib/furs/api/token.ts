// ============================================
// FURS API — OAuth token management
// Pridobi in predpomni OAuth2 token za FURS API
// ============================================

import crypto from 'crypto'
import { logger } from '../../logger'
import type { FursConfig } from '../types'
import { FURS_TOKEN_URLS } from '../types'
import { loadCertificatePrivateKey } from '../crypto'

// ============================================
// OAUTH TOKEN ZA FURS
// ============================================

// Cache tokena (veljaven 1 uro)
let cachedToken: { token: string; expiresAt: number } | null = null
// Mutex: prepreči concurrent token fetch (več zahtevkov hkrati)
let tokenFetchPromise: Promise<string | null> | null = null
// FIX F06 MEDIUM: Cooldown po neuspelem token fetch — prepreči thundering herd
let lastTokenFetchFailure: number = 0
const TOKEN_FETCH_COOLDOWN_MS = 30_000 // 30 sekund cooldown po neuspelem poizkusu

export async function getFursToken(config: FursConfig): Promise<string | null> {
  // Preveri cache
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token
  }

  // FIX F06 MEDIUM: Cooldown po neuspelem poizkusu — prepreči thundering herd
  if (lastTokenFetchFailure && Date.now() - lastTokenFetchFailure < TOKEN_FETCH_COOLDOWN_MS) {
    logger.warn('FURS', `Token fetch v cooldownu — čakam ${Math.ceil((TOKEN_FETCH_COOLDOWN_MS - (Date.now() - lastTokenFetchFailure)) / 1000)}s`)
    return null
  }

  if (!config.certPath || !config.certPassword) {
    return null
  }

  // Mutex: če že teče fetch, počakaj nanj — ne pošiljaj novega zahtevka
  if (tokenFetchPromise) {
    return tokenFetchPromise
  }

  tokenFetchPromise = (async () => {
    try {
    // Naloži privatni ključ za JWT podpisovanje
    const privateKey = loadCertificatePrivateKey(config.certPath!, config.certPassword!)
    if (!privateKey) {
      logger.warn('FURS', 'Ne morem naložiti privatnega ključa za JWT')
      return null
    }

    // Generiraj JWT za FURS OAuth2 avtentikacijo
    // FURS uporablja client_credentials z JWT Bearer grant
    const now = Math.floor(Date.now() / 1000)
    const jwtHeader = { alg: 'RS256', typ: 'JWT' }
    const jwtPayload = {
      iss: config.taxId.replace('SI', ''),  // Davčna številka brez SI prefixa
      sub: config.taxId.replace('SI', ''),
      aud: FURS_TOKEN_URLS[config.environment],
      iat: now,
      exp: now + 3600, // 1 ura veljavnost
      jti: crypto.randomUUID(),
    }

    // Kodiraj JWT (Base64URL)
    const base64url = (data: string) =>
      Buffer.from(data).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    // FIX BUG-FURS-1: Signature je že Buffer — ne sme se pretvarjati v string nato nazaj v base64.
    // Prej: base64url(signature.toString('base64')) — DOUBLE encoding! (base64 → string → base64)
    // Sedaj: direktno base64url encoding iz Buffer-ja (pravilno za JWT RSA-SHA256 signature)
    const base64urlBuffer = (buf: Buffer) =>
      buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    const headerB64 = base64url(JSON.stringify(jwtHeader))
    const payloadB64 = base64url(JSON.stringify(jwtPayload))
    const signInput = `${headerB64}.${payloadB64}`

    // Podpiši z RSA-SHA256
    const signer = crypto.createSign('RSA-SHA256')
    signer.update(signInput)
    const signature = signer.sign(privateKey)
    // FIX BUG-FURS-1: uporabi base64urlBuffer (direktno iz Buffer) namesto base64url (ki pričakuje string)
    const signatureB64 = base64urlBuffer(signature)

    const jwt = `${signInput}.${signatureB64}`

    // Pošlji zahtevek za token
    const tokenUrl = FURS_TOKEN_URLS[config.environment]

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=client_credentials&client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer&client_assertion=${encodeURIComponent(jwt)}`,
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      logger.warn('FURS', `Token zahtevek zavrnjen: ${response.status}`, errorBody)
      return null
    }

    const data = await response.json() as { access_token?: string; expires_in?: number }

    if (data.access_token) {
      cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + ((data.expires_in || 3600) - 60) * 1000,
      }
      logger.info('FURS', 'OAuth token uspešno pridobljen')
      return data.access_token
    }

    return null
  } catch (err: unknown) {
    logger.error('FURS', 'Napaka pri pridobivanju tokena:', err)
    // FIX F06 MEDIUM: Zabeleži čas neuspeha za cooldown
    lastTokenFetchFailure = Date.now()
    return null
  } finally {
    tokenFetchPromise = null // Sprosti mutex
  }
  })()

  return tokenFetchPromise
}
