// ============================================
// SESSION CACHE — Pomnilniški cache sej + nalaganje iz SQLite
// Sinhronizacija z WS strežnikom
// ============================================

import { db } from '../../db'
import { logger } from '../../logger'
import type { Session } from '../types'
import { MAX_SESSIONS } from '../constants'

// Pomnilniški cache sej
export const sessions = new Map<string, Session>()

/**
 * Sinhroniziraj sejo z WebSocket strežnikom (server.js)
 */
export function syncSessionToWs(token: string, session: Session | null) {
  try {
    const wsSessionStore = (globalThis as Record<string, unknown>).__wsSessionStore as Map<string, Session> | undefined
    if (wsSessionStore) {
      if (session) {
        wsSessionStore.set(token, session)
      } else {
        wsSessionStore.delete(token)
      }
    }
  } catch {
    // WS strežnik morda ni na voljo
  }
}

/**
 * Naloži seje iz SQLite ob zagonu
 */
let sessionsLoadedFromDb = false
let sessionLoadPromise: Promise<void> | null = null

export async function loadSessionsFromDb(): Promise<void> {
  if (sessionsLoadedFromDb) return
  if (sessionLoadPromise) return sessionLoadPromise

  sessionLoadPromise = (async () => {
    try {
      const now = Date.now()
      await db.session.deleteMany({
        where: { expiresAt: { lt: BigInt(now) } }
      })

      const dbSessions = await db.session.findMany({
        where: { absoluteExpiry: { gte: BigInt(now) } }
      })

      for (const dbSession of dbSessions) {
        try {
          const session: Session = {
            token: dbSession.token,
            employeeId: dbSession.employeeId,
            role: dbSession.role,
            permissions: JSON.parse(dbSession.permissions || '[]'),
            createdAt: Number(dbSession.createdAt),
            expiresAt: Number(dbSession.expiresAt),
            absoluteExpiry: Number(dbSession.absoluteExpiry),
          }
          sessions.set(dbSession.token, session)
          syncSessionToWs(dbSession.token, session)
        } catch {
          // Skip invalid sessions
        }
      }

      sessionsLoadedFromDb = true
      logger.info('AUTH', `Naloženih ${sessions.size} sej iz SQLite`)
    } catch (error: unknown) {
      logger.warn('AUTH', 'Napaka pri nalaganju sej iz DB:', error)
    } finally {
      sessionLoadPromise = null
    }
  })()

  return sessionLoadPromise
}

// Naloži seje ob zagonu
loadSessionsFromDb().catch(() => {})

// Čiščenje poteklih sej vsakih 30 minut — pomnilnik + SQLite
setInterval(async () => {
  const now = Date.now()
  const expiredTokens: string[] = []

  for (const [token, session] of sessions) {
    if (session.expiresAt < now || session.absoluteExpiry < now) {
      sessions.delete(token)
      expiredTokens.push(token)
    }
  }

  if (sessions.size > MAX_SESSIONS) {
    const entries = [...sessions.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)
    const toRemove = entries.slice(0, sessions.size - MAX_SESSIONS)
    for (const [token] of toRemove) {
      sessions.delete(token)
      expiredTokens.push(token)
    }
  }

  if (expiredTokens.length > 0) {
    try {
      await db.session.deleteMany({
        where: { token: { in: expiredTokens } }
      })
    } catch {
      // DB morda ni na voljo
    }
  }
}, 30 * 60 * 1000)
