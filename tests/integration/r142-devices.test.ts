// @vitest-environment node
// ============================================
// R142 / EPIC #115 #29 — INTEGRACIJA: DEVICE CENTER
// ============================================
// GET /api/devices (R142-b upgrade) + PATCH /api/devices/[id] (NOVO R142-b)
// na pravi bazi (PGlite, izoliran PGLITE_DATA_DIR=/tmp/pglite-data-it).
// R142 ima ZERO schema sprememb → /tmp/pglite-data-it NE rabi migracije.
//
// Kontrakt R142-a/R142-b:
//   GET /api/devices:
//     • requireAuth view_reports + resolveTenantLocationId + tenantScopeToWhere
//       (lokacijska seja AVTORITATIVNA; super-admin → globalni pogled)
//     • DEVICE_SELECT whitelist odgovor (id, deviceId, name, type, status,
//       lastSeenAt, appVersion, locationId, location{name,code}) + computed
//       isOnline (lastSeenAt ≥ now − 5 min) — brez createdAt/updatedAt (PII/leak
//       canon: whitelist je edina obramba, ker include vrača polne vrstice)
//     • Cache-Control: no-store; rate limit AUTHENTICATED_LIMIT bucket
//       'devices-list'
//     • SWEEP (write-on-GET updateMany) ODSTRANJEN — GET je čisto read-only;
//       DB `status` stolpec ostane kot je (klient domena: POST/heartbeat/
//       device-sync). ?status=filter gre ŠE VEDNO na DB status kolono (NE na
//       izračunano isOnline) — test pina to HONESTNO dejansko semantiko.
//   PATCH /api/devices/[id]:
//     • requireAuth admin (pariteta DELETE) + R87-4 fail-closed scope resolver
//       PRED body parse
//     • zero-oracle 404 (notInScopeResponse '{what} ni najden'): tuja naprava ≡
//       neobstoječ id — IDENTIČNO telo 'Naprava ni najden'
//     • 403 fail-closed: lokacijski admin z locationId v bodyju (tudi lastna
//       lokacija NI izjema — NIKOLI tiho ignoriranje)
//     • super-admin reassign: ciljna lokacija mora obstajati + biti aktivna
//       (400 'Neveljavna ali neaktivna ciljna lokacija za napravo')
//     • diff-only writes; no-op (vse enako) → 200 BREZ pisanja/audita
//     • NIKOLI ne piše status/lastSeenAt/deviceId (whitelist payload)
//     • audit DEVICE_UPDATE V ISTEM tx (createAuditLog(entry, tx) kanon,
//       details = changed fields old→new, brez PII)
//
// SEED STRATEGIJA (r141 kanon): 3 DEDIKIRANE lokacije (A = glavna, B = tuja,
// I = neaktivna za 400 test) z unikatnimi RUN_ID markerji + 5 naprav (3 na A,
// 1 na B, 1 z locationId null) → natančne trditve brez interferenc fixture
// podatkov. Seja je ročno konstruirana PIN seja (r137/r140/r141 kanon —
// requireAuth nadomeščen, resolveTenantLocationId(OrThrow) ostane REALEN).
// Super-admin count trditev = baseline (izmerjen PRED seedom) + 5 → imuna na
// fixture drift. Čiščenje v afterAll po FK redu, SAMO lastne RUN_ID vrstice.
//
// deviceId FORMAT (audit točka 8): vsi seedani deviceIdji morajo ustrezati
// ^[A-Za-z0-9_-]{8,64}$ (DEVICE_ID_REGEX iz /api/device-sync) — test to pina.
//
// RATE LIMIT BUDŽET: realen limiter (brez REDIS_URL → MemoryCacheAdapter,
// r135/r136/r140 pristop). GET porabi ~11 klicev na 'devices-list', PATCH ~15
// na 'devices-update' (AUTHENTICATED_LIMIT 120/min/IP) — varno pod mejo.
// 429 pot je pokrita v unit r142-devices (r136 kanon: limiterja namerno ne
// testiramo v integraciji).
//
// AUDIT ČIŠČENJE: ta datoteka piše DEVICE_UPDATE audit vrstice. afterAll briše
// SAMO svoje (userId = emp-RUN_ID ALI entityId ∈ moji device id-ji). Ker teče
// zadnja (r142 > r141 po abecedi, fileParallelism: false), se hash veriga
// vrne v stanje PRED zagonom — prekinjena veriga za kasnejše bralce ne obstaja
// (r127 restore round-trip bere samo vrstice do trenutnega repa).
//
// Zagon: bunx vitest run tests/integration/r142-devices.test.ts \
//          --config vitest.config.integration.ts
// ============================================

