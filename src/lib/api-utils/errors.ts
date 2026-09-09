// ============================================
// KONSISTENTNO OBRAVNAVANJE NAPAK V API RUTAH
// ============================================
//
// P1-17 (error handling specifikacija):
//   - Ne vračaj: stack trace, SQL napak, secrets, internih pathov,
//     provider responseov. V produkciji klient dobi samo generično
//     sporočilo + error code + requestId.
//   - Standardiziran format: { error: message, code, requestId }
//     (polje `error` ostane STRING zaradi nazaj kompatibilnosti z
//     obstoječimi klienti, ki berejo `data.error`; `code` in
//     `requestId` sta nova strukturirana polja.)
//   - Log: requestId, route (context), status code, error code,
//     user ID, location ID, latency (prek `meta`), sporočilo napake.
//   - Ne logiraj: PIN-a, tokenov, kartic, certifikatov, connection
//     stringov (žetje ni v meta nikoli vključen — rute pošiljajo samo
//     ID-je).

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { logger, generateRequestId } from '../logger'
import { METRICS, incCounter } from '../observability/metrics'

// FIX P3 (audit 2026-09-06): Lazy-load Sentry da ne crash-a če @sentry/nextjs
// ni nameščen ali če SENTRY_DSN ni nastavljen. V production z SENTRY_DSN
// se napake avtomatsko pošiljajo v Sentry.
let sentryCaptureAvailable = false
let sentryCapture: ((_err: unknown) => void) | null = null
try {
  // Dynamic require — deluje samo če je @sentry/nextjs nameščen
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sentry = require('@sentry/nextjs')
  if (typeof Sentry.captureException === 'function') {
    sentryCapture = Sentry.captureException
    sentryCaptureAvailable = true
  }
} catch {
  // @sentry/nextjs ni nameščen — Sentry integracija onemogočena
}

/**
 * Standardni error kodi (P1-17). `error.message` v telesu ostane
 * slovensko uporabniško sporočilo; `code` je strojni identifikator,
//   ki ga klient/frontend lahko programsko razrešuje.
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_PARAMETER: 'INVALID_PARAMETER',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

/** Strukturiran meta podatek za logiranje (P1-17 zahteva). */
export interface ErrorLogMeta {
  /** Zaposleni, ki je sprožil zahtevek (nikoli žeton/PIN!) */
  userId?: string | null
  /** Lokacija seje (multi-tenant kontekst) */
  locationId?: string | null
  /** Latencija obdelave zahtevka v ms */
  latencyMs?: number
}

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
 * P1-17 izboljšave:
 *   1. ZodError → 400 VALIDATION_ERROR s seznamom polj (prej 500 "Napaka
 *      na strežniku" — rute, ki kličejo `schema.parse(body)` brez
 *      validateRequest, so validacijske napake vračale kot 500!)
 *   2. requestId: generiran, zapisan v log + telesu + X-Request-Id header
 *      (podpora prijavam napak z navedbo zahtevka)
 *   3. code: strojno berljiv klic (VALIDATION_ERROR / INTERNAL_ERROR)
 *   4. Strukturiran log: requestId, statusCode, errorCode, meta
 *      (userId/locationId/latencyMs) — ne samo sporočilo.
 *
 * @param error - Ujeta napaka iz catch bloka
 * @param context - Kontekst (npr. 'POST /api/orders')
 * @param userMessage - Sporočilo za uporabnika (privzeto slovensko)
 * @param statusCode - HTTP statusna koda (privzeto 500)
 * @param meta - P1-17 log kontekst (userId, locationId, latencyMs)
 * @returns NextResponse z JSON napako
 */
