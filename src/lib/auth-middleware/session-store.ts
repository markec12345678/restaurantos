// ============================================
// SESSION STORE — upravljanje sej v pomnilniku + SQLite
// Ustvarjanje, preverjanje, uničenje sej
// Persistenca v SQLite, sinhronizacija z WS strežnikom
// ============================================

import crypto from 'crypto'
import { db } from '../db'
import { logger } from '../logger'
import type { Session } from './types'
import { SESSION_TTL_MS, MAX_SESSIONS } from './constants'

// Pomnilniški cache sej
const sessions = new Map<string, Session>()

/**
 * FIX CRITICAL: Sinhroniziraj sejo z WebSocket strežnikom (server.js)
 * Ko je seja ustvarjena/uničena, obvesti tudi WS session store
 */
function syncSessionToWs(token: string, session: Session | null) {
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
    // WS strežnik morda ni na voljo (npr. next dev brez server.js)
  }
}

/**
 * FIX MEDIUM: Naloži seje iz SQLite ob zagonu
 * Preživijo restart strežnika — zaposleni ne morajo biti ponovno prijavljeni
 */
let sessionsLoadedFromDb = false
let sessionLoadPromise: Promise<void> | null = null

async function loadSessionsFromDb(): Promise<void> {
  // FIX HIGH: Uporabimo promise za preprečitev sočasnega nalaganja
  // Če seje že nalagamo, počakamo na obstoječi promise namesto duplicate load
  if (sessionsLoadedFromDb) return
  if (sessionLoadPromise) return sessionLoadPromise

  sessionLoadPromise = (async () => {
    try {
      const now = Date.now()
      // Izbriši potekle seje iz DB
      await db.session.deleteMany({
        where: { expiresAt: { lt: now } }
      })

      // Naloži veljavne seje v pomnilnik
      const dbSessions = await db.session.findMany({
        where: { absoluteExpiry: { gte: now } }
      })

      for (const dbSession of dbSessions) {
        try {
          const session: Session = {
            token: dbSession.token,
            employeeId: dbSession.employeeId,
            role: dbSession.role,
            permissions: JSON.parse(dbSession.permissions || '[]'),
            createdAt: dbSession.createdAt,
            expiresAt: dbSession.expiresAt,
            absoluteExpiry: dbSession.absoluteExpiry,
          }
          sessions.set(dbSession.token, session)

          // Sinhroniziraj z WS session store
          syncSessionToWs(dbSession.token, session)
        } catch {
          // Skip invalid sessions
        }
      }

      sessionsLoadedFromDb = true
      logger.info('AUTH', `Naloženih ${sessions.size} sej iz SQLite`)
    } catch (error: unknown) {
      logger.warn('AUTH', 'Napaka pri nalaganju sej iz DB:', error)
      // FIX: NE nastavi sessionsLoadedFromDb = true ob napaki — dovoli ponovni poskus
      // Prejšnja koda je označila kot naloženo tudi ob napaki, kar je onemogočilo retry
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

  // Če je še vedno preveč sej, odstrani najstarejše
  if (sessions.size > MAX_SESSIONS) {
    const entries = [...sessions.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)
    const toRemove = entries.slice(0, sessions.size - MAX_SESSIONS)
    for (const [token] of toRemove) {
      sessions.delete(token)
      expiredTokens.push(token)
    }
  }

  // FIX MEDIUM: Izbriši potekle seje tudi iz SQLite
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

/**
 * Ustvari novo sejo po uspešni prijavi
 * FIX: Sinhroniziraj sejo tudi z WS strežnikom + SQLite persistenca
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
    absoluteExpiry: now + 24 * 60 * 60 * 1000, // 24 hours absolute max
  }

  sessions.set(token, session)

  // FIX CRITICAL: Sinhroniziraj z WS session store
  syncSessionToWs(token, session)

  // FIX MEDIUM: Shrani sejo v SQLite za persistenco
  db.session.create({
    data: {
      token,
      employeeId: employee.id,
      role: employee.role,
      permissions: JSON.stringify(employee.permissions),
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
      absoluteExpiry: now + 24 * 60 * 60 * 1000,
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
 * FIX HIGH: Počakaj na nalaganje sej iz DB pred preverjanjem
 */
export async function verifyToken(token: string): Promise<Session | null> {
  // FIX: Zagotovi, da so seje naložene iz DB pred preverjanjem
  // Brez tega prve zahteve po restartu strežnika ne najdejo sej
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
 * FIX: Sinhroniziraj z WS strežnikom — odjavi tudi WS povezave
 * FIX MEDIUM: Izbriši sejo tudi iz SQLite
 */
export function destroySession(token: string): void {
  sessions.delete(token)
  // FIX CRITICAL: Sinhroniziraj z WS session store
  syncSessionToWs(token, null)
  // FIX MEDIUM: Izbriši iz SQLite
  db.session.deleteMany({ where: { token } }).catch(() => {})
}

// Izvoz za uporabo v middleware (podaljšanje seje)
export { sessions, syncSessionToWs, loadSessionsFromDb }
