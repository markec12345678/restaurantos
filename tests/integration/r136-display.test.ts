// @vitest-environment node
// ============================================
// R136 / EPIC #115 P1-12 — INTEGRACIJA: CUSTOMER-FACING DISPLAY tabla
// ============================================
// Kontrakt P1-12 na pravi bazi (PGlite, izoliran PGLITE_DATA_DIR):
//   (a) GET /api/public/display?locationId=... → 200 + TOČNO aktivna naročila
//       (status in ['pending','in-progress','ready']); completed in staro
//       ready (2h okno) NIKOLI na tabli
//   (b) PII whitelist v praksi: seedana customerName/notes/total NE uhajajo
//       (vrednosti IN ključi — vsaka vrstica ima točno guest-safe whitelist)
//   (c) fail-closed lokacija: neznana / neveljavna oblika / manjkajoč
//       parameter → VSI isti 404 (zero-oracle, kiosk kanon)
//   (d) cross-tenant: naročilo tuje lokacije ni v odgovoru (ne glede na status)
//   (e) 2h okno: staro ready naročilo ne smeti table
//   (f) vrstni red createdAt asc (FIFO — prvo oddano prvo) + take cap 50
//   (g) status preslikava: server vrača DB vrednosti ('in-progress') — UI
//       naredi prikazno preslikavo
//
// Rate limit (checkRateLimitAsync bucket 'public-display', PUBLIC_MENU_LIMIT
// 30/min/IP): integracija teče na REALNEM MemoryCacheAdapter limiterju (v
// testnem okolju ni REDIS_URL → getCacheAdapter() vrača memory adapter, isti
// pristop kot r135-kiosk-order — limiter NI mockan). Ta datoteka porabi ~10
// GET klicev z istim fallback IP-jem → varno pod mejo 30/min, limiter ne
// trči. Limiterja namerno NE testiramo (unit r136-display pokrije 429 pot).
//
// Zagon: node scripts/init-pglite.mjs (PGLITE_DATA_DIR=/tmp/pglite-data-it)
//        → vitest run --config vitest.config.integration.ts <file>
// ============================================

import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'

vi.unmock('@/lib/db')

import { db } from '@/lib/db'
import { GET as displayGET } from '@/app/api/public/display/route'

