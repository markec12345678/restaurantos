// @vitest-environment node
// ============================================
// R128 / EPIC #115 P0-5 — INTEGRACIJA: OFFLINE EXACTLY-ONCE (prava DB)
// ============================================
// Dokaz na pravi bazi (PGlite na izoliranem PGLITE_DATA_DIR; CI: Postgres):
//   (a) dve operaciji z ISTIM idempotencyKey prek POST /api/orders z
//       različnimi device headerji → TOČNO eno naročilo (domenska
//       idempotencija ostane avtoritativna; ledger ack za vsako napravo)
//   (b) device-sync isti clientOperationId 2× → applied nato duplicate
//       (replay brez re-aplikacije), eno naročilo, ENA ledger vrstica
//   (c) order.create z zalogo → preklic prek device-sync → zaloga vrnjena
//       TOČNO enkrat (StockTransaction 'return' count == 1) + drugi preklic
//       → duplicate (brez dodatnega vračila)
//   (d) payments POST z x-offline-sync → 422 fail-closed
//   (e) tenant fail-closed: naprava vezana na lokacijo A, seja na lokaciji
//       B → 403 DEVICE_LOCATION_MISMATCH
//
// Opomba: auth-middleware (requireAuth) je mockan na MEJI (realna session
// struktura) — token verify ima svoje unit teste; VSE ostalo (route,
// delegati, idempotencija, zaloga, advisory locki) je REALNO nad PGlite.
// Zagon: node scripts/init-pglite.mjs (PGLITE_DATA_DIR=/tmp/pglite-data-it)
//        → vitest run --config vitest.config.integration.ts <file>
// ============================================

import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'

// KLJUČNO: tests/setup.ts globalno mock-ira @/lib/db — tu želimo PRAVEGA klienta.
vi.unmock('@/lib/db')

// Auth na meji: realna session struktura, ki jo testa nastavljajo per primer.
const authRef = vi.hoisted(() => ({
  current: null as null | {
    employeeId: string
    role: string
    locationId: string | null
    permissions: string[]
  },
}))

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
        : {
            session: null,
            // Strukturno zadostuje NextResponse (route vrne error direktno)
            error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna.' }), { status: 401 }),
          },
    // resolveTenantLocationId / resolveTenantLocationIdOrThrow ostanejo REALNI
  }
})

import { db } from '@/lib/db'
import { POST as ordersPost } from '@/app/api/orders/route'
import { POST as paymentsPost } from '@/app/api/payments/route'
import { POST as deviceSyncPost } from '@/app/api/device-sync/route'