import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.unmock('@/lib/db')

const authRef = vi.hoisted(() => ({
  current: null as null | {
    employeeId: string
    role: string
    locationId: string | null
    permissions: string[]
  },
}))

// ISTI vzorec kot r137/r140/r141: realen auth-middleware (importOriginal
// spread — resolveTenantLocationId/resolveTenantLocationIdOrThrow ostanejo
// REALNI, tenant scope je testiran v praksi na pravi bazi), samo requireAuth
// nadomesti z ročno konstruirano PIN sejo.
vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: async () =>
      authRef.current
        ? {
            session: {
              token: 'integration-test-token',
              employeeId: authRef.current.employeeId,
              role: authRef.current.role,
              permissions: authRef.current.permissions,
              createdAt: Date.now(),
              expiresAt: Date.now() + 3_600_000,
              absoluteExpiry: Date.now() + 86_400_000,
              locationId: authRef.current.locationId,
            },
            error: null,
          }
        : { session: null, error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna.' }), { status: 401 }) },
  }
})

import { db } from '@/lib/db'
import { GET as devicesGET } from '@/app/api/devices/route'
import { PATCH as devicesPATCH } from '@/app/api/devices/[id]/route'

const RUN_ID = `r142-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// ---------- Časovne pike ----------
// T0 = konkretni "zadnji viden" čas devA3 (2 h nazaj) — PATCH NIKOLI ne sme
// prepisati lastSeenAt, zato ga pinamo na natančen timestamp.
const T0 = new Date(Date.now() - 2 * 60 * 60 * 1000)
// Meja online okna (5 min) — devA2 je 10 min star → isOnline false.
const TEN_MIN_AGO = new Date(Date.now() - 10 * 60 * 1000)

const IDS = {
  locA: `${RUN_ID}-loc-a`,
  locB: `${RUN_ID}-loc-b`,
  locInactive: `${RUN_ID}-loc-inactive`,
  devA1: `${RUN_ID}-dev-a1`, // A: status online, lastSeenAt fresh → isOnline true
  devA2: `${RUN_ID}-dev-a2`, // A: status online, lastSeenAt 10 min → isOnline false (DB status filter dokaz)
  devA3: `${RUN_ID}-dev-a3`, // A: status offline, lastSeenAt T0 → isOnline false (status/lastSeenAt pin)
  devB1: `${RUN_ID}-dev-b1`, // B: tuja naprava (zero-oracle + reassign cilj)
  devNull: `${RUN_ID}-dev-null`, // brez lokacije (samo super-admin jo vidi)
}

const DEVICE_IDS = [IDS.devA1, IDS.devA2, IDS.devA3, IDS.devB1, IDS.devNull]
const LOC_IDS = [IDS.locA, IDS.locB, IDS.locInactive]

const NAME_A1 = `R142 Kasa A1 ${RUN_ID}`
const NAME_A2_UNUSED_GUARD = `R142 KDS A2 ${RUN_ID}`
const NAME_A3 = `R142 Tablet A3 ${RUN_ID}`
const NAME_B1 = `R142 POS B1 ${RUN_ID}`

const LOC_A_NAME = `R142 Glavna ${RUN_ID}`
const LOC_B_NAME = `R142 Filiala ${RUN_ID}`

const EMP_ID = `emp-${RUN_ID}`

// Baseline število naprav (PRED seedom) — super-admin count trditev je imuna
// na fixture drift drugih runov (isti vzorec kot r141 baselineGlobalRevenue).
let baselineDeviceCount = 0

// Whitelist kontrakt (R142-b DEVICE_SELECT + computed isOnline):
const GET_ROW_KEYS = ['appVersion', 'deviceId', 'id', 'isOnline', 'lastSeenAt', 'location', 'locationId', 'name', 'status', 'type'].sort()
// PATCH odgovor je čist DEVICE_SELECT — BREZ computed isOnline (UI jo derivira
// iz GET; unit r142 test 14 to pina na mocku, integracija na pravi bazi).
const PATCH_DEVICE_KEYS = ['appVersion', 'deviceId', 'id', 'lastSeenAt', 'location', 'locationId', 'name', 'status', 'type'].sort()
// Audit točka 8: deviceId format regex (DEVICE_ID_REGEX iz /api/device-sync)
const DEVICE_ID_REGEX = /^[A-Za-z0-9_-]{8,64}$/

async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

function devicesGet(query = ''): Promise<Response> {
  // Absolutni URL (kanon — Request v Next 16 zahteva absolutni naslov)
  return devicesGET(new Request(`http://localhost/api/devices${query}`))
}

