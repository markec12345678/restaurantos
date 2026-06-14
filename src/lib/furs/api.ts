// ============================================
// FURS API — KOMUNIKACIJA S FURS STREŽNIKOM
// Overjanje računov, OAuth token, gradnja zahtevkov
// ============================================

import crypto from 'crypto'
import { logger } from '../logger'
import type { FursConfig, FursInvoiceData, FursVerificationResult } from './types'
import { FURS_URLS, FURS_TOKEN_URLS } from './types'
import { loadCertificatePrivateKey } from './crypto'
import { generateSimulatedEOR, toSlovenianISO } from './helpers'

// ============================================
// EOR — ENOTNA OZNAKA RAČUNA
// EOR vrne FURS strežnik kot potrditev overitve
// V testnem načinu generiramo simulirani EOR
// ============================================

/**
 * Pošlji račun na FURS strežnik za overitev
 * 
 * FURS API specifikacija:
 * - HTTP POST na /v1/cash_payments
 * - JSON body z računskimi podatki
 * - OAuth2 token za avtentikacijo
 * - Vrne EOR (Enotna Oznaka Računa)
 */
export async function verifyInvoiceWithFURS(
  config: FursConfig,
  invoiceData: FursInvoiceData,
  zoi: string,
): Promise<FursVerificationResult> {
  const now = new Date()
  const _isTest = config.environment === 'test'

  // Če ni certifikata, dovoli simulacijo SAMO če je FURS_ALLOW_SIMULATION=true
  if (!config.certPath || !config.certPassword) {
    if (process.env.FURS_ALLOW_SIMULATION === 'true') {
      logger.info('FURS', 'Brez certifikata — uporabljam simulirano overitev (FURS_ALLOW_SIMULATION=true)')
      // FIX HIGH: Simulirana overitev VRNE success=false, da klicalec NE označi računa kot fiscalVerified=true
      // Per ZDDV-1: simulirani račun NI davčno overjen — fiscalVerified MORA ostati false
      return {
        success: false,
        zoi,
        eor: generateSimulatedEOR(zoi, now),
        environment: config.environment,
        verifiedAt: now,
        isSimulation: true,
        error: 'FURS simulacija — račun NI davčno overjen. Nastavite certifikat za produkcijo.',
      }
    }
    logger.error('FURS', 'Brez certifikata in FURS_ALLOW_SIMULATION ni omogočen — overitev ni uspela')
    return {
      success: false,
      zoi,
      eor: '',
      environment: config.environment,
      verifiedAt: now,
      isSimulation: true,
      error: 'Manjka certifikat za FURS overitev. Nastavite FURS_ALLOW_SIMULATION=true za testni način.',
    }
  }

  try {
    // Korak 1: Naloži certifikat in pridobi OAuth token
    const token = await getFursToken(config)
    if (!token) {
    logger.warn('FURS', 'Ne morem pridobiti OAuth tokena — overitev ni uspela')
      return {
        success: false,
        zoi,
        eor: '',
        environment: config.environment,
        verifiedAt: now,
        isSimulation: true,
        error: 'FURS OAuth token ni na voljo — strežnik je morda nedosegljiv',
      }
    }

    // Korak 2: Pripravi FURS zahtevek
    const fursRequest = buildFursRequest(config, invoiceData, zoi)

    // Korak 3: Pošlji na FURS strežnik
    const fursUrl = FURS_URLS[config.environment]
    const response = await fetch(fursUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(fursRequest),
      signal: AbortSignal.timeout(30000), // 30s timeout
    })

    if (!response.ok) {
      const errorBody = await response.text()
      logger.error('FURS', `Napaka od strežnika: ${response.status}`, errorBody)
      return {
        success: false,
        zoi,
        eor: '',
        environment: config.environment,
        verifiedAt: now,
        isSimulation: false,
        error: `FURS strežnik je vrnil napako ${response.status}: ${errorBody}`,
      }
    }

    const result = await response.json() as { eor?: string; EOR?: string; error?: { code: string; message: string } }

    if (result.error) {
      logger.error('FURS', 'Napaka v odgovoru', result.error)
      return {
        success: false,
        zoi,
        eor: '',
        environment: config.environment,
        verifiedAt: now,
        isSimulation: false,
        error: `FURS napaka: ${result.error.code} — ${result.error.message}`,
      }
    }

    const eor = result.eor || result.EOR || ''
    return {
      success: true,
      zoi,
      eor,
      environment: config.environment,
      verifiedAt: now,
      isSimulation: false,
    }
  } catch (err: unknown) {
    logger.error('FURS', 'Napaka pri overjanju:', err)
    // FURS strežnik ni dosegljiv — vrni napako (ne tihe simulacije!)
    return {
      success: false,
      zoi,
      eor: '',
      environment: config.environment,
      verifiedAt: now,
      isSimulation: false, // FIX BUG-F9: Ni simulacija — strežnik je dejansko nedosegljiv
      error: `FURS strežnik ni dosegljiv: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

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

async function getFursToken(config: FursConfig): Promise<string | null> {
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
    
    const headerB64 = base64url(JSON.stringify(jwtHeader))
    const payloadB64 = base64url(JSON.stringify(jwtPayload))
    const signInput = `${headerB64}.${payloadB64}`

    // Podpiši z RSA-SHA256
    const signer = crypto.createSign('RSA-SHA256')
    signer.update(signInput)
    const signature = signer.sign(privateKey)
    const signatureB64 = base64url(signature.toString('base64'))
    
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

// ============================================
// FURS ZAHTETEK — JSON FORMAT
// ============================================

function buildFursRequest(
  config: FursConfig,
  invoiceData: FursInvoiceData,
  zoi: string,
): Record<string, unknown> {
  const dt = invoiceData.issueDateTime
  // FIX BUG-F3 CRITICAL: FURS zahteva lokalni čas (CET/CEST), ne UTC
  // toISOString() vrne UTC — uporabi slovenski čas za FURS
  const isoDateTime = toSlovenianISO(dt)

  // FIX BUG-F4 CRITICAL: PaymentType mora biti FURS enumeracija, ne angleške besede
  // FURS v1 spec: "CashPayment" | "PaymentCard" | "Other"
  const paymentTypeMap: Record<string, string> = {
    cash: 'CashPayment',
    card: 'PaymentCard',
    mobile: 'Other',
    other: 'Other',
  }
  const fursPaymentType = paymentTypeMap[invoiceData.paymentMethod] || 'Other'

  // FIX BUG1: Use explicit isStorno flag instead of parsing customerName
  // FIX BUG-F5 HIGH: Manjka InvoiceType — FURS zahteva za storno račune
  // 0 = redni račun, 1 = storno račun
  const isStorno = invoiceData.isStorno || false

  return {
    InvoiceRequest: {
      Header: {
        MessageID: crypto.randomUUID(),
        DateTime: isoDateTime,
      },
      Invoice: {
        TaxNumber: config.taxId.replace('SI', ''),
        IssueDateTime: isoDateTime,
        InvoiceNumber: invoiceData.invoiceNumber,
        InvoiceIdentifier: zoi,
        InvoiceType: isStorno ? 1 : 0, // FIX BUG-F5: 0=redni, 1=storno
        Premises: {
          PremisesID: config.premisesId,
          RegisterID: config.registerId,
        },
        InvoiceAmount: invoiceData.totalAmount,
        PaymentType: fursPaymentType, // FIX BUG-F4: Pravilne FURS vrednosti
        VAT: invoiceData.vatBreakdown.map(vb => ({
          TaxRate: vb.rate,
          TaxableAmount: vb.baseAmount,
          TaxAmount: vb.vatAmount,
        })),
        CustomerVATNumber: invoiceData.customerVatId || undefined,
        CustomerName: invoiceData.customerName || undefined,
        // FIX BUG1: Proper ReferenceInvoice structure for storno — FURS requires original ZOI and issue date
        ...(isStorno && invoiceData.referenceInvoice ? {
          ReferenceInvoice: {
            ReferenceInvoiceNumber: invoiceData.referenceInvoice.invoiceNumber,
            ReferenceInvoiceIdentifier: invoiceData.referenceInvoice.zoi,
            ReferenceIssueDateTime: toSlovenianISO(invoiceData.referenceInvoice.issueDateTime),
          }
        } : {}),
      },
    },
  }
}
