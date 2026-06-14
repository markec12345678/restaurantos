// ============================================
// API VARNOSTNI POMOŽNIKI
// Omejevanje velikosti zahtevkov, validacijski helper
// ============================================

import { NextResponse } from 'next/server'
import { ZodSchema } from 'zod'
import { sanitizeObject } from './sanitize'
import { logger } from './logger'

// ============================================
// VALIDACIJA ODHODNEGA ODZIVA (Response Validation)
// Prepreči, da bi API vrnil napačno oblikovane podatke
// V development načinu vrže napako, v produkciji samo logira
// ============================================

/**
 * Validira odhodni API odziv proti Zod shemi.
 * V development načinu (NODE_ENV !== 'production') vrže napako ob neuspehu —
 * to zagotovi, da razvijalec takoj zazna neskladje med shemo in podatki.
 * V produkciji samo logira opozorilo in vrne originalne podatke —
 * ne blokira delovanja sistema ob moremismatchu.
 *
 * @param data - Podatki, ki jih želimo validirati
 * @param schema - Zod shema za validacijo odziva
 * @param context - Kontekst za logiranje (npr. 'POST /api/payments')
 * @returns Validirani podatki ali originalni podatki (v produkciji ob neuspehu)
 */
export function validateApiResponse<T>(
  data: unknown,
  schema: ZodSchema<T>,
  context: string
): T {
  const result = schema.safeParse(data)
  if (result.success) return result.data

  const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
  const message = `[Response Validation] ${context} — shema se ne ujema s podatki: ${issues}`

  if (process.env.NODE_ENV !== 'production') {
    // V development načinu vrži napako — razvijalec mora popraviti shemo ali podatke
    throw new Error(message)
  }

  // V produkciji samo logiraj — ne blokiraj delovanja
  logger.warn(context, message)
  return data as T
}

// ============================================
// OMEJITEV VELIKOSTI ZAHTEVKA
// ============================================

/** Privzeta maksimalna velikost JSON body-ja (1 MB) */
const DEFAULT_MAX_BODY_SIZE = 1024 * 1024

/**
 * Prebere in validira JSON body iz zahtevka z varnostnimi omejitvami:
 * 1. Omejitev velikosti body-ja (prepreči oversized payloads / DoS)
 * 2. Zod validacija strukture podatkov
 * 3. Samodejna sanatizacija stringov (XSS preprečevanje)
 *
 * @param req - Request objekt
 * @param schema - Zod shema za validacijo
 * @param options - Opcijske nastavitve
 * @returns Parsed in sanatized podatke ali napako
 */
export async function validateRequest<T>(
  req: Request,
  schema: ZodSchema<T>,
  options?: {
    maxBodySize?: number
    sanitize?: boolean
  }
): Promise<
  | { data: T; error: null }
  | { data: null; error: NextResponse }
> {
  const maxBodySize = options?.maxBodySize ?? DEFAULT_MAX_BODY_SIZE
  const shouldSanitize = options?.sanitize ?? true

  // 1. Preveri Content-Length header (hitra zavrnitev pred branjem bodyja)
  const contentLength = req.headers.get('content-length')
  if (contentLength) {
    const length = parseInt(contentLength, 10)
    if (!isNaN(length) && length > maxBodySize) {
      logger.warn('API', `Zahteva presega omejitev velikosti: ${length} > ${maxBodySize}`)
      return {
        data: null,
        error: NextResponse.json(
          { error: 'Zahteva je prevelika. Največja dovoljena velikost je 1 MB.' },
          { status: 413 }
        ),
      }
    }
  }

  // 2. Preberi body z omejitvijo branjem
  let bodyText: string
  try {
    const reader = req.body?.getReader()
    if (!reader) {
      return {
        data: null,
        error: NextResponse.json({ error: 'Prazen body' }, { status: 400 }),
      }
    }

    const chunks: Uint8Array[] = []
    let totalSize = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalSize += value.byteLength
      if (totalSize > maxBodySize) {
        reader.cancel().catch(() => {})
        logger.warn('API', `Body presega omejitev med branjem: ${totalSize} > ${maxBodySize}`)
        return {
          data: null,
          error: NextResponse.json(
            { error: 'Zahteva je prevelika. Največja dovoljena velikost je 1 MB.' },
            { status: 413 }
          ),
        }
      }
      chunks.push(value)
    }

    const combined = new Uint8Array(totalSize)
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.byteLength
    }
    bodyText = new TextDecoder().decode(combined)
  } catch {
    return {
      data: null,
      error: NextResponse.json({ error: 'Napaka pri branju zahtevka' }, { status: 400 }),
    }
  }

  // 3. Razčleni JSON
  let body: unknown
  try {
    body = JSON.parse(bodyText)
  } catch {
    return {
      data: null,
      error: NextResponse.json({ error: 'Neveljaven JSON format' }, { status: 400 }),
    }
  }

  // 4. Sanatiziraj stringe (XSS preprečevanje)
  if (shouldSanitize && typeof body === 'object' && body !== null) {
    body = sanitizeObject(body as Record<string, unknown>)
  }

  // 5. Validiraj z Zod shemo
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return {
      data: null,
      error: NextResponse.json(
        {
          error: 'Neveljavni podatki',
          validationErrors: parsed.error.issues.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      ),
    }
  }

  return { data: parsed.data, error: null }
}

