// @vitest-environment node
// ============================================
// R150 / REPO ISSUE #33 "JSON-as-String" — INTEGRACIJA: JSONB invariante,
// dual-write OrderItemModifier, wire roundtrips, queryability, auth kanon
// ============================================
// Prava PGlite (IT DB, PGLITE_DATA_DIR=/tmp/pglite-data-it iz
// vitest.config.integration.ts; fileParallelism: false — datoteke ZAPOREDNO).
//
// R150-d kontrakt (worklog R150-a/b2/c):
//   • 0022_json_fields: 25 stolpcev String→Json (JSONB v DB), wire format
//     NESPREMENJEN (API sprejema/vrača JSON STRINGE — toJsonWire mapping).
//   • OrderItemModifier join tabela + DUAL-WRITE: join vrstice + legacy
//     OrderItem.modifiersJson STRING v ISTI transakciji.
//   • DEFER (ostanejo String, byte-pin): AuditLog.details, WebhookDelivery.payload,
//     RestaurantSettings.apiKeys, MenuItem/Modifier.allergens (CSV), OrderItem.modifiersJson.
//
// OPOMBA o tolerantnih branjih malformed legacy stringov: na JSONB stolpcu je
// malformed vrednost NEMOGOČA po konstrukciji (Postgres jsonb zavrže neveljavni
// JSON že pri zapisu — ALTER ... USING cast fail-closed abortira, Prisma create
// pa gre skozi jsonb parser). Tolerantna plast (parse* helperji: string ALI
// native struct, pokvarjen vnos → fallback) je pokrita v unit testih:
// tests/unit/lib/json-fields.test.ts + tests/unit/api/r150-json-fields.test.ts (sekcija B).
//
// Zagon: bunx vitest run tests/integration/r150-json-fields.test.ts \
//          --config vitest.config.integration.ts
// ============================================

import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from 'vitest'

// KLJUČNO: tests/setup.ts globalno mock-ira @/lib/db — tu želimo PRAVEGA klienta.
vi.unmock('@/lib/db')

const authRef = vi.hoisted(() => ({
  current: null as null | {
    employeeId: string
    role: string
    locationId: string | null
    permissions: string[]
  },
}))

// ISTI vzorec kot r143/r144/r145 (najnovejši kanon): realen auth-middleware
// (importOriginal spread — resolveTenantLocationId/OrThrow, tenantScopeToWhere
// ostanejo REALENI), samo requireAuth nadomesti z ročno konstruirano PIN sejo;
// mock UPORABI realen hasPermission za opts.permission gate, da je 403 kanon
// 1:1 z realnim middleware telesom.
vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  const { hasPermission } = await import('@/lib/auth-middleware/permissions')
  return {
    ...actual,
    requireAuth: async (
      _req: Request,
      opts?: { permission?: string | string[] },
    ): Promise<{ session: unknown; error: Response | null }> => {
      if (!authRef.current) {
        return {
          session: null,
          error: new Response(
            JSON.stringify({ error: 'Avtentikacija je obvezna. Pošljite Authorization: Bearer <token>' }),
            { status: 401, headers: { 'content-type': 'application/json' } },
          ),
        }
      }
      const session = {
        token: 'integration-test-token',
        employeeId: authRef.current.employeeId,
        role: authRef.current.role,
        permissions: authRef.current.permissions,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3_600_000,
        absoluteExpiry: Date.now() + 86_400_000,
        locationId: authRef.current.locationId,
      }
      const required = opts?.permission
        ? (Array.isArray(opts.permission) ? opts.permission : [opts.permission])
        : []
      if (required.length > 0 && !hasPermission(session as never, required as never)) {
        return {
          session: null,
          error: new Response(
            JSON.stringify({ error: 'Nimate dovoljenja za to operacijo.' }),
            { status: 403, headers: { 'content-type': 'application/json' } },
          ),
        }
      }
      return { session, error: null }
    },
  }
})

