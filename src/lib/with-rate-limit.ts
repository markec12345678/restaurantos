// ============================================
// WITHRATELIMIT — VIŠJE-REDNA FUNKCIJA ZA OMEJEVANJE HITROSTI
// Omogoča preprosto dodajanje rate limitinga kateremukoli API route handlerju
// ============================================

import { NextResponse } from 'next/server'
import { checkRateLimitAsync, getClientIp, RateLimitConfig, AUTHENTICATED_LIMIT } from './rate-limit'
import { logger } from './logger'

/** Tip za Next.js API route handler */
type HandlerFn = (_req: Request, _ctx?: unknown) => Promise<NextResponse> | Promise<Response>

/** Možnosti za withRateLimit HOF */
interface WithRateLimitOptions {
  /** Ključ shrambe (privzeto: samodejno generiran iz URL poti) */
  storeKey?: string
  /** Konfiguracija omejitve (privzeto: AUTHENTICATED_LIMIT) */
  limit?: RateLimitConfig
}

/**
 * Višje-redna funkcija (HOF), ki doda omejevanje hitrosti API route handlerjem.
 *
 * Samodejno preveri rate limit pred izvajanjem handlerja in vrne 429 odgovor
 * z ustreznimi glavami, kadar je omejitev presežena. Uspešnim odgovorom doda
 * glave X-RateLimit-Remaining in X-RateLimit-Reset.
 *
 * @param handler - Izvirni API route handler
 * @param options - Možnosti za prilagajanje obnašanja rate limitinga
 * @returns Oviti handler z vgrajenim rate limitingom
 *
 * @example
 * // Enostavna uporaba s privzetimi nastavitvami (AUTHENTICATED_LIMIT)
 * export const POST = withRateLimit(async (req) => { ... })
 *
 * @example
 * // Uporaba s custom konfiguracijo
 * export const GET = withRateLimit(async (req) => { ... }, { limit: GENERAL_PUBLIC_LIMIT })
 *
 * @example
 * // Uporaba s custom ključem shrambe
 * export const POST = withRateLimit(async (req) => { ... }, { storeKey: 'moj-kljuc' })
 */
export function withRateLimit(handler: HandlerFn, options?: WithRateLimitOptions): HandlerFn {
  const limit = options?.limit ?? AUTHENTICATED_LIMIT

  return async (req: Request, ctx?: unknown) => {
    // Generiraj ključ shrambe iz URL poti, če ni podan
    const url = new URL(req.url)
    const storeKey = options?.storeKey ?? `api:${url.pathname}`

    const clientIp = getClientIp(req)
    const result = await checkRateLimitAsync(storeKey, clientIp, limit)

    if (!result.allowed) {
      // Rate limit presežen — vrni 429 z ustreznimi glavami
      const retryAfter = Math.ceil((result.retryAfterMs ?? 60000) / 1000)
      logger.warn('RateLimit', `Rate limited: ${storeKey} from ${clientIp.slice(0, 20)}`)
      return NextResponse.json(
        { error: 'Preveč zahtev. Poskusite znova čez nekaj časa.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + retryAfter),
          },
        }
      )
    }

    // Pokliči izvirni handler
    const response = await handler(req, ctx)

    // Dodaj glave rate limitinga k uspešnim odgovorom
    if (response instanceof NextResponse || response instanceof Response) {
      const headers = new Headers(response.headers)
      headers.set('X-RateLimit-Remaining', String(result.remaining ?? 0))
      // Kloniraj odgovor z novimi glavami
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    }

    return response
  }
}

/**
 * Ustvari rate-limited route objekt za Next.js App Router.
 * Podpira metode GET, POST, PUT, PATCH in DELETE.
 *
 * Vsaka metoda se samodejno ovije z withRateLimit HOF. Po želji lahko
 * nastavite različne limite za posamezno HTTP metodo ali skupen ključ shrambe.
 *
 * @param handlers - Objekt z handlerji za posamezne HTTP metode in opcijami
 * @returns Objekt z ovitimi handlerji, pripravljen za export iz route.ts
 *
 * @example
 * // V src/app/api/my-route/route.ts:
 * export const { GET, POST } = createRateLimitedRoute({
 *   GET: async (req) => { ... },
 *   POST: async (req) => { ... },
 *   limits: { POST: SEED_LIMIT }  // Opcija: limiti po metodi
 * })
 */
export function createRateLimitedRoute(handlers: {
  GET?: HandlerFn
  POST?: HandlerFn
  PUT?: HandlerFn
  PATCH?: HandlerFn
  DELETE?: HandlerFn
  limits?: Partial<Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', RateLimitConfig>>
  storeKey?: string
}) {
  const result: Record<string, HandlerFn> = {}
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

  for (const method of methods) {
    const handler = handlers[method]
    if (handler) {
      const limit = handlers.limits?.[method] ?? AUTHENTICATED_LIMIT
      result[method] = withRateLimit(handler, {
        storeKey: handlers.storeKey,
        limit,
      })
    }
  }

  return result
}
