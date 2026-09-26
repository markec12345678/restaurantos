// @vitest-environment node
// ============================================
// R135 / EPIC #115 P1-11 — INTEGRACIJA: KIOSK order → plačilo → zaloga → KDS
// ============================================
// Canon P1-11 na pravi bazi (PGlite, izoliran PGLITE_DATA_DIR):
//   (a) GET /api/public/kiosk → meni z modifierGroups + stockStatus (sold-out
//       propagation), scoped na lokacijo
//   (b) POST kiosk (kartica) → 201 + order (paymentMethod 'kartica',
//       inventoryDeducted: true, notes marker) + Check (unpaid, card) +
//       Payment (pending, card) + odbitek zaloge po recepturi (RAW = usable /
//       yield%) + StockTransaction 'sale' ledger + DeviceRegistry 'kiosk'
//   (c) idempotent replay → 200 brez duplikata
//   (d) token vezava: token TUJE lokacije → 404 notInScope (zero pisnih)
//   (e) zaprta restavracija (brez urnika) → 403 fail-closed
//   (f) KDS routing: GET /api/kitchen vidi kiosk naročilo (status pending,
//       scoped na lokacijo)
//
// Zagon: node scripts/init-pglite.mjs (PGLITE_DATA_DIR=/tmp/pglite-data-it)
//        → vitest run --config vitest.config.integration.ts <file>
// ============================================

import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'

vi.unmock('@/lib/db')

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
        : { session: null, error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna.' }), { status: 401 }) },
  }
})

import { db } from '@/lib/db'
import { GET as kioskGET, POST as kioskPOST } from '@/app/api/public/kiosk/route'
import { GET as kitchenGET } from '@/app/api/kitchen/route'
import { orderingTokenFor } from '@/lib/ordering-token'

