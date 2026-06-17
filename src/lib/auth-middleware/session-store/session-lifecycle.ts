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
export function createSession(employee: {
  id: string
  role: string
  permissions: string[]
}, ipAddress?: string, userAgent?: string): string {
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

  // Shrani sejo v SQLite za persistenco
  db.session.create({
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
  }).catch((err: Error) => {
    logger.warn('AUTH', 'Napaka pri shranjevanju seje v DB:', err.message)
  })

  return token
}

/**
 * Preveri veljavnost tokena in vrne sejo
 */
export async function verifyToken(token: string): Promise<Session | null> {
  await loadSessionsFromDb()

  const session = sessions.get(token)
  if (!session) return null
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

/**
 * Uniči sejo (odjava)
 */
export function destroySession(token: string): void {
  sessions.delete(token)
  syncSessionToWs(token, null)
  db.session.deleteMany({ where: { token } }).catch(() => {})
}