const RUN_ID = `r128-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// ---------- Seed ID-ji (FK veriga: Location → Menu → Category → MenuItem → InventoryItem) ----------
const IDS = {
  locationA: `${RUN_ID}-loc-a`,
  locationB: `${RUN_ID}-loc-b`,
  employee: `${RUN_ID}-emp`,
  menu: `${RUN_ID}-menu`,
  category: `${RUN_ID}-cat`,
  menuItem: `${RUN_ID}-item`,
  inventory: `${RUN_ID}-inv`,
  deviceMismatch: `${RUN_ID}-dev-mismatch`,
}

const DEVICE_1 = `${RUN_ID}-dev-1` // >= 8 znakov, [A-Za-z0-9_-]
const DEVICE_2 = `${RUN_ID}-dev-2`
const OP_A = `${RUN_ID}-op-a`
const OP_B = `${RUN_ID}-op-b`
const OP_C1 = `${RUN_ID}-op-c1`
const OP_C2 = `${RUN_ID}-op-c2`
const OP_C3 = `${RUN_ID}-op-c3`

const IDEM_A = `${RUN_ID}-key-a`
const IDEM_C = `${RUN_ID}-key-c`

async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

beforeAll(async () => {
  // Lokaciji A in B (code + premisesId so @unique — RUN-ID sufiks)
  await db.location.create({ data: { id: IDS.locationA, name: 'R128 Lokacija A', code: `${RUN_ID}-A`, premisesId: `${RUN_ID}-pa`, isActive: true } })
  await db.location.create({ data: { id: IDS.locationB, name: 'R128 Lokacija B', code: `${RUN_ID}-B`, premisesId: `${RUN_ID}-pb`, isActive: true } })

  // Zaposleni na lokaciji A (route POST /api/orders preveri status 'active')
  await db.employee.create({
    data: {
      id: IDS.employee,
      name: 'R128 Test Natakar',
      email: `${RUN_ID}@r128-test.local`,
      role: 'manager',
      status: 'active',
      locationId: IDS.locationA,
    },
  })

  // Katalog MODEL A: Menu → Category → MenuItem (lokacija A)
  await db.menu.create({ data: { id: IDS.menu, name: `R128 Meni ${RUN_ID}`, locationId: IDS.locationA } })
  await db.category.create({ data: { id: IDS.category, name: `R128 Kat ${RUN_ID}`, menuId: IDS.menu } })
  await db.menuItem.create({ data: { id: IDS.menuItem, name: 'R128 Test Pivo', price: 3.5, categoryId: IDS.category, vatRate: 9.5 } })

  // Zaloga 1:1 link (brez recepture — deductDirect pot): 100 enot, 1 servirka/enoto
  await db.inventoryItem.create({
    data: {
      id: IDS.inventory,
      name: 'R128 Test Pivo (zaloga)',
      quantity: 100,
      minQuantity: 5,
      costPerUnit: 1.5,
      servingsPerUnit: 1,
      menuItemId: IDS.menuItem,
      locationId: IDS.locationA,
    },
  })

  // Naprava vezana na lokacijo A (primer e)
  await db.deviceRegistry.create({
    data: { id: IDS.deviceMismatch, deviceId: DEVICE_1, name: 'POS-A', type: 'pos', locationId: IDS.locationA, status: 'offline' },
  })

  // Privzeta seja: manager lokacije A
  authRef.current = { employeeId: IDS.employee, role: 'manager', locationId: IDS.locationA, permissions: ['take_orders'] }
})

afterAll(async () => {
  // Čiščenje po FK redu (DeviceSyncOperation ima Restrict FK na Location!)
  await db.deviceSyncOperation.deleteMany({ where: { deviceId: { in: [DEVICE_1, DEVICE_2] } } }).catch(() => {})
  await db.stockTransaction.deleteMany({ where: { inventoryItemId: IDS.inventory } }).catch(() => {})
  await db.order.deleteMany({ where: { idempotencyKey: { in: [IDEM_A, IDEM_C] } } }).catch(() => {})
  await db.deviceRegistry.deleteMany({ where: { deviceId: { in: [DEVICE_1, DEVICE_2] } } }).catch(() => {})
  await db.inventoryItem.deleteMany({ where: { id: IDS.inventory } }).catch(() => {})
  await db.menuItem.deleteMany({ where: { id: IDS.menuItem } }).catch(() => {})
  await db.category.deleteMany({ where: { id: IDS.category } }).catch(() => {})
  await db.menu.deleteMany({ where: { id: IDS.menu } }).catch(() => {})
  await db.employee.deleteMany({ where: { id: IDS.employee } }).catch(() => {})
  await db.location.deleteMany({ where: { id: { in: [IDS.locationA, IDS.locationB] } } }).catch(() => {})
  await db.$disconnect().catch(() => {})
})

// ---------- Helperji ----------
function ordersRequest(headers: Record<string, string>, body: unknown) {
  return new Request('http://local/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer integration', ...headers },
    body: JSON.stringify(body),
  })
}

function deviceSyncRequest(body: unknown) {
  return new Request('http://local/api/device-sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer integration' },
    body: JSON.stringify(body),
  })
}

function createPayload(idempotencyKey: string, quantity = 2) {
  return {
    type: 'dine-in',
    orderItems: [{ menuItemId: IDS.menuItem, quantity }],
    idempotencyKey,
  }
}

// ============================================
// (a) DVE NAPRAVI, ISTI idempotencyKey → TOČNO ENO naročilo
// ============================================
describe('R128 integracija (a): cross-device idempotencija po one-by-one poti', () => {
  it('POST /api/orders 2× z istim idempotencyKey, različnima device headerjema → 1 naročilo + 2 ledger vrstici (applied + duplicate)', async () => {
    const r1 = await ordersPost(
      ordersRequest({ 'x-offline-sync': 'true', 'x-device-id': DEVICE_1, 'x-client-operation-id': OP_A }, createPayload(IDEM_A)),
    )
    expect(r1.status).toBe(201)
    console.log('[DBG a1]', (await db.inventoryItem.findUnique({ where: { id: IDS.inventory } }))?.quantity)

    const r2 = await ordersPost(
      ordersRequest({ 'x-offline-sync': 'true', 'x-device-id': DEVICE_2, 'x-client-operation-id': OP_B }, createPayload(IDEM_A)),
    )
    expect(r2.status).toBe(200) // idempotency fast-path replay
    console.log('[DBG a2]', (await db.inventoryItem.findUnique({ where: { id: IDS.inventory } }))?.quantity)

    // TOČNO eno naročilo za ta ključ
    const orderCount = await db.order.count({ where: { idempotencyKey: IDEM_A } })
    expect(orderCount).toBe(1)

    // Ledger: vsaka (naprava, operacija) svoja vrstica — applied + duplicate ack
    const ledgerRows = await db.deviceSyncOperation.findMany({
      where: { deviceId: { in: [DEVICE_1, DEVICE_2] }, clientOperationId: { in: [OP_A, OP_B] } },
      orderBy: { receivedAt: 'asc' },
    })
    expect(ledgerRows).toHaveLength(2)
    const statuses = ledgerRows.map((r) => r.status).sort()
    expect(statuses).toEqual(['applied', 'duplicate'])
    // Obe vrstici kažeta NA ISTO naročilo (exactly-once dokaz)
    const order = await db.order.findFirst({ where: { idempotencyKey: IDEM_A } })
    expect(order).not.toBeNull()
    for (const row of ledgerRows) {
      expect(row.orderId).toBe(order!.id)
      expect(row.operationType).toBe('order.create')
    }
  })
})

// ============================================
// (b) DEVICE-SYNC isti clientOperationId 2× → applied, nato duplicate
// ============================================
describe('R128 integracija (b): device-sync replay isti clientOperationId', () => {
  it('prvi batch applied, drugi duplicate (replay), 1 naročilo, 1 ledger vrstica', async () => {
    const batch = {
      deviceId: DEVICE_2,
      operations: [{ clientOperationId: OP_C1, type: 'order.create', payload: createPayload(IDEM_C) }],
    }

    const r1 = await deviceSyncPost(deviceSyncRequest(batch))
    expect(r1.status).toBe(200)
    const b1 = await asJson(r1)
    expect(b1.appliedCount).toBe(1)
    const res1 = (b1.results as Array<Record<string, unknown>>)[0]
    expect(res1.status).toBe('applied')
    expect(typeof res1.orderId).toBe('string')
    expect(res1.data).toBeTruthy() // delegat body (naročilo)
    console.log('[DBG b1]', (await db.inventoryItem.findUnique({ where: { id: IDS.inventory } }))?.quantity, 'res1.status=', res1.status)

    const r2 = await deviceSyncPost(deviceSyncRequest(batch))
    expect(r2.status).toBe(200)
    const b2 = await asJson(r2)
    expect(b2.duplicateCount).toBe(1)
    const res2 = (b2.results as Array<Record<string, unknown>>)[0]
    expect(res2.status).toBe('duplicate')
    expect(res2.replay).toBe(true)
    expect(res2.orderId).toBe(res1.orderId)

    // Ena naročilo, ENA ledger vrstica (composite unique na (deviceId, clientOperationId))
    expect(await db.order.count({ where: { idempotencyKey: IDEM_C } })).toBe(1)
    expect(await db.deviceSyncOperation.count({ where: { deviceId: DEVICE_2, clientOperationId: OP_C1 } })).toBe(1)
    // Ledger ack vsebuje replay dokaz
    const row = await db.deviceSyncOperation.findUnique({
      where: { deviceId_clientOperationId: { deviceId: DEVICE_2, clientOperationId: OP_C1 } },
    })
    expect(row!.status).toBe('applied') // PRVI zapis ostane applied
    expect(row!.orderId).toBe(res1.orderId)
  })
})

// ============================================
// (c) ZALOGA: create → cancel prek device-sync → return TOČNO 1×
// ============================================
describe('R128 integracija (c): odprema + preklic z zalogo (exactly-once return)', () => {
  it('sale 1×, return 1×, drugi preklic → duplicate brez dodatnega vračila', async () => {
    // Zaloga je deljena z (a)/(b) primeri — uporabi RELATIVNE trditve (delta ±2).
    // Baseline se bere PRED odpremo (delta -2 se pričakuje ŠELE ob prodaji).
    const invBeforeSale = await db.inventoryItem.findUnique({ where: { id: IDS.inventory } })
    const qtyBeforeSale = Number(invBeforeSale!.quantity)

    // 1) Naročilo z 2× pivo (qtyBeforeSale → qtyBeforeSale - 2)
    const rCreate = await deviceSyncPost(deviceSyncRequest({
      deviceId: DEVICE_2,
      operations: [{ clientOperationId: OP_C2, type: 'order.create', payload: createPayload(`${IDEM_C}-stock`) }],
    }))
    expect(rCreate.status).toBe(200)
    const bCreate = await asJson(rCreate)
    expect(bCreate.appliedCount).toBe(1)
    const orderId = ((bCreate.results as Array<Record<string, unknown>>)[0].orderId) as string

    const invAfterSale = await db.inventoryItem.findUnique({ where: { id: IDS.inventory } })
    expect(Number(invAfterSale!.quantity)).toBe(qtyBeforeSale - 2)
    const saleCount = await db.stockTransaction.count({ where: { inventoryItemId: IDS.inventory, orderId, type: 'sale' } })
    expect(saleCount).toBe(1)

    // 2) Preklic prek device-sync → applied + vračilo zaloge (98 → 100)
    const rCancel = await deviceSyncPost(deviceSyncRequest({
      deviceId: DEVICE_2,
      operations: [{ clientOperationId: OP_C3, type: 'order.cancel', payload: { orderId, reason: 'R128 offline preklic' } }],
    }))
    expect(rCancel.status).toBe(200)
    const bCancel = await asJson(rCancel)
    expect(bCancel.appliedCount).toBe(1)

    const invAfterReturn = await db.inventoryItem.findUnique({ where: { id: IDS.inventory } })
    expect(Number(invAfterReturn!.quantity)).toBe(qtyBeforeSale)
    expect(await db.stockTransaction.count({ where: { inventoryItemId: IDS.inventory, orderId, type: 'return' } })).toBe(1)

    // 3) Drugi preklic (nov clientOperationId) → duplicate, zaloga NESPREMENJENA
    const rCancel2 = await deviceSyncPost(deviceSyncRequest({
      deviceId: DEVICE_2,
      operations: [{ clientOperationId: `${RUN_ID}-op-c4`, type: 'order.cancel', payload: { orderId } }],
    }))
    expect(rCancel2.status).toBe(200)
    const bCancel2 = await asJson(rCancel2)
    expect(bCancel2.duplicateCount).toBe(1)

    expect(Number((await db.inventoryItem.findUnique({ where: { id: IDS.inventory } }))!.quantity)).toBe(qtyBeforeSale)
    expect(await db.stockTransaction.count({ where: { inventoryItemId: IDS.inventory, orderId, type: 'return' } })).toBe(1)
    // Ledger: applied + duplicate za preklica
    expect(await db.deviceSyncOperation.count({ where: { deviceId: DEVICE_2, clientOperationId: OP_C3, status: 'applied' } })).toBe(1)
    expect(await db.deviceSyncOperation.count({ where: { deviceId: DEVICE_2, clientOperationId: `${RUN_ID}-op-c4`, status: 'duplicate' } })).toBe(1)
  })
})

// ============================================
// (d) PAYMENTS offline guard → 422
// ============================================
describe('R128 integracija (d): plačila offline zavrnjena', () => {
  it('x-offline-sync: true → 422 PAYMENT_OFFLINE_NOT_ALLOWED (fail-closed pred auth)', async () => {
    const res = await paymentsPost(
      new Request('http://local/api/payments', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-offline-sync': 'true' },
        body: '{}',
      }),
    )
    expect(res.status).toBe(422)
    const body = await asJson(res)
    expect(body.error).toBe('PAYMENT_OFFLINE_NOT_ALLOWED')
  })
})

// ============================================
// (e) TENANT FAIL-CLOSED: naprava lokacija A, seja lokacija B → 403
// ============================================
describe('R128 integracija (e): DEVICE_LOCATION_MISMATCH', () => {
  it('naprava vezana na lokacijo A + seja lokacije B → 403, nič ne se aplicira', async () => {
    const beforeOrders = await db.order.count()
    const beforeLedger = await db.deviceSyncOperation.count()

    authRef.current = { employeeId: IDS.employee, role: 'manager', locationId: IDS.locationB, permissions: ['take_orders'] }
    try {
      const res = await deviceSyncPost(deviceSyncRequest({
        deviceId: DEVICE_1, // vezana na lokacijo A (beforeAll)
        operations: [{ clientOperationId: `${RUN_ID}-op-e`, type: 'order.create', payload: createPayload(`${IDEM_A}-mismatch`) }],
      }))
      expect(res.status).toBe(403)
      const body = await asJson(res)
      expect(body.error).toBe('DEVICE_LOCATION_MISMATCH')
    } finally {
      authRef.current = { employeeId: IDS.employee, role: 'manager', locationId: IDS.locationA, permissions: ['take_orders'] }
    }

    // Nič novih naročil / ledger vrstic (fail-closed brez stranskih učinkov)
    expect(await db.order.count()).toBe(beforeOrders)
    expect(await db.deviceSyncOperation.count()).toBe(beforeLedger)
  })
})
