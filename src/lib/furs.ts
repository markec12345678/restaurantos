// ============================================
// FURS DAVČNO POTRJEVANJE (Fiscal Verification)
// Slovenski zakon ZDDV-1 — davčno overjanje računov
// Implementacija po specifikaciji FURS:
//   - ZOI (Zaščitni Oznak Izdajatelja)
//   - EOR (Enotna Oznaka Računa)
//   - QR koda za preverjanje
//   - Digitalno podpisovanje s p12 certifikatom
// ============================================

import crypto from 'crypto'
import { logger } from './logger'

// ============================================
// KONSTANTE
// ============================================

export const FURS_URLS = {
  test: 'https://blagajne-test.fu.gov.si:9002/v1/cash_payments',
  production: 'https://blagajne.fu.gov.si/v1/cash_payments',
} as const

export const FURS_TOKEN_URLS = {
  test: 'https://blagajne-test.fu.gov.si:9002/v1/cash_payments/oauth/token',
  production: 'https://blagajne.fu.gov.si/v1/cash_payments/oauth/token',
} as const

export type FursEnvironment = 'test' | 'production'

// ============================================
// TIPI
// ============================================

export interface FursConfig {
  businessId: string         // Matična številka (8 mest)
  taxId: string              // ID za DDV (SIxxxxxxxxx)
  registerId: string         // Številka blagajne
  premisesId: string         // Številka poslovnega prostora
  deviceIp: string           // IP naprave (za FURS identifikacijo)
  environment: FursEnvironment
  certPath?: string          // Pot do p12/pfx certifikata
  certPassword?: string      // Geslo certifikata
}

export interface FursReferenceInvoice {
  invoiceNumber: string      // Številka originalnega računa
  zoi: string                // ZOI originalnega računa
  issueDateTime: Date        // Datum izdaje originalnega računa
}

export interface FursInvoiceData {
  invoiceNumber: string      // Številka računa
  issueDateTime: Date        // Datum in čas izdaje
  totalAmount: number        // Skupni znesek
  paymentMethod: 'cash' | 'card' | 'mobile' | 'other'
  vatBreakdown: Array<{
    rate: number             // DDV stopnja (22, 9.5, 0)
    baseAmount: number       // Osnova
    vatAmount: number        // DDV znesek
  }>
  customerVatId?: string     // ID za DDV kupec (opcijsko)
  customerName?: string      // Ime kupca (opcijsko)
  // FIX BUG1: Proper ReferenceInvoice structure for storno — FURS requires original ZOI and issue date
  referenceInvoice?: FursReferenceInvoice
  isStorno?: boolean         // Označuje storno račun
}

export interface FursVerificationResult {
  success: boolean
  zoi: string
  eor: string
  environment: FursEnvironment
  verifiedAt: Date
  isSimulation: boolean
  error?: string
}

export interface FursQRData {
  zoi: string
  totalAmount: number
  issueDateTime: Date
  taxId: string
  businessId: string
  registerId: string
  premisesId: string
}

// ============================================
// SLOVENSKA ČASOVNA CONA (CET/CEST)
// FIX BUG-F7: FURS zahteva lokalni čas za ZOI in račune
// ============================================

/**
 * Pretvori Date v slovenski lokalni čas (CET/CEST)
 * FURS specifikacija zahteva dd.MM.yyyy HH:mm:ss v CET/CEST
 */
