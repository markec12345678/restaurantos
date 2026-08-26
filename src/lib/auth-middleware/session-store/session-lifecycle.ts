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
 * Preveri ali je zaposleni še vedno aktiven (s 60s cache-om)
 * FIX SECURITY: preverja tudi ali je zaposleni še vedno 'active'.
 * Prejšnja koda je preverjala samo TTL seje — če je admin terminiral
 * zaposleni (DELETE /api/employees/[id] nastavi status='terminated'),
 * je obstoječa seja še vedno veljala do 8h (sliding TTL) / 24h (absolute).
 * Sedaj preverjamo status zaposlenega s 60s cache-om.
 */
async function isEmployeeActive(employeeId: string): Promise<boolean> {
  // Preveri cache
  const cached = employeeStatusCache.get(employeeId)
  if (cached && Date.now() - cached.checkedAt < EMPLOYEE_STATUS_CACHE_TTL_MS) {
    return cached.status === 'active'
  }

  // Preveri v bazi
  try {
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: { status: true },
    })
    if (!employee) {
      employeeStatusCache.set(employeeId, { status: 'not_found', checkedAt: Date.now() })
      return false
    }
    employeeStatusCache.set(employeeId, { status: employee.status, checkedAt: Date.now() })
    return employee.status === 'active'
  } catch {
    // DB napaka — fail-open (dovoli dostop, da ne blokiramo celotnega sistema)
    return true
  }
}

/**
 * Invalidiraj cache za specifičnega zaposlenega.
 * Kliče se ko admin terminira ali izbriše zaposlenega.
 */
export function invalidateEmployeeStatusCache(employeeId: string): void {
  employeeStatusCache.delete(employeeId)
  logger.info('AUTH', `Invalidiran status cache za zaposlenega ${employeeId}`)
}

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
        // FIX WORKFLOW-45: prej BigInt(now) — sedaj DateTime (Date object)
        createdAt: new Date(now),
        expiresAt: new Date(now + SESSION_TTL_MS),
        absoluteExpiry: new Date(now + 24 * 60 * 60 * 1000),
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
    // FIX WORKFLOW-45: prej Number(BigInt) — sedaj DateTime → number (ms)
    const expiresAt = dbSession.expiresAt instanceof Date ? dbSession.expiresAt.getTime() : Number(dbSession.expiresAt)
    const absoluteExpiry = dbSession.absoluteExpiry instanceof Date ? dbSession.absoluteExpiry.getTime() : Number(dbSession.absoluteExpiry)

    if (expiresAt < now || absoluteExpiry < now) {
      await db.session.deleteMany({ where: { token } }).catch(() => {})
      return null
    }

    // FIX SECURITY: preveri status zaposlenega tudi za DB sessions
    const isActive = await isEmployeeActive(dbSession.employeeId)
    if (!isActive) {
      await db.session.deleteMany({ where: { token } }).catch(() => {})
      return null
    }

    const reconstructed: Session = {
      token: dbSession.token,
      employeeId: dbSession.employeeId,
      role: dbSession.role,
      permissions: JSON.parse(dbSession.permissions || '[]'),
      createdAt: dbSession.createdAt instanceof Date ? dbSession.createdAt.getTime() : Number(dbSession.createdAt),
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
      return fallbackSession
    }
    return null
  }
}

/**
 * Uniči sejo (odjava)
 */
export function destroySession(token: string): void {
  sessions.delete(token)
  syncSessionToWs(token, null)
  db.session.deleteMany({ where: { token } }).catch(() => {})
}
