// ============================================
// CSRF ZAŠČITA — Pomožne funkcije za preverjanje
// ============================================
//
// NOTE (audit finding): `verifyCsrf()` je definiran spodaj, a nikoli klican
// v middleware-u ali posameznih API rutah. Aplikacija uporablja Bearer-token
// avtentikacijo (ne cookie-based), kar pomeni, da klasične CSRF napade
// izvedljene iz brskalnika napadalec ne more izkoristiti — bearer token
// ne more biti prisilno poslan iz cross-origin forme.
//
// Dve opciji za prihodnost:
//   1. Če se bo aplikacija kdaj preselila na cookie-based auth — implementirati
//      `verifyCsrf()` v middleware (src/middleware.ts) za vse POST/PUT/DELETE.
//   2. Drugače — izbrisati to kodo, da ne ustvarja false sense of security.
//
// Zaenkrat pustimo kot dokumentirano mrtvo kodo z jasno oznako.
// ============================================

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { logger } from './logger'

// CSRF token cookie ime
const CSRF_COOKIE_NAME = 'restaurantos-csrf'
const CSRF_HEADER_NAME = 'x-csrf-token'

// Dovoljene domene za Origin/Referer preverjanje
export function getAllowedOrigins(): string[] {
  const origins = ['http://localhost:3000']

  // Dodaj NEXT_PUBLIC_APP_URL iz okoljskih spremenljivk
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    origins.push(appUrl)
    // Dodaj tudi brez poti
    try {
      const url = new URL(appUrl)
      origins.push(url.origin)
    } catch {
      // Neveljaven URL — ignoriraj
    }
  }

  return [...new Set(origins)]
}

/**
 * Preveri CSRF zaščito za mutirajoče zahtevke (POST, PUT, DELETE, PATCH)
 *
 * Strategija dvojne predložitve:
 * 1. Preveri Origin/Referer glavo — prepreči cross-origin zahtevke
 * 2. Preveri ujemanje cookie-ja in glave — prepreči CSRF z ukradenimi piškotki
 *
 * @returns null če je preverjanje uspešno, NextResponse z napako če ni
 */
export function verifyCsrf(request: Request): NextResponse | null {
  const method = request.method.toUpperCase()

  // CSRF velja samo za mutirajoče metode
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return null
  }

  // ── KORAK 1: Origin/Referer preverjanje ──
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const allowedOrigins = getAllowedOrigins()

  // Za API klice brez brskalnika (npr. curl, Postman) — dovoli če ni Origin/Referer
  // To je varno, ker CSRF napade izvajajo brskalniki, ki VEDNO pošljejo Origin
  if (origin || referer) {
    let requestOrigin = ''
    if (origin) {
      requestOrigin = origin
    } else if (referer) {
      try {
        requestOrigin = new URL(referer).origin
      } catch {
        // Neveljaven Referer — zavrnemo
        logger.warn('CSRF', `Neveljaven Referer: ${referer}`)
        return NextResponse.json(
          { error: 'CSRF preverjanje je spodletelo — neveljaven Referer' },
          { status: 403 }
        )
      }
    }

    if (!allowedOrigins.includes(requestOrigin)) {
      logger.warn('CSRF', `Zavrnjen Origin: ${requestOrigin} (dovoljeni: ${allowedOrigins.join(', ')})`)
      return NextResponse.json(
        { error: 'CSRF preverjanje je spodletelo — napačen Origin' },
        { status: 403 }
      )
    }
  }

  // ── KORAK 2: Double Submit Cookie preverjanje ──
  const cookieHeader = request.headers.get('cookie') || ''
  const cookieToken = cookieHeader
    .split('; ')
    .find(row => row.startsWith(`${CSRF_COOKIE_NAME}=`))
    ?.split('=')[1]
  const headerToken = request.headers.get(CSRF_HEADER_NAME)

  if (cookieToken && headerToken) {
    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(cookieToken, 'hex'),
        Buffer.from(headerToken, 'hex')
      )
      if (!isValid) {
        logger.warn('CSRF', 'CSRF token se ne ujema med cookie in glavo')
        return NextResponse.json(
          { error: 'CSRF preverjanje je spodletelo — token se ne ujema' },
          { status: 403 }
        )
      }
    } catch {
      logger.warn('CSRF', 'Neveljaven CSRF token format')
      return NextResponse.json(
        { error: 'CSRF preverjanje je spodletelo — neveljaven token' },
        { status: 403 }
      )
    }
  }

  return null // Preverjanje uspešno
}

/**
 * Pridobi CSRF token iz cookie-ja za pošiljanje v glavi
 * Uporabno v frontend klicih
 */
export function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null

  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${CSRF_COOKIE_NAME}=`))

  return match ? match.split('=')[1] : null
}

/**
 * Pridobi ime glave za CSRF token — za uporabo v fetch klicih
 */
export const CSRF_HEADER = CSRF_HEADER_NAME