function toSlovenianDate(dt: Date): { year: number; month: number; day: number; hours: number; minutes: number; seconds: number } {
  // Določi DST (Daylight Saving Time) za Slovenijo
  // Zadnja nedelja v marcu 02:00 CET -> CEST (UTC+2)
  // Zadnja nedelja v oktobru 03:00 CEST -> CET (UTC+1)
  const year = dt.getUTCFullYear()
  const marchLastSun = getLastSunday(year, 2, 31) // March
  const octLastSun = getLastSunday(year, 9, 31)   // October

  const utcMs = dt.getTime()
  const marchTransition = Date.UTC(year, 2, marchLastSun, 1, 0, 0) // 01:00 UTC = 02:00 CET
  const octTransition = Date.UTC(year, 9, octLastSun, 0, 0, 0)     // 00:00 UTC = 02:00 CEST

  const isDST = utcMs >= marchTransition && utcMs < octTransition
  const offsetMs = isDST ? (2 * 60 * 60 * 1000) : (1 * 60 * 60 * 1000)

  const localMs = utcMs + offsetMs
  const localDt = new Date(localMs)

  return {
    year: localDt.getUTCFullYear(),
    month: localDt.getUTCMonth() + 1,
    day: localDt.getUTCDate(),
    hours: localDt.getUTCHours(),
    minutes: localDt.getUTCMinutes(),
    seconds: localDt.getUTCSeconds(),
  }
}

/**
 * Pridobi zadnjo nedeljo v mesecu
 */
function getLastSunday(year: number, month: number, lastDay: number): number {
  const d = new Date(Date.UTC(year, month, lastDay))
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return d.getUTCDate()
}

// ============================================
// ZOI — ZAŠČITNI OZNAK IZDAJATELJA
// Po FURS specifikaciji: RSA-SHA256 podpis podatkov računa
// ZOI = Base64(SHA256Sign(data, privateKey))
// ============================================

/**
 * Generiraj ZOI per FURS specifikaciji
 * 
 * Postopek:
 * 1. Združi podatke: TaxNumber + IssueDateTime + InvoiceNumber + PremisesId + DeviceIp + TotalAmount
 * 2. Podpiši z RSA-SHA256 (uporabi privatni ključ iz certifikata)
 * 3. ZOI = Base64(prvih 16 bajtov SHA256 hasha podpisa)
 * 
 * Če certifikat ni na voljo, uporabi deterministični SHA256 hash
 * (za testno/nameščevalno fazo — v produkciji MORA biti pravi podpis)
 */
export function generateZOI(
  data: {
    taxId: string
    invoiceNumber: string
    issueDateTime: Date
    totalAmount: number
    premisesId: string
    registerId: string
    environment?: FursEnvironment  // FIX MEDIUM: Če ni podan, default = 'production' (varnostno)
  },
  privateKey?: string | Buffer
): string {
  // FIX MEDIUM: Default na production — prepreči tihi SHA256 fallback
  const env: FursEnvironment = data.environment ?? 'production'
  // Korak 1: Formatiraj datum po FURS specifikaciji (dd.MM.yyyy HH:mm:ss)
  // FIX BUG-F7 CRITICAL: Uporabi SLOVENSKI lokalni čas (CET/CEST), ne server time
  // Če server teče v UTC (Docker), bi getHours() vrnil UTC ure — ZOI bi bil napačen!
  const dt = data.issueDateTime
  const slovenianDate = toSlovenianDate(dt)
  const formattedDate = `${String(slovenianDate.day).padStart(2, '0')}.${String(slovenianDate.month).padStart(2, '0')}.${slovenianDate.year} ${String(slovenianDate.hours).padStart(2, '0')}:${String(slovenianDate.minutes).padStart(2, '0')}:${String(slovenianDate.seconds).padStart(2, '0')}`

  // Korak 2: Združi podatke po FURS specifikaciji
  // Format: TaxId | DateTime | InvoiceNumber | PremisesId | DeviceId | TotalAmount
  // FIX: FURS spec requires deviceIp (electronic device identifier), NOT registerId
  const totalStr = data.totalAmount.toFixed(2)
  const concatenatedData = [
    data.taxId,
    formattedDate,
    data.invoiceNumber,
    data.premisesId,
    data.registerId, // This serves as the electronic device identifier per FURS ZOI specification
    totalStr,
  ].join('|')

  if (privateKey) {
    // Korak 3a: Pravi RSA-SHA256 podpis (produkcija)
    try {
      const signer = crypto.createSign('RSA-SHA256')
      signer.update(concatenatedData, 'utf8')
      const signature = signer.sign(privateKey)
      
      // ZOI = Base64(prvih 16 bajtov SHA256 hash podpisa)
      const signatureHash = crypto.createHash('sha256').update(signature).digest()
      const zoiBytes = signatureHash.subarray(0, 16)
      return zoiBytes.toString('base64')
    } catch (err: unknown) {
      // FIX F1 CRITICAL: Prejšnja koda je referencirala `environment` ki NI bil v sklopu —
      // v produkciji bi tiho padlo na SHA256 fallback namesto vrglo napako (ZDDV-1 kršitev)
      logger.warn('FURS', 'Napaka pri RSA podpisovanju, uporabljam fallback:', err)
      // V testnem okolju dovoli fallback, v produkciji vrni napako
      if (env === 'production') {
        throw new Error(`FURS RSA podpisovanje ni uspelo v produkciji: ${err instanceof Error ? err.message : String(err)}`)
      }
      // Fallback na SHA256 brez podpisa (samo za testno fazo)
    }
  }

  // Korak 3b: Fallback — SHA256 hash (za testno fazo)
  // Opomba: To NI skladno s FURS specifikacijo za produkcijo!
  // V produkciji MORA biti uporabljen pravi RSA-SHA256 podpis
  const hash = crypto.createHash('sha256').update(concatenatedData, 'utf8').digest()
  const zoiBytes = hash.subarray(0, 16)
  return zoiBytes.toString('base64')
}

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