export function handleApiError(
  error: unknown,
  context: string,
  userMessage: string = 'Napaka na strežniku',
  statusCode: number = 500,
  meta?: ErrorLogMeta
): NextResponse {
  const requestId = generateRequestId()
  const isDev = process.env.NODE_ENV !== 'production'

  // ── P1-17: ZodError = validacijska napaka klienta → 400, ne 500 ──
  // Rute, ki uporabljajo `schema.parse(await req.json())`, vržejo ZodError
  // v ta catch — prej je klient dobil 500 "Napaka na strežniku".
  if (error instanceof ZodError) {
    const validationErrors = error.issues.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }))
    logger.warn(context, 'VALIDATION_ERROR', {
      requestId,
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR,
      ...meta,
      validationErrors,
    })
    return NextResponse.json(
      {
        error: 'Neveljavni podatki',
        code: ERROR_CODES.VALIDATION_ERROR,
        requestId,
        validationErrors,
      },
      { status: 400, headers: { 'X-Request-Id': requestId } }
    )
  }

  // ── P1-21: PrismaClientValidationError = neveljaven parameter (npr. malformed
  // UUID v /api/orders/[id]) → 400 INVALID_PARAMETER, ne 500 INTERNAL_ERROR.
  // Rute ne validirajo path parametrov z Zodom — Prisma vrže validacijsko
  // napako, ko UUID/količina ne ustreza shemi. To je napaka VENDA (client
  // poslje smeti), zato spada v 4xx + ne sme razkriti SQL notranjosti.
  if (error instanceof Prisma.PrismaClientValidationError) {
    logger.warn(context, 'INVALID_PARAMETER', {
      requestId,
      statusCode: 400,
      errorCode: ERROR_CODES.INVALID_PARAMETER,
      ...meta,
      // Samo klassa napake — Prisma validation message lahko vsebuje
      // notranje podrobnosti sheme, zato klientu ne vračamo message.
      prismaValidation: true,
    })
    return NextResponse.json(
      {
        error: 'Neveljaven parameter zahtevka (npr. neveljaven ID)',
        code: ERROR_CODES.INVALID_PARAMETER,
        requestId,
      },
      { status: 400, headers: { 'X-Request-Id': requestId } }
    )
  }

  const message = error instanceof Error ? error.message : String(error)
  // P1-17: strukturiran log — requestId + route + status + koda + meta.
  // `message` zapišemo le interno (stack sledi internal error trackingu).
  logger.error(context, 'API_ERROR', {
    requestId,
    statusCode,
    errorCode: ERROR_CODES.INTERNAL_ERROR,
    ...meta,
    error: message,
    stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5).join('\n') : undefined,
  })

  // P1-observability: števec 5xx z okenskimi dogodki (alert "spike 500").
  // 4xx so klientove napake — šteto ločeno, brez event bufferja.
  if (statusCode >= 500) {
    incCounter(METRICS.HTTP_5XX, 1, true)
  } else if (statusCode >= 400) {
    incCounter(METRICS.HTTP_4XX)
  }

  // FIX P3 (audit 2026-09-06): Pošlji napako v Sentry za production error tracking.
  // Samo za 5xx napake (4xx so client errors — ne rabimo Sentry-ja).
  // Business errors (4xx) se ne pošiljajo — to bi ustvarilo prevelik volumen.
  if (sentryCaptureAvailable && sentryCapture && statusCode >= 500) {
    try {
      sentryCapture(error)
    } catch {
      // Sentry capture failed — ne pustimo da vpliva na response
    }
  }

  // V produkciji ne razkrivamo internih podrobnosti napake
  // (stack/SQL/secrets se klientu NE vračajo — samo v dev se prikaže
  // prvih 5 vrstic stack-a za lažje debugiranje lokalno)
  return NextResponse.json(
    {
      error: isDev ? message : userMessage,
      code: ERROR_CODES.INTERNAL_ERROR,
      requestId,
      ...(isDev && error instanceof Error && { detail: error.stack?.split('\n').slice(0, 5).join('\n') }),
    },
    { status: statusCode, headers: { 'X-Request-Id': requestId } }
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
 * @param meta - P1-17 log kontekst (userId, locationId, latencyMs)
 * @returns NextResponse z JSON napako
 */
export function handleRouteError(
  error: unknown,
  context: string,
  businessPatterns: Parameters<typeof matchBusinessError>[1],
  fallbackMessage: string = 'Napaka na strežniku',
  meta?: ErrorLogMeta
): NextResponse {
  // ZodError naj PREJ izstopa kot 400 (validacija) — business patterni
  // se nanašajo na domenske Error()
  if (error instanceof ZodError) {
    return handleApiError(error, context, 'Neveljavni podatki', 400, meta)
  }

  // Najprej preveri poslovne napake
  const businessResponse = matchBusinessError(error, businessPatterns)
  if (businessResponse) return businessResponse

  // Za neznane napake uporabi handleApiError
  return handleApiError(error, context, fallbackMessage, 500, meta)
}
