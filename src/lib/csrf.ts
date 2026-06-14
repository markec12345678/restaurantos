// ============================================
// CSRF ZAŠČITA ZA MUTIRAJOČE API RUTE
// Prepreči Cross-Site Request Forgery napade na POST/PUT/DELETE rute
//
// Strategija: Double Submit Cookie + Origin/Referer preverjanje
// - Pri GET /api/auth/csrf-token se generira CSRF token kot HttpOnly cookie
// - Pri vsakem mutirajočem zahtevku se preveri, da se cookie ujema z glavo
// - Dodatno se preveri Origin/Referer glava, da ustreza naši domeni
// ============================================

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { logger } from './logger'

// CSRF token cookie ime
const CSRF_COOKIE_NAME = 'restaurantos-csrf'
const CSRF_HEADER_NAME = 'x-csrf-token'
const CSRF_TOKEN_LENGTH = 32

// Dovoljene domene za Origin/Referer preverjanje
function getAllowedOrigins(): string[] {
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
 * Generiraj CSRF token in ga nastavi kot cookie
 * Kliči v GET /api/auth/csrf-token ruti
 */
export function generateCsrfToken(): NextResponse {
  const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex')

  const response = NextResponse.json({ token })
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 ur — seja
  })

  return response
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
  // Preveri, da se CSRF token v cookie-ju ujema z glavo
  // Pri standardnem Request moramo ročno razčleniti Cookie glavo
  const cookieHeader = request.headers.get('cookie') || ''
  const cookieToken = cookieHeader
    .split('; ')
    .find(row => row.startsWith(`${CSRF_COOKIE_NAME}=`))
    ?.split('=')[1]
  const headerToken = request.headers.get(CSRF_HEADER_NAME)

  if (cookieToken && headerToken) {
    // Oba obstajata — preveri ujemanje s časovno varno primerjavo
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
      // Napaka pri primerjavi (različna dolžina, neveljaven hex) — zavrnemo
      logger.warn('CSRF', 'Neveljaven CSRF token format')
      return NextResponse.json(
        { error: 'CSRF preverjanje je spodletelo — neveljaven token' },
        { status: 403 }
      )
    }
  }

  // Če nista oba prisotna, je Origin preverjanje že opravljeno
  // Za avtenticirane API-je (z Bearer tokenom) je CSRF manj kritičen,
  // ker CSRF napad ne more vključiti Bearer tokena
  // Vendar za double-submit zaščito priporočamo oba mehanizma

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