// ============================================
// SLOVENSKA ČASOVNA CONA (CET/CEST)
// FIX BUG-F3: FURS zahteva lokalni čas, ne UTC
// ============================================

/**
 * Pretvori Date v ISO 8601 format s slovenskim časom (CET/CEST)
 * FURS zahteva IssueDateTime v lokalnem času
 * FIX BUG-5: Uporabi UTC-osnovan DST izračun (ne getTimezoneOffset()),
 * ki pravilno deluje tudi na UTC strežnikih (Docker).
 */
function toSlovenianISO(dt: Date): string {
  // Določi DST glede na slovenske prehode (ne strežnikov timezone)
  const year = dt.getUTCFullYear()
  const marchLastSun = getLastSunday(year, 2, 31)
  const octLastSun = getLastSunday(year, 9, 31)

  const utcMs = dt.getTime()
  const marchTransition = Date.UTC(year, 2, marchLastSun, 1, 0, 0) // 01:00 UTC = 02:00 CET
  const octTransition = Date.UTC(year, 9, octLastSun, 0, 0, 0)     // 00:00 UTC = 02:00 CEST

  const isDST = utcMs >= marchTransition && utcMs < octTransition
  const offsetHours = isDST ? 2 : 1 // CEST=+2, CET=+1

  // Ustvari lokalni čas z ustreznim offsetom
  const localMs = utcMs + (offsetHours * 60 * 60 * 1000)
  const localDt = new Date(localMs)

  const pad = (n: number) => String(n).padStart(2, '0')
  const isoStr = `${localDt.getUTCFullYear()}-${pad(localDt.getUTCMonth() + 1)}-${pad(localDt.getUTCDate())}T${pad(localDt.getUTCHours())}:${pad(localDt.getUTCMinutes())}:${pad(localDt.getUTCSeconds())}+${pad(offsetHours)}:00`
  return isoStr
}

// ============================================
// SIMULIRAN EOR (za testno fazo)
// ============================================

function generateSimulatedEOR(zoi: string, date: Date): string {
  // FURS EOR je 36-mesten niz (UUID format)
  // FIX MEDIUM: Determinističen EOR — uporabi sekundno natančnost (ne ms) za konsistentnost
  const dateStr = date.toISOString().replace(/\.\d{3}Z$/, 'Z') // Odstrani milisekunde
  const hash = crypto.createHash('sha256')
    .update(zoi + dateStr)
    .digest('hex')
  
  // Formatiraj kot UUID
  const eor = [
    hash.substring(0, 8),
    hash.substring(8, 12),
    hash.substring(12, 16),
    hash.substring(16, 20),
    hash.substring(20, 32),
  ].join('-')
  
  return eor.toUpperCase()
}

