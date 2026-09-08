// ============================================
// SESSION LIFECYCLE — Ustvarjanje, preverjanje, uničenje sej
// ============================================

import crypto from 'crypto'
import { db } from '../../db'
import { logger } from '../../logger'
import type { Session } from '../types'
import { SESSION_TTL_MS, MAX_SESSIONS_PER_EMPLOYEE } from '../constants'
import { sessions, syncSessionToWs } from './session-cache'
import { hashSessionToken } from './token-hash'

// FIX SECURITY: Cache za status zaposlenega — prepreči DA je terminiran zaposleni
// še vedno lahko dostopa do API-jev do poteka seje (do 8h!).
// Cache je 30s — če admin terminira zaposlenega, bo seja prenehala veljati v 30s.
// FIX: Zmanjšan z 60s na 30s za hitrejši odziv na terminacijo.
//
// WS AUDIT 2026-09-09: cache razširjen še z locationId zaposlenega. Razlog:
// Session tabela NE shranjuje locationId — ob rekonstrukciji seje iz DB
// (verifyToken DB pot / loadSessionsFromDb po restartu) je session.locationId
// IZGUBLJEN. Posledice: (a) WS per-location filter je kliente obravnaval kot
// globalne (bypass multi-tenant izolacije na WS), (b) resolveTenantLocationId
// bi rednim uporabnikom vrnil 403. Sedaj obogatimo sejo iz Employee zapisa
// (avtoritativni vir, svež v 30s — sledi tudi prenosom zaposlenega).
const employeeStatusCache = new Map<string, { status: string; locationId: string | null; checkedAt: number }>()
const EMPLOYEE_STATUS_CACHE_TTL_MS = 30 * 1000 // 30 sekund

/**
 * Pridobi kontekst zaposlenega (status + lokacija) iz baze s 30s cache-om.
 * Uporablja se za preverjanje aktivnosti in obogatitev sej z locationId.
 */
async function getEmployeeContext(employeeId: string): Promise<{ status: string; locationId: string | null }> {
  // Preveri cache (30s TTL)
  const cached = employeeStatusCache.get(employeeId)
  if (cached && Date.now() - cached.checkedAt < EMPLOYEE_STATUS_CACHE_TTL_MS) {
    return { status: cached.status, locationId: cached.locationId }
  }

  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { status: true, locationId: true },
  })

  if (!employee) {
    employeeStatusCache.set(employeeId, { status: 'not_found', locationId: null, checkedAt: Date.now() })
    return { status: 'not_found', locationId: null }
  }

  employeeStatusCache.set(employeeId, { status: employee.status, locationId: employee.locationId ?? null, checkedAt: Date.now() })
  return { status: employee.status, locationId: employee.locationId ?? null }
}

/**
 * Preveri ali je zaposleni še vedno aktiven (s 30s cache-om)
 * FIX SECURITY: preverja tudi ali je zaposleni še vedno 'active'.
 * Prejšnja koda je preverjala samo TTL seje — če je admin terminiral
 * zaposleni (DELETE /api/employees/[id] nastavi status='terminated'),
 * je obstoječa seja še vedno veljala do 8h (sliding TTL) / 24h (absolute).
 * Sedaj preverjamo status zaposlenega s 30s cache-om.
 *
 * FIX: Prej je bil fail-open (return true ob DB napaki). To je varnostna
 * luknja — če DB ni dosegljiv, terminiran zaposleni še vedno lahko dostopa.
 * Sedaj je fail-closed (return false) za terminirane, ampak fail-open samo
 * če DB query vrže napako (ne če je status='terminated').
 */