// ============================================
// VARNOSTNO BRANJE JSON BODY-JA Z OMEJITVIJO
// ============================================

/**
 * Prebere JSON body iz zahtevka z omejitvijo velikosti (DoS zaščita),
 * nato ga sanatizira in vrne parsed objekt.
 *
 * Uporablja se kot nadomestek za `await req.json()` v API rutah,
 * ki nato pokličejo `validateBody()`. Tako dobimo enako zaščito
 * kot `validateRequest()`, vendar z ločenimi koraki za boljšo
 * prilagodljivost.
 *
 * @param req - Request objekt
 * @param options - Opcijske nastavitve
 * @returns Parsed in sanatiziran JSON objekt ali napako
 */
export async function parseJsonBody(
  req: Request,
  options?: {
    maxBodySize?: number
    sanitize?: boolean
  }
): Promise<
  | { data: unknown; error: null }
  | { data: null; error: NextResponse }
> {
  const maxBodySize = options?.maxBodySize ?? DEFAULT_MAX_BODY_SIZE
  const shouldSanitize = options?.sanitize ?? true

  // 1. Preveri Content-Length header (hitra zavrnitev pred branjem bodyja)
  const contentLength = req.headers.get('content-length')
  if (contentLength) {
    const length = parseInt(contentLength, 10)
    if (!isNaN(length) && length > maxBodySize) {
      logger.warn('API', `Zahteva presega omejitev velikosti: ${length} > ${maxBodySize}`)
      return {
        data: null,
        error: NextResponse.json(
          { error: 'Zahteva je prevelika. Največja dovoljena velikost je 1 MB.' },
          { status: 413 }
        ),
      }
    }
  }

  // 2. Preberi body z omejitvijo branjem
  let bodyText: string
  try {
    const reader = req.body?.getReader()
    if (!reader) {
      return {
        data: null,
        error: NextResponse.json({ error: 'Prazen body' }, { status: 400 }),
      }
    }

    const chunks: Uint8Array[] = []
    let totalSize = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalSize += value.byteLength
      if (totalSize > maxBodySize) {
        reader.cancel().catch(() => {})
        logger.warn('API', `Body presega omejitev med branjem: ${totalSize} > ${maxBodySize}`)
        return {
          data: null,
          error: NextResponse.json(
            { error: 'Zahteva je prevelika. Največja dovoljena velikost je 1 MB.' },
            { status: 413 }
          ),
        }
      }
      chunks.push(value)
    }

    const combined = new Uint8Array(totalSize)
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.byteLength
    }
    bodyText = new TextDecoder().decode(combined)
  } catch {
    return {
      data: null,
      error: NextResponse.json({ error: 'Napaka pri branju zahtevka' }, { status: 400 }),
    }
  }

  // 3. Razčleni JSON
  let body: unknown
  try {
    body = JSON.parse(bodyText)
  } catch {
    return {
      data: null,
      error: NextResponse.json({ error: 'Neveljaven JSON format' }, { status: 400 }),
    }
  }

  // 4. Sanatiziraj stringe (XSS preprečevanje)
  if (shouldSanitize && typeof body === 'object' && body !== null) {
    body = sanitizeObject(body as Record<string, unknown>)
  }

  return { data: body, error: null }
}

// ============================================
// KONSISTENTNO OBRAVNAVANJE NAPAK V API RUTAH
// ============================================

/**
 * Preveri, ali je napaka known business error (napaka iz poslovne logike)
 * in vrne ustrezen odgovor, če se ujema.
 *
 * Podpira tri vzorce poslovnih napak:
 * 1. Natančno ujemanje (npr. 'ALREADY_OPEN', 'SHIFT_NOT_FOUND')
 * 2. Predpona ujemanja z argumenti (npr. 'INSUFFICIENT_STOCK:Pizza:5kos')
 * 3. Podniz ujemanja (npr. sporočilo vsebuje 'ni najden')
 *
 * @param error - Ujeta napaka iz catch bloka
 * @param patterns - Seznam vzorcev za preverjanje
 * @returns NextResponse če se ujema, null če ni ujemanja
 */