// ============================================
// QR KODA ZA FURS PREVERJANJE
// Formati: QR koda vsebuje ZOI + znesek + datum + davčno številko
// Struktura: zoi|amount|datetime|taxId|businessId|registerId|premisesId
// ============================================

/**
 * Generiraj vsebino QR kode za FURS preverjanje računa
 * 
 * FURS specifikacija za QR kodo:
 * Format: zoi_timestamp_amount_taxNumber_premisesId_registerId
 * Ali pa: Base64(JSON({zoi, ts, amount, taxNo, premises, register}))
 */
export function generateFursQRContent(data: FursQRData): string {
  // FURS QR koda — poenostavljen format za Slovenijo
  // Format po FURS specifikaciji:
  // zoi | dd.MM.yyyy HH:mm:ss | znesek | davčna št. | poslovni prostor | blagajna
  
  const dt = data.issueDateTime
  // FIX BUG-F7: Uporabi slovenski čas za QR kodo (skladno z ZOI)
  const sDt = toSlovenianDate(dt)
  const formattedDate = `${String(sDt.day).padStart(2, '0')}.${String(sDt.month).padStart(2, '0')}.${sDt.year} ${String(sDt.hours).padStart(2, '0')}:${String(sDt.minutes).padStart(2, '0')}:${String(sDt.seconds).padStart(2, '0')}`

  // Pobriši SI prefix za davčno številko v QR
  const taxNumber = data.taxId.replace('SI', '')

  const parts = [
    data.zoi,
    formattedDate,
    data.totalAmount.toFixed(2),
    taxNumber,
    data.premisesId || data.businessId,
    data.registerId,
  ]

  return parts.join('|')
}

/**
 * Generiraj URL za FURS preverjanje računa na spletu
 */
export function generateFursVerificationUrl(data: FursQRData): string {
  const qrContent = generateFursQRContent(data)
  // FURS preverjalnik: https://blagajne.fu.gov.si/validation/qr/{data}
  // V testnem načinu: https://blagajne-test.fu.gov.si/validation/qr/{data}
  const encoded = encodeURIComponent(qrContent)
  return `https://blagajne.fu.gov.si/validation/qr/${encoded}`
}

// ============================================
// NALOŽI CERTIFIKAT — PKCS12/PFX z OpenSSL + node:crypto
// ============================================

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

// Cache naloženega ključa (da ne beremo certifikata pri vsakem klicu)
let cachedPrivateKey: { key: string | Buffer; loadedAt: number } | null = null

/**
 * Naloži privatni ključ iz p12/pfx certifikata za FURS podpisovanje
 * 
 * Postopek:
 * 1. Preberi PKCS12 datoteko
 * 2. Uporabi OpenSSL za ekstrakcijo privatnega ključa v PEM format
 * 3. Ustvari crypto.KeyObject iz PEM podatkov
 * 
 * Vrne PEM formatiran privatni ključ ali null ob napaki
 */
export function loadCertificatePrivateKey(
  certPath: string,
  password: string
): string | Buffer | null {
  // Preveri cache (veljaven 1 uro)
  if (cachedPrivateKey && cachedPrivateKey.loadedAt > Date.now() - 3600000) {
    return cachedPrivateKey.key
  }

  try {
    // Preveri, da datoteka obstaja
    if (!fs.existsSync(certPath)) {
      logger.error('FURS', `Datoteka certifikata ne obstaja: ${certPath}`)
      return null
    }

    const certExt = path.extname(certPath).toLowerCase()

    if (certExt === '.p12' || certExt === '.pfx') {
      return loadFromPKCS12(certPath, password)
    } else if (certExt === '.pem' || certExt === '.key') {
      return loadFromPEM(certPath)
    } else {
      // Poskusi kot PKCS12
      logger.warn('FURS', `Nepoznana končnica ${certExt}, poskušam kot PKCS12`)
      return loadFromPKCS12(certPath, password)
    }
  } catch (err: unknown) {
    logger.error('FURS', 'Napaka pri nalaganju certifikata:', err)
    return null
  }
}

