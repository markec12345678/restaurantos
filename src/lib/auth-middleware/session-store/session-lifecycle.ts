// ============================================
// SESSION LIFECYCLE — Ustvarjanje, preverjanje, uničenje sej
// ============================================

import crypto from 'crypto'
import { db } from '../../db'
import { logger } from '../../logger'
import type { Session } from '../types'
import { SESSION_TTL_MS } from '../constants'
import { sessions, syncSessionToWs, loadSessionsFromDb } from './session-cache'

// FIX SECURITY: Cache za status zaposlenega — prepreči DA je terminiran zaposleni
// še vedno lahko dostopa do API-jev do poteka seje (do 8h!).
// Cache je 60s — če admin terminira zaposlenega, bo seja prenehala veljati v 60s.
const employeeStatusCache = new Map<string, { status: string; checkedAt: number }>()
const EMPLOYEE_STATUS_CACHE_TTL_MS = 60 * 1000 // 60 sekund

/**
 * Ustvari novo sejo po uspešni prijavi
 */
export async function createSession(employee: {
  id: string
  role: string
  permissions: string[]
}, ipAddress?: string, userAgent?: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const now = Date.now()

  const session: Session = {
    token,
    employeeId: employee.id,
    role: employee.role,
    permissions: employee.permissions,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    absoluteExpiry: now + 24 * 60 * 60 * 1000,
  }

  sessions.set(token, session)

  // Sinhroniziraj z WS session store
  syncSessionToWs(token, session)

  // FIX VERCEL: AWAIT DB write — na serverless moramo počakati da seja pride v DB
  // Prej je bilo non-blocking (.catch()), a Vercel serverless ubije funkcijo preden se write konča
  try {
    await db.session.create({
      data: {
        token,
        employeeId: employee.id,
        role: employee.role,
        permissions: JSON.stringify(employee.permissions),
        createdAt: BigInt(now),
        expiresAt: BigInt(now + SESSION_TTL_MS),
        absoluteExpiry: BigInt(now + 24 * 60 * 60 * 1000),
        ipAddress: ipAddress || '',
        userAgent: userAgent || '',
      },
    })
  } catch (err: unknown) {
    logger.warn('AUTH', 'Napaka pri shranjevanju seje v DB:', err instanceof Error ? err.message : String(err))
  }

  return token
}

/**
 * Preveri veljavnost tokena in vrne sejo
 *
 * FIX SECURITY: preverja tudi ali je zaposleni še vedno 'active'.
 * Prejšnja koda je preverjala samo TTL seje — če je admin terminiral
 * zaposlenega (DELETE /api/employees/[id] nastavi status='terminated'),
 * je obstoječa seja še vedno veljala do 8h (sliding TTL) / 24h (absolute).
 * Sedaj preverjamo status zaposlenega s 60s cache-om.
 */
export async function verifyToken(token: string): Promise<Session | null> {
  // 1. Preveri in-memory cache (hitro)
  const session = sessions.get(token)
  if (session) {
    if (session.expiresAt < Date.now()) {
      sessions.delete(token)
      return null
    }
    if (session.absoluteExpiry < Date.now()) {
      sessions.delete(token)
      return null
    }
    // FIX SECURITY: preveri status zaposlenega (s cache-om)
    const isActive = await isEmployeeActive(session.employeeId)
    if (!isActive) {
      // Zaposleni je bil terminiran/suspendiran — uniči sejo
      sessions.delete(token)
      db.session.deleteMany({ where: { token } }).catch(() => {})
      return null
    }
    return session
  }

  // 2. FIX VERCEL: Preveri DB directly (serverless = prazna Map na vsakem klicu)
  // Na Vercelu je vsak API klic v novi serverless funkciji — in-memory Map je vedno prazen!
  try {
    const dbSession = await db.session.findUnique({
      where: { token },
    })
    if (!dbSession) return null

    const now = Date.now()
    const expiresAt = Number(dbSession.expiresAt)
    const absoluteExpiry = Number(dbSession.absoluteExpiry)

    if (expiresAt < now || absoluteExpiry < now) {
      // Seja je potekla — izbriši iz DB
      await db.session.deleteMany({ where: { token } }).catch(() => {})
      return null
    }

    // FIX SECURITY: preveri status zaposlenega tudi za DB sessions
    const isActive = await isEmployeeActive(dbSession.employeeId)
    if (!isActive) {
      await db.session.deleteMany({ where: { token } }).catch(() => {})
      return null
    }

    // Rekonstruiraj session objekt
    const reconstructed: Session = {
      token: dbSession.token,
      employeeId: dbSession.employeeId,
      role: dbSession.role,
      permissions: JSON.parse(dbSession.permissions || '[]'),
      createdAt: Number(dbSession.createdAt),
      expiresAt,
      absoluteExpiry,
    }

    // Shrani v cache za prihodnje klice v isti request
    sessions.set(token, reconstructed)
    return reconstructed
  } catch {
    // DB napaka — poskusi loadSessionsFromDb kot fallback
    await loadSessionsFromDb()
    const fallbackSession = sessions.get(token)
    if (fallbackSession && fallbackSession.expiresAt >= Date.now() && fallbackSession.absoluteExpiry >= Date.now()) {
      // Če DB ne deluje, ne moremo preveriti statusa — dovoljeno fallback (fail-open)
      // ampak samo če je session še veljaven po TTL.
      return fallbackSession
    }
    return null
  }
}

/**
 * Preveri ali je zaposleni še vedno aktiven (status === 'active').
 * Uporablja 60s cache da ne poizveduje v DB na vsakem zahtevku.
 *
 * Vrne true če:
 * - Zaposleni obstaja in ima status 'active'
 * - DB napaka (fail-open — ne blokiraj aplikacije če DB ne deluje)
 * Vrne false če:
 * - Zaposleni ne obstaja
 * - Status je 'terminated', 'inactive', itd.
 */
async function isEmployeeActive(employeeId: string): Promise<boolean> {
  const cached = employeeStatusCache.get(employeeId)
  const now = Date.now()
  if (cached && (now - cached.checkedAt) < EMPLOYEE_STATUS_CACHE_TTL_MS) {
    return cached.status === 'active'
  }

  try {
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: { status: true },
    })
    if (!employee) {
      // Zaposleni izbrisan iz baze — seja ni več veljavna
      employeeStatusCache.set(employeeId, { status: 'deleted', checkedAt: now })
      return false
    }
    employeeStatusCache.set(employeeId, { status: employee.status, checkedAt: now })
    return employee.status === 'active'
  } catch (error: unknown) {
    // DB napaka — fail-open (ne blokiraj aplikacije), ampak logiraj
    logger.warn('AUTH', 'Napaka pri preverjanju statusa zaposlenega:', error instanceof Error ? error.message : String(error))
    return true
  }
}

/**
 * Invalidira cache za specifičnega zaposlenega — kliči ko admin spremeni status.
 * (Npr. po DELETE /api/employees/[id] ali PUT z status='terminated'.)
 */
export function invalidateEmployeeStatusCache(employeeId: string): void {
  employeeStatusCache.delete(employeeId)
}

/**
 * Uniči sejo (odjava)
 */
export function destroySession(token: string): void {
  sessions.delete(token)
  syncSessionToWs(token, null)
  db.session.deleteMany({ where: { token } }).catch(() => {})
}
