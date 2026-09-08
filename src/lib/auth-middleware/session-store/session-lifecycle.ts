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
import { parsePermissions } from '@/lib/json-fields'

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
//
// P1-11: cache vsebuje tudi sessionVersion — ob PIN/vlogi/status spremembi
// se različica poviša in vse stare seje takoj nehajo veljati.
const employeeStatusCache = new Map<string, { status: string; locationId: string | null; sessionVersion: number; checkedAt: number }>()
const EMPLOYEE_STATUS_CACHE_TTL_MS = 30 * 1000 // 30 sekund

/**
 * Pridobi kontekst zaposlenega (status + lokacija + verzija sej) iz baze s 30s cache-om.
 * Uporablja se za preverjanje aktivnosti, obogatitev sej z locationId in
 * primerjavo sessionVersion (P1-11 revokacija).
 */
async function getEmployeeContext(employeeId: string): Promise<{ status: string; locationId: string | null; sessionVersion: number }> {
  // Preveri cache (30s TTL)
  const cached = employeeStatusCache.get(employeeId)
  if (cached && Date.now() - cached.checkedAt < EMPLOYEE_STATUS_CACHE_TTL_MS) {
    return { status: cached.status, locationId: cached.locationId, sessionVersion: cached.sessionVersion }
  }

  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { status: true, locationId: true, sessionVersion: true },
  })

  if (!employee) {
    employeeStatusCache.set(employeeId, { status: 'not_found', locationId: null, sessionVersion: -1, checkedAt: Date.now() })
    return { status: 'not_found', locationId: null, sessionVersion: -1 }
  }

  employeeStatusCache.set(employeeId, { status: employee.status, locationId: employee.locationId ?? null, sessionVersion: employee.sessionVersion ?? 0, checkedAt: Date.now() })
  return { status: employee.status, locationId: employee.locationId ?? null, sessionVersion: employee.sessionVersion ?? 0 }
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
 * P1-11: Revociraj VSE seje zaposlenega — dvorazlični pristop:
 *   1. Poviša Employee.sessionVersion (vse prihodnje verifyToken primerjave
 *      ponesrejo → seja neveljavna; deluje tudi med instancami, ker je
 *      verzija v DB, ne v pomnilniku)
 *   2. Takoj pobriše DB seje + pomnilniške seje (hitra pot)
 *
 * Pokliči jo ob: PIN spremembi, vlogi/status spremembi, spremembi dovoljenj
 * job-a zaposlenega. Vrne št. uničenih sej (za audit).
 */
export async function revokeEmployeeSessions(employeeId: string, reason: string): Promise<number> {
  let destroyed = 0
  try {
    const removed = await db.session.deleteMany({ where: { employeeId } })
    destroyed += removed.count
  } catch (err: unknown) {
    logger.warn('AUTH', `Napaka pri brisanju DB sej za ${employeeId}:`, err instanceof Error ? err.message : String(err))
  }

  // Pomnilniške seje (hash ključi) — version bump jih ubije tudi na drugih
  // instancah, tukaj jih počistimo takoj na tej
  for (const [key, s] of [...sessions.entries()]) {
    if (s.employeeId === employeeId) {
      sessions.delete(key)
      destroyed++
    }
  }

  try {
    await db.employee.update({
      where: { id: employeeId },
      data: { sessionVersion: { increment: 1 } },
    })
  } catch (err: unknown) {
    logger.warn('AUTH', `Napaka pri povišanju sessionVersion za ${employeeId}:`, err instanceof Error ? err.message : String(err))
  }

  // Počisti statusni cache, da se sprememba takoj vidi
  employeeStatusCache.delete(employeeId)

  logger.info('AUTH', `Revocirane seje za zaposlenega ${employeeId} (${reason}): ${destroyed}`)
  return destroyed
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

  // P1-11: različica sej zaposlenega ob prijavi — primerja se z
  // Employee.sessionVersion pri vsakem verifyToken (PIN/vloga/status
  // sprememba → takojšnja revokacija). Brišemo izjemno redko (login).
  let sessionVersion = 0
  try {
    const emp = await db.employee.findUnique({
      where: { id: employee.id },
      select: { sessionVersion: true },
    })
    sessionVersion = emp?.sessionVersion ?? 0
  } catch {
    // Vercel: če query pade, je sessionVersion 0 — verifyToken DB pot bo
    // prav tako padla, zato to ni varnostna luknja (fail-closed drugje)
  }

  const session: Session = {
    token: tokenHash,
    employeeId: employee.id,
    role: employee.role,
    permissions: employee.permissions,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    absoluteExpiry: now + 24 * 60 * 60 * 1000,
    locationId: employee.locationId || null,  // FIX Test 7.1: scope session to location
    sessionVersion,
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
        sessionVersion,
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
    const ctx = await getEmployeeContext(session.employeeId)
    if (ctx.status !== 'active') {
      sessions.delete(tokenHash)
      await db.session.deleteMany({ where: { token: tokenHash } }).catch(() => {})
      return null
    }
    // P1-11: sessionVersion mismatch → revocirana seja (PIN/vloga/status/
    // dovoljenja so se spremenili po prijavi). -1 = employee izbrisan.
    if (typeof session.sessionVersion === 'number' && session.sessionVersion !== ctx.sessionVersion) {
      sessions.delete(tokenHash)
      await db.session.deleteMany({ where: { token: tokenHash } }).catch(() => {})
      return null
    }
    // WS AUDIT 2026-09-09: obogatitev locationId — seje, naložene iz DB
    // (loadSessionsFromDb po restartu), locationId NI imajo. null je VELJAVNA
    // vrednost (super admin) — obogatimo SAMO undefined!
    if (session.locationId === undefined) {
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

    // P1-11: sessionVersion mismatch → seja je bila revocirana (PIN/vloga/
    // status/dovoljenja spremenjeni po prijavi). Stolpec default 0 = backward
    // kompatibilen z zgodovinskimi sejami pred uvedbojo verzij.
    const sessionVersion = dbSession.sessionVersion ?? 0
    if (employeeContext.sessionVersion >= 0 && sessionVersion !== employeeContext.sessionVersion) {
      await db.session.deleteMany({ where: { token: tokenHash } }).catch(() => {})
      return null
    }

    const reconstructed: Session = {
      token: tokenHash,
      employeeId: dbSession.employeeId,
      role: dbSession.role,
      permissions: parsePermissions(dbSession.permissions),
      createdAt: dbSession.createdAt instanceof Date ? dbSession.createdAt.getTime() : Number(dbSession.createdAt),
      expiresAt,
      absoluteExpiry,
      // WS AUDIT 2026-09-09: Session tabela ne hrani locationId — obogatimo iz
      // Employee zapisa (avtoritativni vir, 30s cache). Brez tega bi bil
      // regular user na Vercelu (cold start) brez lokacije → 403, WS klient
      // pa obravnavan kot globalen (bypass per-location filtra).
      locationId: employeeContext.locationId,
      sessionVersion,
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
export async function destroySession(token: string): Promise<void> {
  // FIX SECURITY: pomnilnik po hashu; WS store po plaintext ključu
  sessions.delete(hashSessionToken(token))
  syncSessionToWs(token, null)
  await db.session.deleteMany({ where: { token: hashSessionToken(token) } }).catch(() => {})
}