const RUN_ID = `r136-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const HOUR_MS = 3_600_000
// locationId MORA ustrezati regexu /^[a-z0-9]{5,50}$/i (BREZ vezajev — ruta
// validira obliko PREJ kot DB poizvedbo, kiosk kanon R86-3)
const LOC_BASE = `r136${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
const IDS = {
  locationA: `${LOC_BASE}a`,
  locationB: `${LOC_BASE}b`,
  table1: `${RUN_ID}-t1`,
  table2: `${RUN_ID}-t2`,
}

// PII vrednosti seedane na VSIH naročilih — NIKOLI se smejo pojaviti v
// odgovoru (route select je whitelist: orderNumber/status/type/createdAt/
// table.number — customerName, notes in total NISO v selectu)
const PII_NAME = 'Test Guest'
const PII_NOTES = 'alergija orehov'

async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

function displayGet(locationId?: string): Promise<Response> {
  const q = locationId === undefined ? '' : `?locationId=${locationId}`
  return displayGET(new Request(`http://x/api/public/display${q}`))
}

beforeAll(async () => {
  await db.location.create({ data: { id: IDS.locationA, name: `${LOC_BASE}-${RUN_ID}`, code: `${RUN_ID}-A`, premisesId: `${RUN_ID}-pa`, isActive: true } })
  await db.location.create({ data: { id: IDS.locationB, name: `R136 Tuja Lokacija ${RUN_ID}`, code: `${RUN_ID}-B`, premisesId: `${RUN_ID}-pb`, isActive: true } })
  await db.table.create({ data: { id: IDS.table1, number: 1, locationId: IDS.locationA } })
  await db.table.create({ data: { id: IDS.table2, number: 2, locationId: IDS.locationA } })

  // 3 AKTIVNA naročila s staggeranim createdAt (−50/−40/−30 min →
  // determinističen FIFO vrstni red, vsa znotraj 2h okna) + PII polja
  await db.order.create({
    data: {
      id: `${RUN_ID}-o1`, orderNumber: 101, status: 'pending', type: 'dine-in',
      tableId: IDS.table1, locationId: IDS.locationA,
      customerName: PII_NAME, notes: PII_NOTES, total: 42.5,
      createdAt: new Date(Date.now() - 50 * 60_000),
    },
  })
  await db.order.create({
    data: {
      id: `${RUN_ID}-o2`, orderNumber: 102, status: 'in-progress', type: 'dine-in',
      tableId: IDS.table2, locationId: IDS.locationA,
      customerName: PII_NAME, notes: PII_NOTES, total: 17.3,
      createdAt: new Date(Date.now() - 40 * 60_000),
    },
  })
  await db.order.create({
    data: {
      id: `${RUN_ID}-o3`, orderNumber: 103, status: 'ready', type: 'takeout',
      locationId: IDS.locationA, // takeout — brez mize → tableNumber null
      customerName: PII_NAME, notes: PII_NOTES, total: 9.9,
      createdAt: new Date(Date.now() - 30 * 60_000),
    },
  })
  // completed — NIKOLI na tabli (status filter)
  await db.order.create({
    data: {
      id: `${RUN_ID}-o4`, orderNumber: 104, status: 'completed', type: 'dine-in',
      locationId: IDS.locationA,
      customerName: PII_NAME, notes: PII_NOTES, total: 55,
      createdAt: new Date(Date.now() - 20 * 60_000),
    },
  })
  // ready, a STAREJŠI od 2h okna — NIKOLI na tabli (createdAt −3 h)
  await db.order.create({
    data: {
      id: `${RUN_ID}-o5`, orderNumber: 105, status: 'ready', type: 'takeout',
      locationId: IDS.locationA,
      customerName: PII_NAME, notes: PII_NOTES, total: 12.34,
      createdAt: new Date(Date.now() - 3 * HOUR_MS),
    },
  })
  // cross-tenant: sveže ready naročilo TUJE lokacije — nikoli v odgovoru za A
  await db.order.create({
    data: {
      id: `${RUN_ID}-o6`, orderNumber: 901, status: 'ready', type: 'takeout',
      locationId: IDS.locationB,
      customerName: PII_NAME, notes: PII_NOTES, total: 99,
      createdAt: new Date(Date.now() - 5 * 60_000),
    },
  })
})

afterAll(async () => {
  // Čiščenje po FK redu: otroci naročil (defenzivno — seed ustvari gola
  // naročila, a Payment→Check je Restrict, zato otroci IZREČENO najprej)
  for (const locId of [IDS.locationA, IDS.locationB]) {
    await db.payment.deleteMany({ where: { check: { order: { locationId: locId } } } }).catch(() => {})
    await db.check.deleteMany({ where: { order: { locationId: locId } } }).catch(() => {})
    await db.orderItem.deleteMany({ where: { order: { locationId: locId } } }).catch(() => {})
  }
  await db.order.deleteMany({ where: { locationId: { in: [IDS.locationA, IDS.locationB] } } }).catch(() => {})
  await db.table.deleteMany({ where: { locationId: IDS.locationA } }).catch(() => {})
  await db.location.deleteMany({ where: { id: { in: [IDS.locationA, IDS.locationB] } } }).catch(() => {})
})

describe('R136 P1-12: display tabla end-to-end (prava PGlite)', () => {
  it('Happy path: 200 — točno 3 aktivna naročila, completed NI, PII ne uhaja, no-store + ISO timestamp', async () => {
    const res = await displayGet(IDS.locationA)
    expect(res.status).toBe(200)
    // R124b kanon: tabla polla realno-časovne statuse → no-store
    expect(res.headers.get('cache-control')).toBe('no-store')

    const body = await asJson(res) as { orders: Array<Record<string, unknown>>; timestamp: string }

    // točno 3 aktivna (pending/in-progress/ready): completed (104) in staro
    // ready (105, −3 h) NISTA v seznamu — oba filtra v praksi hkrati
    const numbers = body.orders.map(o => o.orderNumber)
    expect(body.orders).toHaveLength(3)
    expect(numbers).toEqual(expect.arrayContaining([101, 102, 103]))
    expect(numbers).not.toContain(104)
    expect(numbers).not.toContain(105)
    expect(body.orders.map(o => o.status)).toEqual(expect.arrayContaining(['pending', 'in-progress', 'ready']))

    // tableNumber točno izvlečen iz relacije Table.number; table objekt
    // ne uhaja (flat guest-safe vrstice)
    const byNumber = new Map(body.orders.map(o => [o.orderNumber as number, o]))
    expect(byNumber.get(101)!.tableNumber).toBe(1)
    expect(byNumber.get(102)!.tableNumber).toBe(2)
    expect(byNumber.get(103)!.tableNumber).toBeNull() // takeout brez mize

    // PII whitelist v praksi: seedane VREDNOSTI ne uhajajo
    const raw = JSON.stringify(body)
    expect(raw).not.toContain(PII_NAME)
    expect(raw).not.toContain('alergija')
    // ...in KLJUČI tudi ne (vrednost 'total' brez ključa v JSON ne more
    // obstajati — vrednostno preverjanje bi lažno positive zadel v ms delu
    // ISO časov; ključna whitelistja je popoln dokaz)
    expect(raw).not.toContain('customerName')
    expect(raw).not.toContain('notes')
    expect(raw).not.toContain('total')
    // najmočnejši dokaz: vsaka vrstica ima TOČNO guest-safe whitelist ključe
    const expectedKeys = ['createdAt', 'orderNumber', 'status', 'tableNumber', 'type'].sort()
    for (const o of body.orders) {
      expect(Object.keys(o).sort()).toEqual(expectedKeys)
    }

    // timestamp prisoten in ISO-parseable
    expect(typeof body.timestamp).toBe('string')
    expect(body.timestamp.length).toBeGreaterThan(0)
    expect(Number.isNaN(new Date(body.timestamp).getTime())).toBe(false)
  })

  it('Fail-closed: neznana lokacija / neveljavna oblika / manjkajoč parameter → vsi isti 404 (zero-oracle)', async () => {
    // neznana lokacija — veljavna oblika, ne obstaja v DB
    const unknown = await displayGet(`${LOC_BASE}zz`)
    expect(unknown.status).toBe(404)
    expect(await asJson(unknown)).toHaveProperty('error')

    // neveljavne oblike — ISTI 404 (ni oraklja o obstoju lokacij)
    const short = await displayGet('abc') // < 5 znakov
    const dash = await displayGet('abc-de') // vezaj ni v regexu
    const space = await displayGet('abc%20de') // presledek ni v regexu
    const missing = await displayGet() // brez parametra (404 PRED db klicem)
    for (const res of [short, dash, space, missing]) {
      expect(res.status).toBe(404)
      expect(await asJson(res)).toHaveProperty('error')
    }
  })

  it('Cross-tenant: naročilo tuje lokacije NI v odgovoru (ne glede na status)', async () => {
    // lokacija B ima SVEŽE ready naročilo #901 (znotraj 2h okna) — če bi
    // ruta pozabila locationId scope, bi 901 pristal na tabli lokacije A
    const res = await displayGet(IDS.locationA)
    expect(res.status).toBe(200)
    const body = await asJson(res) as { orders: Array<{ orderNumber: number }> }
    expect(body.orders.map(o => o.orderNumber)).not.toContain(901)
  })

  it('2h okno: staro ready naročilo (createdAt −3 h) NI na tabli', async () => {
    const res = await displayGet(IDS.locationA)
    expect(res.status).toBe(200)
    const body = await asJson(res) as { orders: Array<{ orderNumber: number; status: string }> }
    // staro ready (105) odpade; ready razred zastopajo SAMO sveža naročila
    expect(body.orders.map(o => o.orderNumber)).not.toContain(105)
    expect(body.orders.filter(o => o.status === 'ready').map(o => o.orderNumber)).toEqual([103])
  })

  it('Vrstni red createdAt asc (FIFO — prvo oddano prvo) + take cap 50', async () => {
    const res = await displayGet(IDS.locationA)
    expect(res.status).toBe(200)
    const body = await asJson(res) as { orders: Array<{ orderNumber: number; createdAt: string }> }
    // seed: 101 (−50 min) → 102 (−40 min) → 103 (−30 min) — strogo FIFO
    expect(body.orders.map(o => o.orderNumber)).toEqual([101, 102, 103])
    const times = body.orders.map(o => new Date(o.createdAt).getTime())
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThanOrEqual(times[i - 1])
    }
    // take cap: odgovor nikoli ne preseže 50 vrstic (DoS zaščita)
    expect(body.orders.length).toBeLessThanOrEqual(50)
  })

  it('Status preslikava: in-progress pride tak, kot je v DB (server NE preslika — UI naredi)', async () => {
    const res = await displayGet(IDS.locationA)
    expect(res.status).toBe(200)
    const body = await asJson(res) as { orders: Array<{ orderNumber: number; status: string }> }
    const inProgress = body.orders.find(o => o.orderNumber === 102)
    expect(inProgress).toBeDefined()
    // surova DB vrednost — brez prikazne preslikave ('V pripravi', 'preparing')
    expect(inProgress!.status).toBe('in-progress')
  })
})