async function isEmployeeActive(employeeId: string): Promise<boolean> {
  // Preveri cache (30s TTL)
  const cached = employeeStatusCache.get(employeeId)
  if (cached && Date.now() - cached.checkedAt < EMPLOYEE_STATUS_CACHE_TTL_MS) {
    return cached.status === 'active'
  }

  // Preveri v bazi — BREZ try/catch fail-open!
  // Če DB query vrže napako, naj se request fail-a (500) namesto dovoliti dostop.
  const ctx = await getEmployeeContext(employeeId)
  return ctx.status === 'active'
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
  locationId?: string | null  // FIX Test 7.1: Multi-tenant isolation
}, ipAddress?: string, userAgent?: string): Promise<string> {
  // FIX P10: Per-employee session limit — prepreči session flooding.
  // Če ima uporabnik že MAX_SESSIONS_PER_EMPLOYEE aktivnih sej, uniči
  // najstarejšo (LRU eviction). Tipičen scenarij: uporabnik prijavi na
  // 5 naprav, 6. prijava avtomatsko uniči 1. sejo.
  const employeeSessions = [...sessions.entries()]
    .filter(([_token, s]) => s.employeeId === employee.id)
    .sort((a, b) => a[1].createdAt - b[1].createdAt)

  if (employeeSessions.length >= MAX_SESSIONS_PER_EMPLOYEE) {
    const toEvict = employeeSessions.slice(0, employeeSessions.length - MAX_SESSIONS_PER_EMPLOYEE + 1)
    for (const [oldToken, _session] of toEvict) {
      sessions.delete(oldToken)
      try {
        await db.session.deleteMany({ where: { token: oldToken } })
      } catch {
        // DB delete fail — session je že odstranjena iz memory
      }
    }
    logger.info('AUTH', `Session limit eviction: ${toEvict.length} old sessions removed for employee ${employee.id}`)
  }

  const token = crypto.randomBytes(32).toString('hex')
  // FIX SECURITY: v pomnilniku in DB je samo SHA-256 hash tokena —
  // plain token se vrne klientu in nikjer ne persistira.
  const tokenHash = hashSessionToken(token)
  const now = Date.now()

  const session: Session = {
    token: tokenHash,
    employeeId: employee.id,
    role: employee.role,
    permissions: employee.permissions,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    absoluteExpiry: now + 24 * 60 * 60 * 1000,
    locationId: employee.locationId || null,  // FIX Test 7.1: scope session to location
  }

  sessions.set(tokenHash, session)

  // Sinhroniziraj z WS session store (PLAINTEXT ključ — WS avtentikacija
  // ne bere DB; glej token-hash.ts)
  syncSessionToWs(token, session)

  // FIX VERCEL: AWAIT DB write — na serverless moramo počakati da seja pride v DB
  // Prej je bilo non-blocking (.catch()), a Vercel serverless ubije funkcijo preden se write konča
  try {
    await db.session.create({
      data: {
        token: tokenHash,
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
  // FIX SECURITY: pomnilniški cache in DB sta ključana po SHA-256 hashu
  // tokena (plain token nikjer ni persistiran — glej token-hash.ts)
  const tokenHash = hashSessionToken(token)

  // 1. Preveri in-memory cache (hitro)
  const session = sessions.get(tokenHash)
  if (session) {
    if (session.expiresAt < Date.now()) {
      sessions.delete(tokenHash)
      return null
    }
    if (session.absoluteExpiry < Date.now()) {
      sessions.delete(tokenHash)
      return null
    }
    // FIX SECURITY: Preveri status zaposlenega TUDI za cached sessions!
    // Prejšnja koda je preskočila isEmployeeActive() check za in-memory cache,
    // kar je pomenilo da terminiran zaposleni še vedno lahko dostopa do API-jev
    // če je seja v cache-u (npr. isti Vercel serverless instance).
    const isActive = await isEmployeeActive(session.employeeId)
    if (!isActive) {
      sessions.delete(tokenHash)
      await db.session.deleteMany({ where: { token: tokenHash } }).catch(() => {})
      return null
    }
    // WS AUDIT 2026-09-09: obogatitev locationId — seje, naložene iz DB
    // (loadSessionsFromDb po restartu), locationId NI imajo. null je VELJAVNA
    // vrednost (super admin) — obogatimo SAMO undefined!
    if (session.locationId === undefined) {
      const ctx = await getEmployeeContext(session.employeeId)
      session.locationId = ctx.locationId
    }
    return session
  }

  // 2. FIX VERCEL: Preveri DB directly (serverless = prazna Map na vsakem klicu)
  // Na Vercelu je vsak API klic v novi serverless funkciji — in-memory Map je vedno prazen!
  try {
    const dbSession = await db.session.findUnique({
      where: { token: tokenHash },
    })
    if (!dbSession) return null

    const now = Date.now()
    const expiresAt = dbSession.expiresAt instanceof Date ? dbSession.expiresAt.getTime() : Number(dbSession.expiresAt)
    const absoluteExpiry = dbSession.absoluteExpiry instanceof Date ? dbSession.absoluteExpiry.getTime() : Number(dbSession.absoluteExpiry)

    if (expiresAt < now || absoluteExpiry < now) {
      await db.session.deleteMany({ where: { token: tokenHash } }).catch(() => {})
      return null
    }

    // FIX SECURITY: preveri status zaposlenega tudi za DB sessions
    // WS AUDIT: pridobi tudi locationId (isti query — brez dodatnega obremenjevanja)
    const employeeContext = await getEmployeeContext(dbSession.employeeId)
    if (employeeContext.status !== 'active') {
      await db.session.deleteMany({ where: { token: tokenHash } }).catch(() => {})
      return null
    }

    const reconstructed: Session = {
      token: tokenHash,
      employeeId: dbSession.employeeId,
      role: dbSession.role,
      permissions: JSON.parse(dbSession.permissions || '[]'),
      createdAt: dbSession.createdAt instanceof Date ? dbSession.createdAt.getTime() : Number(dbSession.createdAt),
      expiresAt,
      absoluteExpiry,
      // WS AUDIT 2026-09-09: Session tabela ne hrani locationId — obogatimo iz
      // Employee zapisa (avtoritativni vir, 30s cache). Brez tega bi bil
      // regular user na Vercelu (cold start) brez lokacije → 403, WS klient
      // pa obravnavan kot globalen (bypass per-location filtra).
      locationId: employeeContext.locationId,
    }

    sessions.set(tokenHash, reconstructed)
    return reconstructed
  } catch (dbError) {
    // FIX SECURITY: DB napaka — NE dovoli dostopa (fail-closed)!
    // Prejšnja koda je naredila loadSessionsFromDb() in vrnila session
    // BREZ preverjanja isEmployeeActive() — kar je varnostna luknja.
    // Če DB ni dosegljiv, naj vsi APIji vrnejo 500 (ne 401 z session).
    logger.error('AUTH', 'DB napaka v verifyToken:', dbError instanceof Error ? dbError.message : String(dbError))
    return null
  }
}

/**
 * Uniči sejo (odjava)
 */
export function destroySession(token: string): void {
  // FIX SECURITY: pomnilnik po hashu; WS store po plaintext ključu
  sessions.delete(hashSessionToken(token))
  syncSessionToWs(token, null)
  db.session.deleteMany({ where: { token: hashSessionToken(token) } }).catch(() => {})
}