const RUN_ID = `r135-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const DAY_MS = 86_400_000
// locationId MORA ustrezati kiosk regexu /^[a-z0-9]{5,50}$/i (BREZ vezajev —
// route validira obliko PREJ kot DB poizvedbo, R86-3 kanon)
const LOC_BASE = `r135${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
const IDS = {
  locationA: `${LOC_BASE}a`,
  locationB: `${LOC_BASE}b`,
  employee: `${RUN_ID}-emp`,
  menu: `${RUN_ID}-menu`,
  category: `${RUN_ID}-cat`,
  menuItem: `${RUN_ID}-item`,
  inventory: `${RUN_ID}-inv`,
  recipe: `${RUN_ID}-recipe`,
  modifierGroup: `${RUN_ID}-mg`,
  modifier: `${RUN_ID}-mod`,
}

const TOKEN_A = orderingTokenFor(IDS.locationA, 0)
const TOKEN_B = orderingTokenFor(IDS.locationB, 0)

async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

function kioskPost(body: Record<string, unknown>, locationId: string): Promise<Response> {
  return kioskPOST(new Request(`http://x/api/public/kiosk?locationId=${locationId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

beforeAll(async () => {
  await db.location.create({ data: { id: IDS.locationA, name: 'R135 Kiosk Lokacija', code: `${RUN_ID}-A`, premisesId: `${RUN_ID}-pa`, isActive: true } })
  await db.location.create({ data: { id: IDS.locationB, name: 'R135 Tuja Lokacija', code: `${RUN_ID}-B`, premisesId: `${RUN_ID}-pb`, isActive: true } })
  await db.employee.create({
    data: { id: IDS.employee, name: 'R135 Kuhar', email: `${RUN_ID}@r135-test.local`, role: 'admin', status: 'active', locationId: IDS.locationA },
  })
  await db.menu.create({ data: { id: IDS.menu, name: `R135 Meni ${RUN_ID}`, locationId: IDS.locationA, isActive: true } })
  await db.category.create({ data: { id: IDS.category, name: `R135 Kat ${RUN_ID}`, menuId: IDS.menu } })
  await db.menuItem.create({ data: { id: IDS.menuItem, name: 'R135 Espresso', price: 2, categoryId: IDS.category, vatRate: 22, isAvailable: true } })

  // Receptura: 18 g na porcijo, yield 100% → RAW = usable
  await db.inventoryItem.create({
    data: {
      id: IDS.inventory,
      name: 'R135 Kava (zaloga)',
      quantity: 100,
      minQuantity: 5,
      costPerUnit: 8,
      unit: 'kg',
      menuItemId: IDS.menuItem,
      locationId: IDS.locationA,
    },
  })
  await db.recipeItem.create({
    data: {
      id: IDS.recipe,
      menuItemId: IDS.menuItem,
      inventoryItemId: IDS.inventory,
      quantityPerServing: 0.018,
      yieldPercent: 100,
      unit: 'kg',
    },
  })

  // Modifierji (P1-11: kiosk mora ponuditi dodatke) — MODEL A: po lokaciji
  await db.modifierGroup.create({ data: { id: IDS.modifierGroup, name: 'Dodatki', locationId: IDS.locationA } })
  await db.modifier.create({ data: { id: IDS.modifier, name: 'Extra shot', price: 0.5, modifierGroupId: IDS.modifierGroup, isAvailable: true } })
  await db.menuItemModifierGroup.create({ data: { menuItemId: IDS.menuItem, modifierGroupId: IDS.modifierGroup } })

  // Urnik: danes odprto 00:00–23:59 (lokacija A); lokacija B BREZ urnika = zaprto
  await db.openingHours.create({
    data: { dayOfWeek: new Date().getDay(), openTime: '00:00', closeTime: '23:59', locationId: IDS.locationA },
  })

  authRef.current = { employeeId: IDS.employee, role: 'admin', locationId: IDS.locationA, permissions: ['take_orders'] }
})

afterAll(async () => {
  // Čiščenje po FK redu
  await db.stockTransaction.deleteMany({ where: { inventoryItemId: IDS.inventory } }).catch(() => {})
  const orders = await db.order.findMany({ where: { locationId: IDS.locationA }, select: { id: true } }).catch(() => [])
  for (const o of orders) {
    const checks = await db.check.findMany({ where: { orderId: o.id }, select: { id: true } }).catch(() => [])
    for (const c of checks) {
      await db.payment.deleteMany({ where: { checkId: c.id } }).catch(() => {})
    }
    await db.check.deleteMany({ where: { orderId: o.id } }).catch(() => {})
    await db.orderItem.deleteMany({ where: { orderId: o.id } }).catch(() => {})
    await db.order.delete({ where: { id: o.id } }).catch(() => {})
  }
  await db.deviceRegistry.deleteMany({ where: { locationId: IDS.locationA } }).catch(() => {})
  await db.menuItemModifierGroup.deleteMany({ where: { menuItemId: IDS.menuItem } }).catch(() => {})
  await db.modifier.deleteMany({ where: { modifierGroupId: IDS.modifierGroup } }).catch(() => {})
  await db.modifierGroup.deleteMany({ where: { id: IDS.modifierGroup } }).catch(() => {})
  await db.recipeItem.deleteMany({ where: { id: IDS.recipe } }).catch(() => {})
  await db.inventoryItem.deleteMany({ where: { id: IDS.inventory } }).catch(() => {})
  await db.openingHours.deleteMany({ where: { locationId: IDS.locationA } }).catch(() => {})
  await db.menuItem.deleteMany({ where: { id: IDS.menuItem } }).catch(() => {})
  await db.category.deleteMany({ where: { id: IDS.category } }).catch(() => {})
  await db.menu.deleteMany({ where: { id: IDS.menu } }).catch(() => {})
  await db.employee.deleteMany({ where: { id: IDS.employee } }).catch(() => {})
  await db.location.deleteMany({ where: { id: { in: [IDS.locationA, IDS.locationB] } } }).catch(() => {})
})

describe('R135 P1-11: kiosk end-to-end (prava PGlite)', () => {
  it('GET: meni scoped na lokacijo + modifierGroups + stockStatus', async () => {
    const res = await kioskGET(new Request(`http://x/api/public/kiosk?locationId=${IDS.locationA}`))
    expect(res.status).toBe(200)
    const body = await asJson(res) as {
      menus: Array<{ categories: Array<{ menuItems: Array<{
        name: string; stockStatus: string
        modifierGroups: Array<{ modifierGroup: { name: string; modifiers: Array<{ name: string; price: number }> } }>
      }> }> }>
    }
    const items = body.menus[0].categories[0].menuItems
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('R135 Espresso')
    expect(items[0].stockStatus).toBe('ok')
    // P1-11: dodatki so vidni kiosku (z DB cenami)
    expect(items[0].modifierGroups[0].modifierGroup.name).toBe('Dodatki')
    expect(items[0].modifierGroups[0].modifierGroup.modifiers[0]).toMatchObject({ name: 'Extra shot', price: 0.5 })
  })

  it('POST kartica: 201 + order + Check + Payment pending + odbitek zaloge + ledger + DeviceRegistry', async () => {
    const mods = JSON.stringify([{ name: 'Extra shot', price: 0.5 }])
    const res = await kioskPost({
      orderItems: [{ menuItemId: IDS.menuItem, quantity: 1, notes: '', modifiersJson: mods }],
      diningOption: 'takeout',
      paymentMethod: 'card',
      orderingToken: TOKEN_A,
      deviceId: 'kiosk-it-001',
      idempotencyKey: `${RUN_ID}-k1`,
    }, IDS.locationA)
    expect(res.status).toBe(201)
    const body = await asJson(res) as { success: boolean; orderNumber: number; total: number; paymentMethod: string }
    expect(body.success).toBe(true)
    expect(body.paymentMethod).toBe('kartica')
    // kanonični izračun: (2 + 0.5) × 1.22 = 3.05 (NETO × (1+DDV), ROUND_HALF_UP)
    expect(body.total).toBe(3.05)

    const order = await db.order.findFirst({ where: { idempotencyKey: `${RUN_ID}-k1` }, include: { orderItems: true } })
    expect(order).not.toBeNull()
    expect(order!.paymentMethod).toBe('kartica')
    expect(order!.paymentStatus).toBe('unpaid')
    expect(order!.inventoryDeducted).toBe(true)
    expect(order!.locationId).toBe(IDS.locationA)
    expect(order!.notes).toContain('Kiosk naročilo')
    expect(order!.orderItems[0].checkId).not.toBeNull()

    // Check (unpaid, card, checkNumber) + Payment (pending, card)
    const check = await db.check.findFirst({ where: { orderId: order!.id } })
    expect(check).not.toBeNull()
    expect(check!.paymentStatus).toBe('unpaid')
    expect(check!.paymentMethod).toBe('card')
    expect(Number(check!.total)).toBe(3.05)
    const payment = await db.payment.findFirst({ where: { checkId: check!.id } })
    expect(payment).not.toBeNull()
    expect(payment!.status).toBe('pending')
    expect(payment!.type).toBe('card')
    expect(Number(payment!.amount)).toBe(3.05)

    // Zaloga: 100 kg − RAW 0.018 kg = 99.982 kg (yield 100%)
    const inv = await db.inventoryItem.findUnique({ where: { id: IDS.inventory } })
    expect(Number(inv!.quantity)).toBeCloseTo(99.982, 3)
    // Ledger: 'sale' vrstica z referenco naročila
    const ledger = await db.stockTransaction.findFirst({ where: { inventoryItemId: IDS.inventory, type: 'sale' }, orderBy: { createdAt: 'desc' } })
    expect(ledger).not.toBeNull()
    expect(Number(ledger!.quantity)).toBeCloseTo(-0.018, 3)
    expect(ledger!.reason).toContain(`#${order!.orderNumber}`)

    // DeviceRegistry vezava (type 'kiosk', status online, lokacija)
    const device = await db.deviceRegistry.findUnique({ where: { deviceId: 'kiosk-it-001' } })
    expect(device).not.toBeNull()
    expect(device!.type).toBe('kiosk')
    expect(device!.status).toBe('online')
    expect(device!.locationId).toBe(IDS.locationA)
  })

  it('idempotent replay: isti ključ → 200 replay + NIKOLI drugo naročilo', async () => {
    const res = await kioskPost({
      orderItems: [{ menuItemId: IDS.menuItem, quantity: 1, notes: '' }],
      diningOption: 'takeout',
      paymentMethod: 'card',
      orderingToken: TOKEN_A,
      idempotencyKey: `${RUN_ID}-k1`,
    }, IDS.locationA)
    expect(res.status).toBe(200)
    const body = await asJson(res) as { idempotentReplay: boolean }
    expect(body.idempotentReplay).toBe(true)
    const count = await db.order.count({ where: { idempotencyKey: `${RUN_ID}-k1` } })
    expect(count).toBe(1)
  })

  it('token vezava: token TUJE lokacije → 404 notInScope + zero pisnih klicev', async () => {
    const before = await db.order.count({ where: { locationId: IDS.locationA } })
    const res = await kioskPost({
      orderItems: [{ menuItemId: IDS.menuItem, quantity: 1, notes: '' }],
      orderingToken: TOKEN_B,
    }, IDS.locationA)
    expect(res.status).toBe(404)
    const after = await db.order.count({ where: { locationId: IDS.locationA } })
    expect(after).toBe(before)
  })

  it('zaprta restavracija (brez urnika) → 403 fail-closed', async () => {
    const res = await kioskPost({
      orderItems: [{ menuItemId: IDS.menuItem, quantity: 1, notes: '' }],
      orderingToken: TOKEN_B,
      // token velja za lokacijo B — POST naslovimo na B (urnika nima → zaprto)
    }, IDS.locationB)
    expect(res.status).toBe(403)
    const body = await asJson(res) as { error: string }
    expect(body.error).toBe('Restavracija je trenutno zaprta. Naročila niso mogoča.')
  })

  it('KDS routing: GET /api/kitchen vidi kiosk naročilo (status pending, scoped)', async () => {
    const res = await kitchenGET(new Request('http://x/api/kitchen'))
    expect(res.status).toBe(200)
    const body = await asJson(res) as { orders: Array<{ orderNumber: number; status: string; locationId: string; totalItems: number }> }
    const placed = await db.order.findFirst({ where: { idempotencyKey: `${RUN_ID}-k1` } })
    expect(placed).not.toBeNull()
    const kioskOrder = body.orders.find(o => o.orderNumber === placed!.orderNumber)
    expect(kioskOrder).toBeDefined()
    expect(kioskOrder!.status).toBe('pending')
    expect(kioskOrder!.locationId).toBe(IDS.locationA)
  })

  it('rotiran token (tokenVersion++) → 404 (revokacija vseh starih kioskov)', async () => {
    await db.location.update({ where: { id: IDS.locationB }, data: { tokenVersion: 1 } })
    const res = await kioskPost({
      orderItems: [{ menuItemId: IDS.menuItem, quantity: 1, notes: '' }],
      orderingToken: TOKEN_B,
    }, IDS.locationB)
    expect(res.status).toBe(404)
  })
})