function patchDevice(body: unknown, id: string): Promise<Response> {
  return devicesPATCH(
    new NextRequest(`http://localhost/api/devices/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  )
}

// Števec audit vrstic za entiteto (zero-write forenzika)
async function auditCount(entityId: string): Promise<number> {
  return db.auditLog.count({ where: { entityId } })
}

beforeAll(async () => {
  // 0) Globalni baseline naprav (PRED lastnim seedom)
  baselineDeviceCount = await db.deviceRegistry.count()

  // 1) Tri dedikirane lokacije: A (glavna), B (tuja) — aktivni; I (neaktivna,
  //    za reassign 400 test)
  await db.location.create({
    data: { id: IDS.locA, code: `${RUN_ID}-A`, name: LOC_A_NAME, premisesId: `${RUN_ID}-pA`, isActive: true },
  })
  await db.location.create({
    data: { id: IDS.locB, code: `${RUN_ID}-B`, name: LOC_B_NAME, premisesId: `${RUN_ID}-pB`, isActive: true },
  })
  await db.location.create({
    data: { id: IDS.locInactive, code: `${RUN_ID}-I`, name: `R142 Neaktivna ${RUN_ID}`, premisesId: `${RUN_ID}-pI`, isActive: false },
  })

  // 2) Naprave — lastSeenAt/status eksplicitno piniti (GET NIČ ne piše —
  //    sweep odstranjen, zato fixture ostanejo v stanju seeda)
  await db.deviceRegistry.create({ data: { id: IDS.devA1, deviceId: `${RUN_ID}-pos-a1`, name: NAME_A1, type: 'pos', status: 'online', lastSeenAt: new Date(), appVersion: '1.4.2', locationId: IDS.locA } })
  await db.deviceRegistry.create({ data: { id: IDS.devA2, deviceId: `${RUN_ID}-kds-a2`, name: NAME_A2_UNUSED_GUARD, type: 'kds', status: 'online', lastSeenAt: TEN_MIN_AGO, appVersion: '1.4.2', locationId: IDS.locA } })
  await db.deviceRegistry.create({ data: { id: IDS.devA3, deviceId: `${RUN_ID}-tab-a3`, name: NAME_A3, type: 'tablet', status: 'offline', lastSeenAt: T0, appVersion: '', locationId: IDS.locA } })
  await db.deviceRegistry.create({ data: { id: IDS.devB1, deviceId: `${RUN_ID}-pos-b1`, name: NAME_B1, type: 'pos', status: 'offline', lastSeenAt: TEN_MIN_AGO, appVersion: '1.0.0', locationId: IDS.locB } })
  await db.deviceRegistry.create({ data: { id: IDS.devNull, deviceId: `${RUN_ID}-mob-glb`, name: `R142 Globalna ${RUN_ID}`, type: 'mobile', status: 'offline', lastSeenAt: null, appVersion: '', locationId: null } })
}, 30_000)

beforeEach(() => {
  // Privzeta seja: admin na glavni lokaciji A (posamezni testi jo zamenjajo)
  authRef.current = { employeeId: EMP_ID, role: 'admin', locationId: IDS.locA, permissions: ['admin'] }
})

afterAll(async () => {
  // Čiščenje po FK redu — SAMO lastne RUN_ID vrstice:
  //   1) audit vrstice (piše jih PATCH; brišem svoje po userId/entityId —
  //      glej header za hash-verigo utemeljitev),
  //   2) naprave,
  //   3) lokacije (A/B/I so dedikirane; FK DeviceRegistry.locationId je
  //      SetNull, a naprave so že izbrisane).
  // Seje/tokeni NISO ustvarjeni (ročna seja brez DB vrstice); zaposleni in
  // fixture vrstice (HQ/FIL2, test-admin) ostanejo.
  await db.auditLog.deleteMany({
    where: { OR: [{ userId: EMP_ID }, { entityId: { in: DEVICE_IDS } }] },
  }).catch(() => {})
  await db.deviceRegistry.deleteMany({ where: { id: { in: DEVICE_IDS } } }).catch(() => {})
  await db.location.deleteMany({ where: { id: { in: LOC_IDS } } }).catch(() => {})
  await db.$disconnect().catch(() => {})
}, 30_000)

describe('R142 #29: GET /api/devices + PATCH /api/devices/[id] (prava PGlite)', () => {
  it('GET 401 fail-closed: brez Authorization headera IN z neveljavnim Bearerjem', async () => {
    authRef.current = null
    const resNone = await devicesGet()
    expect(resNone.status).toBe(401)
    const jsonNone = await asJson(resNone)
    expect(typeof jsonNone.error).toBe('string')

    // garbage Bearer — requireAuth faila enako (fail-closed, brez scope uhajanja)
    const resGarbage = await devicesGet()
    expect(resGarbage.status).toBe(401)
    const jsonGarbage = await asJson(resGarbage)
    expect(typeof jsonGarbage.error).toBe('string')
  })

  it('GET scope: lokacijski admin A vidi TOČNO svoje 3 naprave — B in null-location ne uhajata, count se ujema', async () => {
    const res = await devicesGet()
    expect(res.status).toBe(200)
    const json = await asJson(res)
    const devices = json.devices as Array<Record<string, unknown>>
    expect(json.count).toBe(3)
    expect(devices.map((d) => d.id).sort()).toEqual([IDS.devA1, IDS.devA2, IDS.devA3].sort())
    // vsaka vrstica je vezana na A (null-location naprava NIKOLI v scope odgovoru)
    for (const d of devices) {
      expect(d.locationId).toBe(IDS.locA)
    }
    expect(devices.map((d) => d.id)).not.toContain(IDS.devB1)
    expect(devices.map((d) => d.id)).not.toContain(IDS.devNull)
  })

  it('GET super-admin: vse naprave (A + B + null-location) v enem odgovoru — count = baseline + 5', async () => {
    authRef.current = { employeeId: EMP_ID, role: 'super_admin', locationId: null, permissions: ['admin'] }
    const res = await devicesGet()
    expect(res.status).toBe(200)
    const json = await asJson(res)
    const devices = json.devices as Array<Record<string, unknown>>
    // prazen filter (NIKOLI { locationId: null }) → baseline fixture + naših 5
    expect(json.count).toBe(baselineDeviceCount + 5)
    const byId = new Map(devices.map((d) => [d.id as string, d]))
    for (const id of DEVICE_IDS) {
      expect(byId.has(id)).toBe(true)
    }
    // null-location naprava: locationId null, relacija location null, isOnline
    // false (lastSeenAt null — nikoli izmišljen true)
    const devNull = byId.get(IDS.devNull) as Record<string, unknown>
    expect(devNull.locationId).toBeNull()
    expect(devNull.location).toBeNull()
    expect(devNull.isOnline).toBe(false)
  })

  it('GET whitelist: ključi vrstice TOČNO (whitelist + isOnline), location omejen na {name, code}, deviceId format (audit točka 8), brez createdAt/updatedAt', async () => {
    const res = await devicesGet()
    expect(res.status).toBe(200)
    const json = await asJson(res)
    const devices = json.devices as Array<Record<string, unknown>>
    expect(devices.length).toBe(3)
    for (const d of devices) {
      // TOČNO whitelist ključi + computed isOnline — nič več (polne vrstice so
      // prejšnja kršitev PII/leak canon)
      expect(Object.keys(d).sort()).toEqual(GET_ROW_KEYS)
      // location relacija omejena na display polji (brez id/owner/PII stolpcev)
      expect(Object.keys(d.location as Record<string, unknown>).sort()).toEqual(['code', 'name'])
      // audit točka 8: deviceId mora ustrezati ^[A-Za-z0-9_-]{8,64}$
      expect(d.deviceId).toMatch(DEVICE_ID_REGEX)
    }
    const a1 = devices.find((d) => d.id === IDS.devA1) as Record<string, unknown>
    expect(a1.location).toEqual({ name: LOC_A_NAME, code: `${RUN_ID}-A` })
    // dvojni PII assertion: notranji metastolpci ne uhajajo niti po ključu
    const raw = JSON.stringify(json)
    expect(raw).not.toContain('createdAt')
    expect(raw).not.toContain('updatedAt')
  })

  it('GET isOnline izračunan iz lastSeenAt (5-min pravilnik): fresh → true, 10 min → false, null → false; GET NE piše (sweep odstranjen)', async () => {
    const res = await devicesGet()
    expect(res.status).toBe(200)
    const json = await asJson(res)
    const devices = json.devices as Array<Record<string, unknown>>
    const byId = new Map(devices.map((d) => [d.id as string, d]))
    // devA1: lastSeenAt = seed "zdaj" → znotraj 5-min okna
    expect(byId.get(IDS.devA1)?.isOnline).toBe(true)
    // devA2: lastSeenAt 10 min nazaj → zunaj okna (kljub DB status 'online')
    expect(byId.get(IDS.devA2)?.isOnline).toBe(false)
    // devA3: lastSeenAt T0 (2 h nazaj) → false
    expect(byId.get(IDS.devA3)?.isOnline).toBe(false)
    // null → false (devNull, super-admin pogled)
    authRef.current = { employeeId: EMP_ID, role: 'super_admin', locationId: null, permissions: ['admin'] }
    const resSuper = await devicesGet()
    const jsonSuper = await asJson(resSuper)
    const devNull = (jsonSuper.devices as Array<Record<string, unknown>>).find((d) => d.id === IDS.devNull)
    expect(devNull?.isOnline).toBe(false)
    // read-only forenzika: DB vrstice ostanejo v stanju seeda (sweep odstranjen)
    const a2 = await db.deviceRegistry.findUnique({ where: { id: IDS.devA2 } })
    expect(a2?.lastSeenAt?.getTime()).toBe(TEN_MIN_AGO.getTime())
    expect(a2?.status).toBe('online')
  })

  it('GET Cache-Control: no-store', async () => {
    const res = await devicesGet()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('GET ?status filter: gre na DB status stolpec, NE na izračunano isOnline (honestna dejanska semantika — status je klient domena)', async () => {
    // ?status=online → DB status 'online' na A: devA1 IN devA2. devA2 ima
    // isOnline false (10 min star) — dokaz, da filter NE uporablja svežine.
    const resOnline = await devicesGet('?status=online')
    expect(resOnline.status).toBe(200)
    const jsonOnline = await asJson(resOnline)
    const online = jsonOnline.devices as Array<Record<string, unknown>>
    expect(jsonOnline.count).toBe(2)
    expect(online.map((d) => d.id).sort()).toEqual([IDS.devA1, IDS.devA2].sort())
    const a2 = online.find((d) => d.id === IDS.devA2) as Record<string, unknown>
    expect(a2.isOnline).toBe(false)

    // ?status=offline → DB status 'offline' na A: samo devA3
    const resOffline = await devicesGet('?status=offline')
    expect(resOffline.status).toBe(200)
    const jsonOffline = await asJson(resOffline)
    const offline = jsonOffline.devices as Array<Record<string, unknown>>
    expect(jsonOffline.count).toBe(1)
    expect(offline.map((d) => d.id)).toEqual([IDS.devA3])

    // neznana vrednost → prazen rezultat (filter je dobeseden DB equality)
    const resSleep = await devicesGet('?status=sleeping')
    expect(resSleep.status).toBe(200)
    expect((await asJson(resSleep)).count).toBe(0)
  })

  it('PATCH rename: 200 + whitelist odgovor BREZ isOnline + audit DEVICE_UPDATE (old→new, entityId, userId, locationId) + no-store', async () => {
    const newName = `R142 Kasa A1 preimenovana ${RUN_ID}`
    const res = await patchDevice({ name: newName }, IDS.devA1)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const json = await asJson(res)
    const device = json.device as Record<string, unknown>
    expect(device.name).toBe(newName)
    // PATCH odgovor = čist DEVICE_SELECT (brez computed isOnline)
    expect(Object.keys(device).sort()).toEqual(PATCH_DEVICE_KEYS)
    expect(device.location).toEqual({ name: LOC_A_NAME, code: `${RUN_ID}-A` })

    // DB forenzika: vrstica je res preimenovana
    const row = await db.deviceRegistry.findUnique({ where: { id: IDS.devA1 } })
    expect(row?.name).toBe(newName)

    // Audit vrstica V ISTEM tx: action/entityId/entityType/userId/details old→new
    const audit = await db.auditLog.findFirst({
      where: { action: 'DEVICE_UPDATE', entityId: IDS.devA1 },
      orderBy: { timestamp: 'desc' },
    })
    expect(audit).not.toBeNull()
    expect(audit?.entityType).toBe('DeviceRegistry')
    expect(audit?.userId).toBe(EMP_ID)
    expect(audit?.locationId).toBe(IDS.locA) // R81 metadata: obstoječa lokacija
    const details = JSON.parse(audit?.details ?? '{}') as Record<string, { before: unknown; after: unknown }>
    expect(details.name).toEqual({ before: NAME_A1, after: newName })
  })

  it('PATCH NIKOLI ne piše status/lastSeenAt: rename ohrani T0 in status offline', async () => {
    const newName = `R142 Tablet A3 preimenovana ${RUN_ID}`
    const res = await patchDevice({ name: newName }, IDS.devA3)
    expect(res.status).toBe(200)
    const json = await asJson(res)
    expect((json.device as Record<string, unknown>).name).toBe(newName)

    // DB re-read: lastSeenAt ŠE VEDNO točno T0, status ŠE VEDNO offline
    const row = await db.deviceRegistry.findUnique({ where: { id: IDS.devA3 } })
    expect(row?.lastSeenAt?.getTime()).toBe(T0.getTime())
    expect(row?.status).toBe('offline')
    expect(row?.locationId).toBe(IDS.locA)
  })

  it('PATCH 404 zero-oracle: tuja naprava ≡ neobstoječ id — IDENTIČNO telo "Naprava ni najden", zero pisnih učinkov', async () => {
    const auditsBefore = await auditCount(IDS.devB1)

    // (a) tuja naprava (locB, seja na locA)
    const resForeign = await patchDevice({ name: 'Poskus tujca' }, IDS.devB1)
    expect(resForeign.status).toBe(404)
    const bodyForeign = await asJson(resForeign)
    expect(bodyForeign).toEqual({ error: 'Naprava ni najden' })

    // (b) neobstoječ id — ISTI 404 z ISTIM telesom (ni enumeracije naprav)
    const resMissing = await patchDevice({ name: 'Poskus neobstoječe' }, `${RUN_ID}-no-such-device`)
    expect(resMissing.status).toBe(404)
    const bodyMissing = await asJson(resMissing)
    expect(bodyMissing).toEqual(bodyForeign)

    // zero pisnih učinkov: tuja vrstica ni spremenjena, noben audit ni nastal
    const row = await db.deviceRegistry.findUnique({ where: { id: IDS.devB1 } })
    expect(row?.name).toBe(NAME_B1)
    expect(await auditCount(IDS.devB1)).toBe(auditsBefore)
  })

  it('PATCH 403 fail-closed: lokacijski admin z locationId v bodyju (tuja IN lastna lokacija) — naprava nespremenjena', async () => {
    // (a) locationId = tuja lokacija B → 403 (nikoli tiho ignoriranje)
    const resForeign = await patchDevice({ locationId: IDS.locB }, IDS.devA1)
    expect(resForeign.status).toBe(403)
    expect(await asJson(resForeign)).toEqual({
      error: 'Samo skrbnik brez dodeljene lokacije lahko prerazporedi napravo na drugo lokacijo.',
    })

    // (b) locationId = LASTNA lokacija A → prav tako 403 (fail-closed brez
    //     izjem — prerazporeditev je izključno super-admin domena)
    const resOwn = await patchDevice({ locationId: IDS.locA }, IDS.devA1)
    expect(resOwn.status).toBe(403)

    // naprava nespremenjena (locationId še vedno A, audit brez reassign vnosa)
    const row = await db.deviceRegistry.findUnique({ where: { id: IDS.devA1 } })
    expect(row?.locationId).toBe(IDS.locA)
    const audits = await db.auditLog.findMany({ where: { entityId: IDS.devA1 } })
    for (const a of audits) {
      const details = JSON.parse(a.details || '{}') as Record<string, unknown>
      expect(details.locationId).toBeUndefined()
    }
  })

  it('PATCH super-admin reassign locA→locB: 200 + DB premaknjena + audit old→new; scope SLEDI napravi (A ne vidi/ne patcha, B vidi)', async () => {
    authRef.current = { employeeId: EMP_ID, role: 'super_admin', locationId: null, permissions: ['admin'] }
    const res = await patchDevice({ locationId: IDS.locB }, IDS.devA1)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const json = await asJson(res)
    const device = json.device as Record<string, unknown>
    expect(device.locationId).toBe(IDS.locB)
    expect(device.location).toEqual({ name: LOC_B_NAME, code: `${RUN_ID}-B` })

    // DB vrstica res premaknjena
    const row = await db.deviceRegistry.findUnique({ where: { id: IDS.devA1 } })
    expect(row?.locationId).toBe(IDS.locB)

    // audit: locationId old→new + R81 metadata = NOVA lokacija
    const audit = await db.auditLog.findFirst({
      where: { action: 'DEVICE_UPDATE', entityId: IDS.devA1 },
      orderBy: { timestamp: 'desc' },
    })
    expect(audit).not.toBeNull()
    const details = JSON.parse(audit?.details ?? '{}') as Record<string, { before: unknown; after: unknown }>
    expect(details.locationId).toEqual({ before: IDS.locA, after: IDS.locB })
    expect(audit?.locationId).toBe(IDS.locB)

    // scope je sledil napravi:
    // (1) admin A je ne vidi več (dve preostali napravi)
    authRef.current = { employeeId: EMP_ID, role: 'admin', locationId: IDS.locA, permissions: ['admin'] }
    const resA = await devicesGet()
    const jsonA = await asJson(resA)
    expect((jsonA.devices as Array<Record<string, unknown>>).map((d) => d.id).sort())
      .toEqual([IDS.devA2, IDS.devA3].sort())
    expect(jsonA.count).toBe(2)

    // (2) admin B jo vidi (z B lokacijo v relaciji)
    authRef.current = { employeeId: EMP_ID, role: 'admin', locationId: IDS.locB, permissions: ['admin'] }
    const resB = await devicesGet()
    const jsonB = await asJson(resB)
    const bDevices = jsonB.devices as Array<Record<string, unknown>>
    expect(jsonB.count).toBe(2)
    expect(bDevices.map((d) => d.id).sort()).toEqual([IDS.devB1, IDS.devA1].sort())

    // (3) admin A PATCH na njej → 404 zero-oracle (scope pin v updateMany)
    authRef.current = { employeeId: EMP_ID, role: 'admin', locationId: IDS.locA, permissions: ['admin'] }
    const resPatchA = await patchDevice({ name: 'Ugrabljen?' }, IDS.devA1)
    expect(resPatchA.status).toBe(404)
    expect(await asJson(resPatchA)).toEqual({ error: 'Naprava ni najden' })
  })

  it('PATCH reassign validacija (super-admin): neobstoječa lokacija → 400, neaktivna lokacija → 400; zero pisnih učinkov', async () => {
    authRef.current = { employeeId: EMP_ID, role: 'super_admin', locationId: null, permissions: ['admin'] }
    const auditsBefore = await auditCount(IDS.devB1)

    // (a) neobstoječa ciljna lokacija
    const resMissing = await patchDevice({ locationId: `${RUN_ID}-no-such-loc` }, IDS.devB1)
    expect(resMissing.status).toBe(400)
    expect(await asJson(resMissing)).toEqual({ error: 'Neveljavna ali neaktivna ciljna lokacija za napravo' })

    // (b) neaktivna ciljna lokacija (dedikirana isActive:false lokacija I)
    const resInactive = await patchDevice({ locationId: IDS.locInactive }, IDS.devB1)
    expect(resInactive.status).toBe(400)
    expect(await asJson(resInactive)).toEqual({ error: 'Neveljavna ali neaktivna ciljna lokacija za napravo' })

    // zero pisnih učinkov: naprava ostane na B, brez audit vrstic
    const row = await db.deviceRegistry.findUnique({ where: { id: IDS.devB1 } })
    expect(row?.locationId).toBe(IDS.locB)
    expect(await auditCount(IDS.devB1)).toBe(auditsBefore)
  })

  it('PATCH validacija: prazen body → 400; ime 101 znakov → 400; ime 100 znakov → 200 (meja)', async () => {
    // (a) prazen body {} — vsaj eno polje obvezno
    const resEmpty = await patchDevice({}, IDS.devA2)
    expect(resEmpty.status).toBe(400)
    const jsonEmpty = await asJson(resEmpty)
    expect(jsonEmpty.error).toBe('Neveljavni podatki')
    expect(Object.keys(jsonEmpty).sort()).toEqual(['error', 'validationErrors'])
    expect((jsonEmpty.validationErrors as unknown[]).length).toBeGreaterThan(0)

    // (b) prazno ime (trim → min 1) in 101 znakov → 400
    const resBlank = await patchDevice({ name: '' }, IDS.devA2)
    expect(resBlank.status).toBe(400)
    expect((await asJson(resBlank)).error).toBe('Neveljavni podatki')

    const resTooLong = await patchDevice({ name: 'x'.repeat(101) }, IDS.devA2)
    expect(resTooLong.status).toBe(400)
    expect((await asJson(resTooLong)).error).toBe('Neveljavni podatki')

    // (c) 100 znakov = veljavna meja → 200 (in res zapisano)
    const boundaryName = 'y'.repeat(100)
    const resBoundary = await patchDevice({ name: boundaryName }, IDS.devA2)
    expect(resBoundary.status).toBe(200)
    const jsonBoundary = await asJson(resBoundary)
    expect((jsonBoundary.device as Record<string, unknown>).name).toBe(boundaryName)
    const row = await db.deviceRegistry.findUnique({ where: { id: IDS.devA2 } })
    expect(row?.name).toBe(boundaryName)
  })

  it('PATCH no-op (isto ime): 200, BREZ nove audit vrstice, updatedAt nespremenjen', async () => {
    const before = await db.deviceRegistry.findUnique({ where: { id: IDS.devA2 } })
    expect(before).not.toBeNull()
    const auditsBefore = await auditCount(IDS.devA2)

    const res = await patchDevice({ name: before!.name }, IDS.devA2)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const json = await asJson(res)
    expect((json.device as Record<string, unknown>).name).toBe(before!.name)

    // nič ni bilo zapisano: enako število audit vrstic + enak updatedAt
    expect(await auditCount(IDS.devA2)).toBe(auditsBefore)
    const after = await db.deviceRegistry.findUnique({ where: { id: IDS.devA2 } })
    expect(after?.updatedAt.getTime()).toBe(before!.updatedAt.getTime())
  })

  it('PATCH 401 fail-closed: brez seje — zero pisnih učinkov', async () => {
    authRef.current = null
    const auditsBefore = await auditCount(IDS.devA2)

    const res = await patchDevice({ name: 'Nepooblaščeno ime' }, IDS.devA2)
    expect(res.status).toBe(401)
    const json = await asJson(res)
    expect(typeof json.error).toBe('string')

    // zero pisnih učinkov
    const row = await db.deviceRegistry.findUnique({ where: { id: IDS.devA2 } })
    expect(row?.name).toBe('y'.repeat(100))
    expect(await auditCount(IDS.devA2)).toBe(auditsBefore)
  })
})