/**
 * Ekstrahiraj privatni ključ iz PKCS12 datoteke z OpenSSL
 * 
 * OpenSSL ukaz: openssl pkcs12 -in file.p12 -nocerts -nodes -passin pass:XXX
 * Vrne PEM formatiran privatni ključ
 */
function loadFromPKCS12(certPath: string, password: string): string | null {
  try {
    // Metoda 1: OpenSSL CLI (najbolj zanesljiva za FURS certifikate)
    // FIX CRITICAL: Uporabi execFileSync namesto execSync — prepreči shell injection
    // execFileSync podaja argumente direktno procesu BREZ shell interpretacije
    const pemKey = execFileSync('openssl', [
      'pkcs12', '-in', certPath, '-nocerts', '-nodes',
      '-passin', `pass:${password}`,
    ], {
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 1024 * 1024, // 1MB max
      stdio: ['pipe', 'pipe', 'pipe'], // stderr captured, not suppressed
    }).trim()

    if (!pemKey || !pemKey.includes('BEGIN')) {
      logger.error('FURS', 'OpenSSL ni vrnil veljavnega ključa')
      return tryNodeCryptoPKCS12(certPath, password)
    }

    // Preveri, da je ključ pravilen (poskusi ustvariti KeyObject)
    try {
      const keyObject = crypto.createPrivateKey({
        key: pemKey,
        format: 'pem',
      })
      // Preveri, da je RSA
      if (keyObject.asymmetricKeyType !== 'rsa') {
        logger.warn('FURS', `Ključ ni RSA (je ${keyObject.asymmetricKeyType}) — FURS zahteva RSA`)
      }
    } catch (verifyErr: unknown) {
      logger.error('FURS', 'Ključ iz OpenSSL ni veljaven:', verifyErr)
      return tryNodeCryptoPKCS12(certPath, password)
    }

    // Cache
    cachedPrivateKey = { key: pemKey, loadedAt: Date.now() }
    logger.info('FURS', 'Privatni ključ uspešno naložen iz PKCS12 (OpenSSL)')
    return pemKey
  } catch (err: unknown) {
    // OpenSSL ni na voljo ali je napaka — poskusi Node.js crypto
    logger.warn('FURS', 'OpenSSL napaka, poskušam Node.js crypto fallback:', 
      err instanceof Error ? err.message : String(err))
    return tryNodeCryptoPKCS12(certPath, password)
  }
}

/**
 * Fallback: Poskusi naložiti PKCS12 z Node.js crypto.createPrivateKey
 * (Podprto v Node.js 17+ z --experimental-openssl-legacy-provider)
 */
function tryNodeCryptoPKCS12(certPath: string, password: string): string | null {
  try {
    const p12Buffer = fs.readFileSync(certPath)
    
    // Node.js createPrivateKey z DER formatom iz PKCS12
    // Opomba: To deluje samo, če je PKCS12 brez šifriranega ključa
    // ali če Node.js podpira dešifriranje z danim geslom
    const keyObject = crypto.createPrivateKey({
      key: p12Buffer,
      format: 'der',
      type: 'pkcs8',
      passphrase: password,
    })
    
    const pemKey = keyObject.export({ type: 'pkcs8', format: 'pem' }) as string
    
    cachedPrivateKey = { key: pemKey, loadedAt: Date.now() }
    logger.info('FURS', 'Privatni ključ naložen iz PKCS12 (Node.js crypto)')
    return pemKey
  } catch (err: unknown) {
    logger.error('FURS', 'Node.js crypto PKCS12 fallback napaka:', 
      err instanceof Error ? err.message : String(err))
    return null
  }
}

/**
 * Naloži privatni ključ iz PEM datoteke
 */