export function matchBusinessError(
  error: unknown,
  patterns: Array<{
    /** Natančno ujemanje s error.message ali začetek error.message */
    match: string
    /** Slovensko sporočilo za uporabnika */
    message: string
    /** HTTP statusna koda */
    status?: number
    /** Ali naj ujema podniz namesto natančnega/predponnega ujemanja */
    substring?: boolean
    /** Dodatni podatki za odgovor (funkcija, ki dobi dele iz error.message) */
    extra?: (_parts: string[]) => Record<string, unknown>
  }>
): NextResponse | null {
  if (!(error instanceof Error)) return null

  for (const pattern of patterns) {
    if (pattern.substring) {
      // Podniz ujemanje (npr. includes('ni najden'))
      if (error.message.includes(pattern.match)) {
        return NextResponse.json(
          { error: pattern.message, ...(pattern.extra?.(error.message.split(':')) || {}) },
          { status: pattern.status ?? 400 }
        )
      }
    } else if (error.message === pattern.match) {
      // Natančno ujemanje
      return NextResponse.json(
        { error: pattern.message, ...(pattern.extra?.([]) || {}) },
        { status: pattern.status ?? 400 }
      )
    } else if (error.message.startsWith(pattern.match + ':')) {
      // Predpona ujemanja z argumenti
      const parts = error.message.split(':')
      return NextResponse.json(
        { error: pattern.message, ...(pattern.extra?.(parts) || {}) },
        { status: pattern.status ?? 400 }
      )
    }
  }

  return null
}

/**
 * Ustvari konsistenten napako odgovor z strukturiranim logiranjem.
 * Type-safe obravnava `error: unknown` z instanceof preverbo.
 *
 * @param error - Ujeta napaka iz catch bloka
 * @param context - Kontekst (npr. 'POST /api/orders')
 * @param userMessage - Sporočilo za uporabnika (privzeto slovensko)
 * @param statusCode - HTTP statusna koda (privzeto 500)
 * @returns NextResponse z JSON napako
 */
export function handleApiError(
  error: unknown,
  context: string,
  userMessage: string = 'Napaka na strežniku',
  statusCode: number = 500
): NextResponse {
  const message = error instanceof Error ? error.message : String(error)
  logger.error(context, userMessage, { error: message, stack: error instanceof Error ? error.stack : undefined })

  // V produkciji ne razkrivamo internih podrobnosti napake
  const isDev = process.env.NODE_ENV !== 'production'
  return NextResponse.json(
    {
      error: isDev ? message : userMessage,
      ...(isDev && error instanceof Error && { detail: error.stack?.split('\n').slice(0, 3).join('\n') }),
    },
    { status: statusCode }
  )
}

/**
 * Prilagojena verzija handleApiError, ki za znane poslovne napake
 * (error instanceof Error z znanim message) vrne ustrezen status,
 * za nepoznane pa 500 s skritim sporočilom v produkciji.
 *
 * Primerno za catch bloke, kjer želite ločiti poslovne napake od
 * sistemskih, brez ročnega pisanja instanceof verig.
 *
 * @param error - Ujeta napaka iz catch bloka
 * @param context - Kontekst (npr. 'POST /api/cash-register')
 * @param businessPatterns - Vzorci poslovnih napak za matchBusinessError
 * @param fallbackMessage - Slovensko sporočilo za neznane napake
 * @returns NextResponse z JSON napako
 */
export function handleRouteError(
  error: unknown,
  context: string,
  businessPatterns: Parameters<typeof matchBusinessError>[1],
  fallbackMessage: string = 'Napaka na strežniku'
): NextResponse {
  // Najprej preveri poslovne napake
  const businessResponse = matchBusinessError(error, businessPatterns)
  if (businessResponse) return businessResponse

  // Za neznane napake uporabi handleApiError
  return handleApiError(error, context, fallbackMessage)
}

/**
 * Enostavnejša različica za primere, ko želimo samo
 * prebrati in validirati JSON brez omejitve velikosti
 * (za zaupane notranje API klice).
 *
 * OPOMBA: Za nove rute priporočamo uporabo parseJsonBody() + validateBody()
 * namesto req.json() + validateBody(), da se zagotovi omejitev velikosti.
 */
export function validateBody<T>(
  schema: ZodSchema<T>,
  body: unknown,
  options?: { sanitize?: boolean }
):
  | { data: T; error: null }
  | { data: null; error: NextResponse }
{
  const shouldSanitize = options?.sanitize ?? true

  // Sanatiziraj stringe
  let processedBody = body
  if (shouldSanitize && typeof body === 'object' && body !== null) {
    processedBody = sanitizeObject(body as Record<string, unknown>)
  }

  const parsed = schema.safeParse(processedBody)
  if (!parsed.success) {
    return {
      data: null,
      error: NextResponse.json(
        {
          error: 'Neveljavni podatki',
          validationErrors: parsed.error.issues.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      ),
    }
  }

  return { data: parsed.data, error: null }
}