import { db } from '@/lib/db'
import { POST as ordersPost } from '@/app/api/orders/route'
import { GET as kotGET, POST as kotPOST } from '@/app/api/kot/route'
import { POST as guestsPost } from '@/app/api/guests/route'
import { GET as guestGet } from '@/app/api/guests/[id]/route'
import { GET as hhGet, POST as hhPost } from '@/app/api/happy-hour/route'
import { toNum } from '@/lib/decimal/convert'
import { GET as jobsGet, POST as jobsPost } from '@/app/api/jobs/route'
import { GET as staffPerfGet } from '@/app/api/staff-performance/route'
import { GET as receiptGet } from '@/app/api/receipts/[id]/route'

const RUN_ID = `r150-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// ---------- 25 MIGRIRANIH stolpcev (0022_json_fields — worklog R150-a Stage Summary) ----------
const MIGRATED_JSONB: ReadonlyArray<readonly [string, string]> = [
  ['Printer', 'printRules'], ['Job', 'permissions'], ['Receipt', 'vatBreakdown'],
  ['RestaurantSettings', 'emailReportRecipients'], ['Location', 'emailReportRecipients'],
  ['DeliveryZone', 'postCodes'], ['DeliveryZone', 'cities'], ['Webhook', 'events'],
  ['Guest', 'allergens'], ['Guest', 'dietaryPrefs'], ['Guest', 'dislikes'], ['Guest', 'favoriteItems'],
  ['Supplier', 'deliveryDays'], ['MealtimeRule', 'daysOfWeek'],
  ['HappyHourSchedule', 'daysOfWeek'], ['HappyHourSchedule', 'appliesToIds'],
  ['Integration', 'config'], ['Integration', 'events'],
  ['IntegrationLog', 'requestData'], ['IntegrationLog', 'responseData'],
  ['GuestFeedback', 'tags'], ['Session', 'permissions'],
  ['BiometricCredential', 'transports'], ['KotDocument', 'itemsJson'], ['ApiKey', 'scopes'],
]
// DEFER — byte-pinned String stolpci (hash-veriga / HMAC / deprecated keystore / CSV / legacy dual-write)
const DEFER_TEXT: ReadonlyArray<readonly [string, string]> = [
  ['AuditLog', 'details'], ['WebhookDelivery', 'payload'], ['RestaurantSettings', 'apiKeys'],
  ['MenuItem', 'allergens'], ['Modifier', 'allergens'], ['OrderItem', 'modifiersJson'],
]

// ---------- Fixture ID-ji (RUN_ID-namespaced — private window, deterministična roka) ----------
const IDS = {
  locA: `${RUN_ID}-loc-a`,
  emp: `${RUN_ID}-emp`,
  menu: `${RUN_ID}-menu`,
  cat: `${RUN_ID}-cat`,
  menuItem: `${RUN_ID}-mi`,
  modGroup: `${RUN_ID}-mg`,
  priceGroup: `${RUN_ID}-pg`,
  guest: `${RUN_ID}-guest`,
  job: `${RUN_ID}-job`,
  hh: `${RUN_ID}-hh`,
}
const IDEM_A = `${RUN_ID}-idem-a`
const ORDER_IDS: string[] = [] // zapolnjeno iz POST odgovora (cleanup + invariante)
const ORDER_ITEM_IDS: string[] = []
const KOT_IDS: string[] = []

const MOD_GROUP_NAME = `E2E Priloge ${RUN_ID}`
const MODS_WIRE = JSON.stringify([
  { name: 'Ketchup', price: 0.5, quantity: 1, modifierGroupId: IDS.modGroup },
  { name: 'Brez skupine', price: 0.9 },
])
const KOT_ITEMS_WIRE = JSON.stringify([{ name: 'R150 Pivo', qty: 1, notes: '', station: 'bar' }])

async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

beforeAll(async () => {
  // Lokacija + zaposleni (status 'active' — orders POST preveri)
  await db.location.create({ data: { id: IDS.locA, name: `R150 Lokacija ${RUN_ID}`, code: `${RUN_ID}-A`, premisesId: `${RUN_ID}-pa`, isActive: true } })
  await db.employee.create({ data: { id: IDS.emp, name: `R150 Natakar ${RUN_ID}`, email: `${RUN_ID}@r150.test.local`, role: 'manager', status: 'active', locationId: IDS.locA } })

  // Katalog MODEL A: Menu → Category → MenuItem (lokacija A)
  await db.menu.create({ data: { id: IDS.menu, name: `R150 Meni ${RUN_ID}`, locationId: IDS.locA } })
  await db.category.create({ data: { id: IDS.cat, name: `R150 Kat ${RUN_ID}`, menuId: IDS.menu } })
  await db.menuItem.create({ data: { id: IDS.menuItem, name: 'R150 Test Pivo', price: 3.5, categoryId: IDS.cat, vatRate: 9.5 } })

  // ModifierGroup (za snapshot imena skupine v OrderItemModifier join vrstici)
  await db.modifierGroup.create({ data: { id: IDS.modGroup, name: MOD_GROUP_NAME, locationId: IDS.locA, minSelect: 0, maxSelect: 5, sortOrder: 0 } })

  // Cenik (HappyHourSchedule.priceGroupId FK, MODEL A per-lokacija)
  await db.priceGroup.create({ data: { id: IDS.priceGroup, name: `R150 Cenik ${RUN_ID}`, locationId: IDS.locA } })

  // Privzeta seja: admin na lokaciji A (posamezni testi jo zamenjajo)
  authRef.current = { employeeId: IDS.emp, role: 'admin', locationId: IDS.locA, permissions: ['admin'] }
})

afterAll(async () => {
  // Čiščenje po FK redu — SAMO lastne RUN_ID vrstice (r142-d/r144-d/r145-d pravilo):
  //   1) AuditLog PRVI (produkcijska hash veriga — userId/entityId mojih vrstic),
  //   2) KotDocument (FK na Order),
  //   3) OrderItemModifier (belt&braces — FK Cascade bi pokril, ampak eksplicitno),
  //   4) Order (Cascade na OrderItem), Guest, HappyHourSchedule, PriceGroup,
  //   5) Job, Counter (scoped ime vsebuje lokacijo), ModifierGroup, MenuItem,
  //      Category, Menu, Employee, Location.
  await db.auditLog.deleteMany({ where: { OR: [{ userId: IDS.emp }, { entityId: { in: ORDER_IDS } }] } }).catch(() => {})
  await db.kotDocument.deleteMany({ where: { OR: [{ id: { in: KOT_IDS } }, { orderId: { in: ORDER_IDS } }] } }).catch(() => {})
  await db.orderItemModifier.deleteMany({ where: { orderItemId: { in: ORDER_ITEM_IDS } } }).catch(() => {})
  await db.order.deleteMany({ where: { idempotencyKey: IDEM_A } }).catch(() => {})
  // Guest/HH: API generira cuid (ne IDS.*) → čiščenje po RUN_ID žigu v imenu/lastName
  await db.guest.deleteMany({ where: { lastName: { contains: RUN_ID } } }).catch(() => {})
  await db.happyHourSchedule.deleteMany({ where: { name: { contains: RUN_ID } } }).catch(() => {})
  await db.priceGroup.deleteMany({ where: { id: IDS.priceGroup } }).catch(() => {})
  await db.job.deleteMany({ where: { name: { contains: RUN_ID } } }).catch(() => {})
  await db.counter.deleteMany({ where: { name: { contains: IDS.locA } } }).catch(() => {})
  await db.modifierGroup.deleteMany({ where: { id: IDS.modGroup } }).catch(() => {})
  await db.menuItem.deleteMany({ where: { id: IDS.menuItem } }).catch(() => {})
  await db.category.deleteMany({ where: { id: IDS.cat } }).catch(() => {})
  await db.menu.deleteMany({ where: { id: IDS.menu } }).catch(() => {})
  await db.employee.deleteMany({ where: { id: IDS.emp } }).catch(() => {})
  await db.location.deleteMany({ where: { id: IDS.locA } }).catch(() => {})

  // --- EMPIRIČNA VERIFIKACIJA ČIŠČENJA (0 ostankov po vseh RUN_ID markerjih) ---
  expect(await db.auditLog.count({ where: { OR: [{ userId: IDS.emp }, { entityId: { in: ORDER_IDS } }] } })).toBe(0)
  expect(await db.kotDocument.count({ where: { orderId: { in: ORDER_IDS } } })).toBe(0)
  expect(await db.orderItemModifier.count({ where: { orderItemId: { in: ORDER_ITEM_IDS } } })).toBe(0)
  expect(await db.order.count({ where: { idempotencyKey: IDEM_A } })).toBe(0)
  expect(await db.guest.count({ where: { lastName: { contains: RUN_ID } } })).toBe(0)
  expect(await db.happyHourSchedule.count({ where: { name: { contains: RUN_ID } } })).toBe(0)
  expect(await db.priceGroup.count({ where: { id: IDS.priceGroup } })).toBe(0)
  expect(await db.job.count({ where: { name: { contains: RUN_ID } } })).toBe(0)
  expect(await db.counter.count({ where: { name: { contains: IDS.locA } } })).toBe(0)
  expect(await db.modifierGroup.count({ where: { id: IDS.modGroup } })).toBe(0)
  expect(await db.menuItem.count({ where: { id: IDS.menuItem } })).toBe(0)
  expect(await db.menu.count({ where: { id: IDS.menu } })).toBe(0)
  expect(await db.employee.count({ where: { id: IDS.emp } })).toBe(0)
  expect(await db.location.count({ where: { id: IDS.locA } })).toBe(0)
  await db.$disconnect().catch(() => {})
})

beforeEach(() => {
  // Privzeta seja: admin na lokaciji A
  authRef.current = { employeeId: IDS.emp, role: 'admin', locationId: IDS.locA, permissions: ['admin'] }
})

// ============================================
// A. ORDER + MODIFIER E2E — dual-write na pravi bazi
// ============================================
describe('R150 A: naročilo z modifikatorji — OrderItemModifier join vrstice + legacy string (dual-write)', () => {
  it('POST /api/orders (string wire) → 201; join vrstice v DB (name/price/quantity/sortOrder/snapshot skupine) + legacy modifiersJson še vedno STRING v ISTI tx', async () => {
    const res = await ordersPost(new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer integration' },
      body: JSON.stringify({ type: 'dine-in', orderItems: [{ menuItemId: IDS.menuItem, quantity: 1, modifiersJson: MODS_WIRE }], idempotencyKey: IDEM_A }),
    }))
    expect(res.status).toBe(201)
    const body = await asJson(res)
    ORDER_IDS.push(body.id as string)
    const items = body.orderItems as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    ORDER_ITEM_IDS.push(items[0].id as string)

    // WIRE: legacy stolpec ostane string (byte-kompatibilen UI kontrakt)
    expect(typeof items[0].modifiersJson).toBe('string')
    expect(JSON.parse(items[0].modifiersJson as string)).toEqual(JSON.parse(MODS_WIRE))

    // DB: normalizirane join vrstice — snapshot cene + imena skupine + vrstni red
    const joins = await db.orderItemModifier.findMany({ where: { orderItemId: items[0].id as string }, orderBy: { sortOrder: 'asc' } })
    expect(joins).toHaveLength(2)
    expect(joins[0]).toMatchObject({ orderItemId: items[0].id, name: 'Ketchup', quantity: 1, modifierGroupId: IDS.modGroup, modifierGroupName: MOD_GROUP_NAME, sortOrder: 0 })
    expect(toNum(joins[0].price)).toBe(0.5) // Prisma Decimal → number snapshot cene
    expect(joins[1]).toMatchObject({ name: 'Brez skupine', quantity: null, modifierGroupId: null, modifierGroupName: '', sortOrder: 1 })
    expect(toNum(joins[1].price)).toBe(0.9)

    // DB: legacy OrderItem.modifiersJson — NESPREMENJEN string (dual-write v isti tx)
    const oi = await db.orderItem.findUnique({ where: { id: items[0].id as string } })
    expect(typeof oi?.modifiersJson).toBe('string')
    expect(oi?.modifiersJson).toBe(MODS_WIRE)
  })

  it('GET /api/receipts/[orderId] — predogled 200; subtotal vključuje ceni modifierjev (queryability cenovnega snapshot-a)', async () => {
    const orderId = ORDER_IDS[0]
    expect(orderId).toBeTruthy()
    const res = await receiptGet(new Request(`http://localhost/api/receipts/${orderId}`), { params: Promise.resolve({ id: orderId }) })
    expect(res.status).toBe(200)
    const body = await asJson(res)
    // Predogled računa računa vatBreakdown NA POTO (ni stored-wire polje — Receipt.vatBreakdown
    // JSONB invarianta je dokazana v sekciji B); znesek: 3.5 + 0.5 + 0.9 = 4.9
    expect(body.subtotal).toBe(4.9)
    expect(body.totalVat).toBe(0.47) // ROUND_HALF_UP: 4.9 × 9.5 % = 0.4655 → 0.47
  })

  it('KOT POST + GET — itemsJson wire STRING (vhod in izhod), DB pa NATIVNI jsonb array', async () => {
    const orderId = ORDER_IDS[0]
    // POST: wire vhod = string
    const postRes = await kotPOST(new Request('http://localhost/api/kot', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer integration' },
      body: JSON.stringify({ orderId, type: 'original', itemsJson: KOT_ITEMS_WIRE }),
    }))
    expect(postRes.status).toBe(201)
    const kot = await asJson(postRes)
    KOT_IDS.push(kot.id as string)
    expect(typeof kot.itemsJson).toBe('string')
    expect(JSON.parse(kot.itemsJson as string)).toEqual(JSON.parse(KOT_ITEMS_WIRE))

    // DB: KotDocument.itemsJson je zdaj JSONB — NATIVNI array (brez dvojnega kodiranja)
    const row = await db.kotDocument.findUnique({ where: { id: kot.id as string } })
    expect(Array.isArray(row?.itemsJson)).toBe(true)

    // GET ×2: wire izhod = string, byte-identičen med ponovitvama
    const g1 = await asJson(await kotGET(new Request(`http://localhost/api/kot?orderId=${orderId}`)))
    const g2 = await asJson(await kotGET(new Request(`http://localhost/api/kot?orderId=${orderId}`)))
    const k1 = (g1.kots as Array<Record<string, unknown>>).find((k) => k.id === kot.id)
    const k2 = (g2.kots as Array<Record<string, unknown>>).find((k) => k.id === kot.id)
    expect(typeof k1?.itemsJson).toBe('string')
    expect(JSON.stringify(k1)).toBe(JSON.stringify(k2))
    expect(JSON.parse(k1!.itemsJson as string)).toEqual(JSON.parse(KOT_ITEMS_WIRE))
  })
})

