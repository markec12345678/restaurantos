// ============================================
// MIDDLEWARE FUNKCIJE — requireAuth + optionalAuth
// Glavni vstopni točki za zaščito API rut
// ============================================

import { NextResponse } from 'next/server'

import type { Session, Permission } from './types'
import { SESSION_TTL_MS } from './constants'
import { verifyToken } from './session-store'
import { syncSessionToWs } from './session-store'
import { db } from '../db'
import { isPublicRoute, getRequiredPermissions, hasPermission } from './permissions'

/**
 * Pridobi Bearer token iz Authorization glave
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  if (!authHeader.startsWith('Bearer ')) return null
  return authHeader.substring(7).trim()
}

/**
 * GLAVNA MIDDLEWARE FUNKCIJA
 * Uporaba v API rutah:
 *
 *   const authResult = await requireAuth(req)
 *   if (authResult.error) return authResult.error
 *   const session = authResult.session!
 */
export async function requireAuth(
  req: Request,
  options?: { permission?: Permission | Permission[] }
): Promise<{ session: Session | null; error: NextResponse | null }> {
  const { pathname } = new URL(req.url)

  // GET zahteve na javnih rutah so dovoljene brez avtentikacije
  if (req.method === 'GET' && isPublicRoute(pathname)) {
    return { session: null, error: null }
  }

  const token = extractBearerToken(req)

  if (!token) {
    return {
      session: null,
      error: NextResponse.json(
        { error: 'Avtentikacija je obvezna. Pošljite Authorization: Bearer <token>' },
        { status: 401 }
      ),
    }
  }

  const session = await verifyToken(token)

  if (!session) {
    return {
      session: null,
      error: NextResponse.json(
        { error: 'Neveljaven ali potekel žeton. Prosimo, prijavite se ponovno.' },
        { status: 401 }
      ),
    }
  }

  // Preveri dovoljenja
  const requiredPerms = options?.permission
    ? Array.isArray(options.permission) ? options.permission : [options.permission]
    : getRequiredPermissions(pathname)

  if (!hasPermission(session, requiredPerms)) {
    return {
      session: null,
      error: NextResponse.json(
        { error: 'Nimate dovoljenja za to operacijo.' },
        { status: 403 }
      ),
    }
  }

  // Podaljšaj sejo ob aktivnosti (ne preseži absoluteExpiry)
  // FIX MEDIUM: Sinhroniziraj podaljšano sejo tudi v SQLite + WS store
  session.expiresAt = Math.min(Date.now() + SESSION_TTL_MS, session.absoluteExpiry)

  // Persistiraj podaljšano sejo v SQLite
  db.session.updateMany({
    where: { token },
    data: { expiresAt: session.expiresAt },
  }).catch(() => {})

  // Sinhroniziraj z WS session store
  syncSessionToWs(token, session)

  return { session, error: null }
}

/**
 * Izbirna avtentikacija — ne vrne napake, če ni tokena
 * Uporabno za rute, ki delujejo drugače za avtenticirane uporabnike
 */
export async function optionalAuth(
  req: Request
): Promise<{ session: Session | null }> {
  const token = extractBearerToken(req)
  if (!token) return { session: null }
  const session = await verifyToken(token)
  return { session }
}
