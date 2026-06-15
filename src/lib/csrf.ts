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

// CSRF token cookie ime
const CSRF_COOKIE_NAME = 'restaurantos-csrf'
const CSRF_TOKEN_LENGTH = 32

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

// Re-export helpers from csrf-utils for backward compatibility
export { verifyCsrf, getCsrfTokenFromCookie, CSRF_HEADER, getAllowedOrigins } from './csrf-utils'