// ============================================
// B. JSONB INVARIANTE — information_schema na pravi bazi
// ============================================
describe('R150 B: JSONB invariante — 25/25 stolpcev jsonb, DEFER ostane text, 0 anomalij', () => {
  it('vseh 25 migriranih stolpcev ima data_type = jsonb', async () => {
    // ::text CASTI OBVEZNI: information_schema stolpci so PG tipa 'name', ki ga Prisma
    // $queryRaw ne zna deserializirati ('Failed to deserialize column of type name').
    // Imena tabel/stolpcev prihajajo iz lastnega konstantnega seznama (ne iz vnosa) — varna interpolacija
    const list = MIGRATED_JSONB.map((_, i) => `($${2 * i + 1}, $${2 * i + 2})`).join(',')
    const params = MIGRATED_JSONB.flat()
    const rows = await db.$queryRawUnsafe<{ table_name: string; column_name: string; data_type: string }[]>(
      `SELECT table_name::text AS table_name, column_name::text AS column_name, data_type::text AS data_type FROM information_schema.columns WHERE (table_name, column_name) IN (${list})`,
      ...params,
    )
    expect(rows).toHaveLength(25)
    for (const r of rows) expect(r.data_type).toBe('jsonb')
    // brez manjkajočih parov (IN požre točno 25 vrstic — duplikati nemogoči)
    expect(new Set(rows.map((r) => `${r.table_name}.${r.column_name}`))).toHaveLength(25)
  })

  it('DEFER stolpci ostanejo text (byte-pin kontrakt: hash veriga / HMAC / keystore / CSV / legacy wire)', async () => {
    for (const [t, c] of DEFER_TEXT) {
      const rows = await db.$queryRaw<{ data_type: string }[]>`
        SELECT data_type FROM information_schema.columns WHERE table_name = ${t} AND column_name = ${c}`
      expect(rows, `${t}.${c}`).toHaveLength(1)
      expect(rows[0]?.data_type, `${t}.${c}`).toBe('text')
    }
  })

  it('OrderItemModifier tabela obstaja z obema FK-ema in indeksom na orderItemId', async () => {
    const tbl = await db.$queryRaw<{ tablename: string }[]>`
      SELECT tablename::text FROM pg_tables WHERE schemaname = 'public' AND tablename = 'OrderItemModifier'`
    expect(tbl).toHaveLength(1)
    const fks = await db.$queryRaw<{ conname: string }[]>`
      SELECT conname::text FROM pg_constraint WHERE contype = 'f' AND conname IN ('OrderItemModifier_orderItemId_fkey', 'OrderItemModifier_modifierGroupId_fkey')`
    expect(fks).toHaveLength(2)
    const idx = await db.$queryRaw<{ indexname: string }[]>`
      SELECT indexname::text FROM pg_indexes WHERE tablename = 'OrderItemModifier' AND indexname = 'OrderItemModifier_orderItemId_idx'`
    expect(idx).toHaveLength(1)
  })

  it('jsonb_typeof = \'string\' anomalij je 0 čez vseh 25 stolpcev (ni tihega dvojnega kodiranja)', async () => {
    // Velja na sveže rebuildani IT bazi + zaporednem izvajanju (fileParallelism: false)
    // + po FK-urejenem čiščenju vsakega IT fajla. Malformed vrednost NI MOŽNA
    // (jsonb zavrže neveljavni JSON pri zapisu — glej header komentar datoteke).
    let anomalies = 0
    for (const [t, c] of MIGRATED_JSONB) {
      const rows = await db.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM "${t}" WHERE "${c}" IS NOT NULL AND jsonb_typeof("${c}") = 'string'`,
      )
      anomalies += Number(rows[0]?.n ?? 0)
    }
    expect(anomalies).toBe(0)
  })
})

// ============================================
// C. ROUNDTRIPS — wire string ↔ DB native, byte-identičen ponovljen GET
// ============================================
describe('R150 C: roundtrips gost/happy-hour/job — wire string ×2, DB native', () => {
  it('gost: POST (Zod native array vhod) → GET [id] wire STRING ×2 byte-identičen; DB allergens NATIVNI array', async () => {
    const postRes = await guestsPost(new Request('http://localhost/api/guests', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer integration' },
      body: JSON.stringify({ lastName: `R150 Gost ${RUN_ID}`, allergens: ['1', '7'], dietaryPrefs: ['vegetarijansko'], dislikes: ['gobe'], favoriteItems: ['Beefsteak'] }),
    }))
    expect(postRes.status).toBe(201)
    const created = await asJson(postRes)
    expect(typeof created.id).toBe('string') // API generira svoj cuid (ne podeduje IDS.guest)
    const guestId = created.id as string

    // GET [id] ×2 — wire polja so STRINGI, ponovitvi byte-identični
    const g1 = await asJson(await guestGet(new Request(`http://localhost/api/guests/${guestId}`), { params: Promise.resolve({ id: guestId }) }))
    const g2 = await asJson(await guestGet(new Request(`http://localhost/api/guests/${guestId}`), { params: Promise.resolve({ id: guestId }) }))
    for (const f of ['allergens', 'dietaryPrefs', 'dislikes', 'favoriteItems'] as const) {
      expect(typeof g1[f]).toBe('string')
      expect(JSON.parse(g1[f] as string)).toEqual(f === 'allergens' ? ['1', '7'] : f === 'dietaryPrefs' ? ['vegetarijansko'] : f === 'dislikes' ? ['gobe'] : ['Beefsteak'])
    }
    expect(JSON.stringify(g1)).toBe(JSON.stringify(g2))

    // DB: JSONB native (brez dvojnega kodiranja)
    const row = await db.guest.findUnique({ where: { id: guestId } })
    expect(Array.isArray(row?.allergens)).toBe(true)
    expect(row?.allergens).toEqual(['1', '7'])
    expect(Array.isArray(row?.dietaryPrefs)).toBe(true)
  })

  it('happy-hour: POST (native daysOfWeek/appliesToIds) → GET wire STRING ×2; DB NATIVNI arrayi', async () => {
    const postRes = await hhPost(new Request('http://localhost/api/happy-hour', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer integration' },
      body: JSON.stringify({ name: `R150 Happy ura ${RUN_ID}`, priceGroupId: IDS.priceGroup, daysOfWeek: [1, 3], startTime: '02:00', endTime: '04:00', appliesToIds: [IDS.menuItem] }),
    }))
    expect(postRes.status).toBe(201)
    const created = await asJson(postRes)
    const hhId = created.id as string
    expect(typeof hhId).toBe('string') // API generira svoj cuid (ne podeduje IDS.hh)
    expect(typeof created.daysOfWeek).toBe('string')
    expect(typeof created.appliesToIds).toBe('string')

    // GET ×2 — isti urnik, byte-identičen wire
    const h1 = await asJson(await hhGet(new Request('http://localhost/api/happy-hour')))
    const h2 = await asJson(await hhGet(new Request('http://localhost/api/happy-hour')))
    const s1 = (h1.schedules as Array<Record<string, unknown>>).find((s) => s.id === hhId)
    const s2 = (h2.schedules as Array<Record<string, unknown>>).find((s) => s.id === hhId)
    expect(typeof s1?.daysOfWeek).toBe('string')
    expect(JSON.parse(s1!.daysOfWeek as string)).toEqual([1, 3])
    expect(JSON.parse(s1!.appliesToIds as string)).toEqual([IDS.menuItem])
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2))

    // DB: native
    const row = await db.happyHourSchedule.findUnique({ where: { id: hhId } })
    expect(row?.daysOfWeek).toEqual([1, 3])
    expect(row?.appliesToIds).toEqual([IDS.menuItem])
  })

  it('job: POST permissions STRING wire → GET wire STRING ×2 byte-identičen; DB NATIVNI array', async () => {
    const jobName = `R150 Tehnik ${RUN_ID}`
    const postRes = await jobsPost(new Request('http://localhost/api/jobs', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer integration' },
      body: JSON.stringify({ name: jobName, permissions: JSON.stringify(['take_orders', 'view_reports']) }),
    }))
    expect(postRes.status).toBe(201)
    const created = await asJson(postRes)
    expect(typeof created.permissions).toBe('string')
    expect(JSON.parse(created.permissions as string)).toEqual(['take_orders', 'view_reports'])

    // GET ×2 (seznam vseh delovnih mest — filtriram po RUN_ID imenu; private window)
    const j1 = await asJson(await jobsGet(new Request('http://localhost/api/jobs')))
    const j2 = await asJson(await jobsGet(new Request('http://localhost/api/jobs')))
    const mine1 = (j1 as unknown as Array<Record<string, unknown>>).find((j) => j.name === jobName)
    const mine2 = (j2 as unknown as Array<Record<string, unknown>>).find((j) => j.name === jobName)
    expect(mine1).toBeTruthy()
    expect(typeof mine1?.permissions).toBe('string')
    expect(JSON.parse(mine1!.permissions as string)).toEqual(['take_orders', 'view_reports'])
    expect(JSON.stringify(mine1)).toBe(JSON.stringify(mine2))

    // DB: native
    const row = await db.job.findFirst({ where: { name: jobName } })
    expect(Array.isArray(row?.permissions)).toBe(true)
    expect(row?.permissions).toEqual(['take_orders', 'view_reports'])
  })
})

