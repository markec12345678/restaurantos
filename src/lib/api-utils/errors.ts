// ============================================
// KONSISTENTNO OBRAVNAVANJE NAPAK V API RUTAH
// ============================================

import { NextResponse } from 'next/server'
import { logger } from '../logger'

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