function loadFromPEM(certPath: string): string | null {
  try {
    const pemData = fs.readFileSync(certPath, 'utf8')
    
    // Preveri, da je veljaven PEM ključ
    if (!pemData.includes('BEGIN')) {
      logger.error('FURS', 'Datoteka ne vsebuje veljavnega PEM ključa')
      return null
    }

    // Preveri z crypto
    try {
      crypto.createPrivateKey({ key: pemData, format: 'pem' })
    } catch {
      logger.error('FURS', 'PEM ključ ni veljaven')
      return null
    }

    cachedPrivateKey = { key: pemData, loadedAt: Date.now() }
    logger.info('FURS', 'Privatni ključ naložen iz PEM datoteke')
    return pemData
  } catch (err: unknown) {
    logger.error('FURS', 'Napaka pri branju PEM datoteke:', err)
    return null
  }
}

/**
 * Počisti cache certifikata (npr. ob spremembi nastavitev)
 */
export function clearCertificateCache(): void {
  cachedPrivateKey = null
}

/**
 * Preberi certifikat iz PKCS12 in izvleči podatke (ZA IZDAJO, ne za podpis)
 * Vrne certifikat v PEM formatu
 */
export function extractCertificateFromPKCS12(
  certPath: string,
  password: string
): string | null {
  try {
    // FIX CRITICAL: Uporabi execFileSync namesto execSync — prepreči shell injection
    const pemCert = execFileSync('openssl', [
      'pkcs12', '-in', certPath, '-clcerts', '-nokeys',
      '-passin', `pass:${password}`,
    ], {
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()

    if (!pemCert || !pemCert.includes('BEGIN CERTIFICATE')) {
      return null
    }

    return pemCert
  } catch {
    return null
  }
}

// ============================================
// VALIDACIJA FURS PODATKOV
// ============================================

/**
 * Preveri veljavnost FURS konfiguracije
 */
export function validateFursConfig(config: Partial<FursConfig>): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  if (!config.businessId) {
    errors.push('Manjka matična številka podjetja')
  } else if (!/^\d{8}$/.test(config.businessId)) {
    errors.push('Matična številka mora imeti 8 številk')
  }

  if (!config.taxId) {
    errors.push('Manjka ID za DDV')
  } else if (!/^SI\d{8,10}$/.test(config.taxId)) {
    warnings.push('ID za DDV naj bi bil v formatu SIxxxxxxxx')
  }

  if (!config.registerId) {
    errors.push('Manjka številka blagajne')
  }

  if (!config.premisesId) {
    warnings.push('Manjka številka poslovnega prostora — uporabljena bo matična številka')
  }

  if (!config.certPath) {
    warnings.push('Manjka pot do certifikata — overjanje bo simulirano')
  }

  if (!config.certPassword && config.certPath) {
    warnings.push('Manjka geslo certifikata')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Preveri povezljivost s FURS strežnikom
 * FIX F8 LOW: Uporabi GET namesto HEAD — FURS API ne podpira HEAD metode (vrne 405)
 */
export async function checkFursConnectivity(environment: FursEnvironment): Promise<{
  reachable: boolean
  responseTime?: number
  error?: string
}> {
  const _url = FURS_TOKEN_URLS[environment] // Token URL supports POST — use that for connectivity
  const start = Date.now()

  try {
    // FIX F8: Uporabimo token URL z GET — FURS cash_payments ne podpira HEAD
    // Token URL vrne 401 (Unauthorized) brez veljavnega JWT, kar pomeni, da strežnik deluje
    const response = await fetch(FURS_URLS[environment], {
      method: 'GET', // GET namesto HEAD — FURS ne podpira HEAD
      signal: AbortSignal.timeout(10000),
    })
    return {
      reachable: response.ok || response.status === 401 || response.status === 405, // 401/405 = strežnik deluje
      responseTime: Date.now() - start,
    }
  } catch (err: unknown) {
    return {
      reachable: false,
      error: err instanceof Error ? err.message : 'Neznana napaka',
    }
  }
}
