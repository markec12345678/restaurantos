// ============================================
// SESSION LIFECYCLE — Ustvarjanje, preverjanje, uničenje sej
// ============================================

import crypto from 'crypto'
import { db } from '../../db'
import { logger } from '../../logger'
import type { Session } from '../types'
import { SESSION_TTL_MS } from '../constants'
import { sessions, syncSessionToWs, loadSessionsFromDb } from './session-cache'

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
