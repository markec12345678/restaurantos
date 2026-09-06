// ============================================
// CACHING HELPER — Cache-Control headers za API responses
// ============================================
// Zagotavlja konsistentno caching strategijo za GET endpointe:
//   - Public read endpoints (menu, tables): 5min cache, 1h stale-while-revalidate
//   - Private authenticated endpoints (orders, employees): private, no-cache
//   - Real-time endpoints (KDS, dashboard): no-store
//   - Static assets (QR codes): 24h cache
//
// FIX P9 (audit 2026-09-06): Prej vsi GET endpointi niso imeli Cache-Control
// headerjev — vsak request je šel direktno v DB. Sedaj se pogosti read-only
// podatki (menu, tables, categories) cachirajo na CDN/edge nivoju.
// ============================================

import { NextResponse } from 'next/server'

/**
 * Cache presets za različne tipe API endpointov.
 */
export const CachePresets = {
  /** Public read-only data (menu, categories) — 5min cache + 1h stale */
  PUBLIC_SHORT: 'public, max-age=300, stale-while-revalidate=3600',

  /** Public read-only data (menu items with images) — 1h cache + 24h stale */
  PUBLIC_LONG: 'public, max-age=3600, stale-while-revalidate=86400',

  /** Static assets (QR codes, generated images) — 24h cache */
  STATIC: 'public, max-age=86400, immutable',

  /** Authenticated user data (orders, employees) — private, no intermediate cache */
  PRIVATE_NO_CACHE: 'private, no-cache, no-store, must-revalidate',

  /** Real-time data (KDS, dashboard, live orders) — never cache */
  REALTIME: 'no-store, no-cache, must-revalidate, proxy-revalidate',

  /** Sensitive data (auth tokens, payments) — never cache */
  SENSITIVE: 'no-store, private, max-age=0',
} as const

/**
 * Dodaj Cache-Control header na NextResponse.
 *
 * @param response - NextResponse objekt
 * @param preset - Cache preset iz CachePresets
 * @returns NextResponse z dodanim Cache-Control headerjem
 *
 * @example
 * ```ts
 * import { withCache, CachePresets } from '@/lib/middleware/cache-headers'
 *
 * export async function GET() {
 *   const menu = await db.menuItem.findMany(...)
 *   return withCache(NextResponse.json(menu), CachePresets.PUBLIC_SHORT)
 * }
 * ```
 */
export function withCache<T extends NextResponse>(
  response: T,
  preset: typeof CachePresets[keyof typeof CachePresets]
): T {
  response.headers.set('Cache-Control', preset)
  return response
}

/**
 * Generiraj ETag iz response body-ja.
 * ETag omogoča clientu, da pošlje If-None-Match header in dobi 304 (Not Modified)
 * če se podatki niso spremenili — prihranek bandwidth-a.
 *
 * @param body - Response body (objekt ali string)
 * @returns ETag vrednost (quoted hash)
 */
export function generateETag(body: unknown): string {
  const str = typeof body === 'string' ? body : JSON.stringify(body)
  // FNV-1a hash — hiter in dovolj za ETag (ni kriptografski)
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `"${(hash >>> 0).toString(16)}"`

}

/**
 * Preveri če client ima veljaven ETag (If-None-Match header).
 * Če da, vrni 304 Not Modified (brez body-ja).
 *
 * @param req - Request objekt
 * @param etag - Trenutni ETag
 * @returns True če client ima ujemajoč ETag (pošlji 304)
 */
export function checkETagMatch(req: Request, etag: string): boolean {
  const ifNoneMatch = req.headers.get('if-none-match')
  if (!ifNoneMatch) return false
  // ETags can be comma-separated, with optional *
  if (ifNoneMatch === '*') return true
  return ifNoneMatch.split(',').map(t => t.trim()).includes(etag)
}

/**
 * Dodaj ETag na response in preveri If-None-Match.
 * Če se ETag ujema, vrni 304 (Not Modified) brez body-ja.
 *
 * @example
 * ```ts
 * export async function GET(req: Request) {
 *   const data = await db.menuItem.findMany(...)
 *   return withETag(req, NextResponse.json(data))
 * }
 * ```
 */
export function withETag(req: Request, response: NextResponse, body: unknown): NextResponse {
  const etag = generateETag(body)
  response.headers.set('ETag', etag)

  if (checkETagMatch(req, etag)) {
    // 304 Not Modified — client has latest version
    return new NextResponse(null, {
      status: 304,
      headers: response.headers,
    })
  }

  return response
}