// ============================================
// D. STAFF-PERFORMANCE QUERYABILITY — join prek OrderItemModifier (brez modifiersJson filtra)
// ============================================
describe('R150 D: staff-performance — zaposleni z modifikatorji prek join-exists (upsell 100 %)', () => {
  it('naročilo z join vrsticami → zaposleni v poročilu z upsellRate 100 (orderItemModifiers some join)', async () => {
    const orderId = ORDER_IDS[0]
    expect(orderId).toBeTruthy()
    // Naročilo dokončaj (ordersWithMods query filtrira status 'completed')
    await db.order.update({ where: { id: orderId }, data: { status: 'completed' } })

    const res = await staffPerfGet(new Request('http://localhost/api/staff-performance?period=today'))
    expect(res.status).toBe(200)
    const body = await asJson(res)
    const mine = (body.employees as Array<Record<string, unknown>>).find((e) => e.employeeId === IDS.emp)
    expect(mine).toBeTruthy()
    // Queryability točka B iz issue-a #33: metrika izhaja iz OrderItemModifier join-exists
    // (`orderItems: { some: { orderItemModifiers: { some: {} } } }`) — NE iz string filtra
    // na legacy modifiersJson (ta na JSONB ne dela in je odstranjen).
    expect(mine!.totalOrders).toBe(1) // private window: edino naročilo mojega zaposlenega na mojo lokacijo
    expect(mine!.upsellRate).toBe(100) // 1 od 1 naročil ima modifikatorje
  })
})

