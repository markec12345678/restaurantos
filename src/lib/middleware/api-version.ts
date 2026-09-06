// ============================================
// API VERSIONING — Header-based versioning
// ============================================
// Strategija:
//   - Header-based: X-API-Version: 1 (default)
//   - Ne URL-based (/v1/, /v2/) — preveč breaking changes za kliente
//   - Backward compat: če header manjka, assume version 1
//
// Klient lahko pošlje:
//   X-API-Version: 1 → trenutna API obnašanja
//   X-API-Version: 2 → future version z breaking changes
//
// Response vedno vsebuje:
//   X-API-Version: <actual-version> (na vseh response-ih)
//   Deprecation: true (samo če je deprecated)
//   Sunset: <date> (samo če je deprecated z known removal date)
//
// FIX P9 (audit 2026-09-06): Prej ni bilo versioning strategije — breaking
// changes bi zlomili vse kliente. Sedaj lahko uvedemo v2 z deprecation period.
// ============================================

import { NextResponse } from 'next/server'

export const CURRENT_API_VERSION = 1
export const SUPPORTED_API_VERSIONS = [1] as const
export const DEPRECATED_API_VERSIONS: number[] = [] // trenutno ni deprecated

/**
 * Preberi X-API-Version iz request headerja.
 * Če manjka, assume CURRENT_API_VERSION (backward compat).
 */
export function getApiVersion(req: Request): number {
  const header = req.headers.get('x-api-version')
  if (!header) return CURRENT_API_VERSION
  const version = parseInt(header, 10)
  if (Number.isNaN(version)) return CURRENT_API_VERSION
  return version
}

/**
 * Preveri ali je verzija podprta.
 */
export function isVersionSupported(version: number): boolean {
  return (SUPPORTED_API_VERSIONS as readonly number[]).includes(version)
}

/**
 * Preveri ali je verzija deprecated.
 */
export function isVersionDeprecated(version: number): boolean {
  return DEPRECATED_API_VERSIONS.includes(version)
}

/**
 * Dodaj API versioning headers na response.
 * Klici na VSAKEM API endpointu (lahko preko middleware-ja ali eksplicitno).
 *
 * @example
 * ```ts
 * import { withApiVersion } from '@/lib/middleware/api-version'
 *
 * export async function GET(req: Request) {
 *   const version = getApiVersion(req)
 *   if (!isVersionSupported(version)) {
 *     return NextResponse.json({ error: 'Unsupported API version' }, { status: 400 })
 *   }
 *   return withApiVersion(req, NextResponse.json({ data: '...' }))
 * }
 * ```
 */
export function withApiVersion<T extends NextResponse>(
  req: Request,
  response: T
): T {
  const version = getApiVersion(req)
  response.headers.set('X-API-Version', String(version))

  if (isVersionDeprecated(version)) {
    response.headers.set('Deprecation', 'true')
    response.headers.set('Sunset', '2026-12-31') // 1 leto deprecation period
    response.headers.set(
      'Link',
      '</api/docs/migration-guide>; rel="deprecation"'
    )
  }

  return response
}

/**
 * Preveri verzijo in vrni 400 če ni podprta.
 * Uporabi na začetku vsakega API handlerja.
 *
 * @example
 * ```ts
 * export async function GET(req: Request) {
 *   const versionCheck = checkApiVersion(req)
 *   if (versionCheck) return versionCheck
 *   // ... normal handler logic
 * }
 * ```
 */
export function checkApiVersion(req: Request): NextResponse | null {
  const version = getApiVersion(req)
  if (!isVersionSupported(version)) {
    return NextResponse.json(
      {
        error: `API version ${version} is not supported`,
        supportedVersions: SUPPORTED_API_VERSIONS,
        currentVersion: CURRENT_API_VERSION,
      },
      { status: 400, headers: { 'X-API-Version': String(version) } }
    )
  }
  return null
}