// ============================================
// E. TOLERANTNA BRANJA — OPOMBA (ni testa)
// ============================================
// Malformed legacy string na migriranem stolpcu je na JSONB bazi NEMOGOČ po
// konstrukciji (Postgres jsonb tip zavrže neveljaven JSON že pri zapisu;
// 0022 USING cast je fail-closed — malformed abortira migracijo). Tolerantna
// plast za Legacy STRING vhode (pred migracijo / wire string) je pokrita v:
//   • tests/unit/lib/json-fields.test.ts  (parse* JsonFieldInput-toleranca)
//   • tests/unit/api/r150-json-fields.test.ts sekcija B (malformed vrstice v trap-DB)
// Zato tu NAMERNO ni 'malformed' testa — na jsonb stolpcu ne more nastati.

// ============================================
// F. AUTH KANON — 401 brez seje, 403 regular user brez lokacije
// ============================================
describe('R150 F: auth kanon na JSONB-aficiranih routah', () => {
  it('POST /api/orders brez seje → 401 (fail-closed, nikoli kreacija)', async () => {
    authRef.current = null
    try {
      const res = await ordersPost(new Request('http://localhost/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer integration' },
        body: JSON.stringify({ type: 'dine-in', orderItems: [{ menuItemId: IDS.menuItem, quantity: 1 }] }),
      }))
      expect(res.status).toBe(401)
    } finally {
      authRef.current = { employeeId: IDS.emp, role: 'admin', locationId: IDS.locA, permissions: ['admin'] }
    }
    // Nič ni nastalo (fail-closed brez stranskih učinkov)
    expect(await db.order.count({ where: { employeeId: IDS.emp, status: 'pending' } })).toBe(0)
  })

  it('POST /api/guests: regular (manager) brez dodeljene lokacije → 403 resolveTenantLocationIdOrThrow (JSONB PII polja nikoli ne nastanejo)', async () => {
    authRef.current = { employeeId: IDS.emp, role: 'manager', locationId: null, permissions: ['take_orders'] }
    try {
      const res = await guestsPost(new Request('http://localhost/api/guests', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer integration' },
        body: JSON.stringify({ lastName: `R150 Scope ${RUN_ID}`, allergens: ['1'] }),
      }))
      expect(res.status).toBe(403)
      const body = await asJson(res)
      expect(typeof body.error).toBe('string')
    } finally {
      authRef.current = { employeeId: IDS.emp, role: 'admin', locationId: IDS.locA, permissions: ['admin'] }
    }
    // Fail-closed: noben gost z mojim RUN_ID žigom ni nastal
    expect(await db.guest.count({ where: { lastName: { contains: `R150 Scope ${RUN_ID}` } } })).toBe(0)
  })
})
