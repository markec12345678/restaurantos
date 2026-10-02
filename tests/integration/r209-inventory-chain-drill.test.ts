// @vitest-environment node
// ============================================
// R209 / ISSUE #152 korak 1 — INTEGRACIJA: ZALOGOVNO-POSLOVNA VERIGA
// PROCUREMENT → STOCK → RECIPE → CONSUMPTION → WASTE / STOCKTAKE → COGS → REPORT
// (prava PGlite, pravi route handlerji)
// ============================================
// Repo-backed dokazi za issue #152 korak 1 (§5 exact-once + §6 sale→recipe→
// stock→COGS + §19 inventory↔financial reconciliation + §21 database-state
// verification + §22 scenarija A/B/D/E/H/I — implementirana podmnožica):
//
//   VERIGA B (prevzem)     — restock z serijami (lot + expiry): InventoryBatch
//                            nastane, StockTx 'procurement', FEFO bralna baza
//   VERIGA A (prodaja)     — POST /api/orders 20 × pica (recept: usable 0.25
//                            kg/servis @ yield 50 %) → RAW odvod 10 kg;
//                            StockTx 'sale' (quantity −10, totalCost 45.00,
//                            cost snapshot ob odvodnem trenutku) + FEFO
//                            razknjižba po odlagi (§22-H): LOT-B (expires
//                            prej) 8 → 0/EXHAUSTED, LOT-A 2
//   §5 EXACT-ONCE (nar.)   — replay idempotencyKey → 200 ISTI order, EN
//                            zalogovni efekt (fast-path PRED deduction)
//   VERIGA I (razprodano)  — (a) naročilo čez zalogo → 409 + soldOutItems,
//                            NI naročila NI odvoda (fail-closed R124);
//                            (b) allowOutOfStock → order obstane, pogojni
//                            decrement FAILA → attempt vrstica qty 0,
//                            totalCost 0, zaloga NE gre negativno (kanon)
//   VERIGA A (plačilo)     — check + cash → paid; Σ(completed) == total
//                            (§19 prihodkovna stran verige)
//   VERIGA B (PO prevzem)  — PO → receive → zaloga +5 L, StockTx
//                            'procurement' 60.00, GRN dokument + linije,
//                            SupplierPriceHistory (source goods_receipt),
//                            PO → 'received'
//   §5 EXACT-ONCE (prevzem)— duplicate receive → 400 'že popolnoma prejeto',
//                            EN efekt (zaloga/GRN/PH nespremenjeni)
//   R212 G7 (idempot. prevzem) — klientov idempotencyKey (R116 kanon):
//                            partial receive z ključem → replay ISTEGA ključa
//                            → 200 ISTI GRN, ZERO nov efekt; replay po
//                            terminalnem statusu → 200 (ne 400); cap-check +
//                            legacy no-key pot BIT-FOR-BIT nespremenjena
//   VERIGA D (odpad)       — POST /api/waste → write-off StockTx 6.00 +
//                            WasteRecord snapshot + audit WASTE_CREATE;
//                            replay idempotencyKey → ISTA vrstica (replay:
//                            true), EN efekt; reverse → kompenzacijski
//                            'return' s snapshot ceno; double reverse → 409
//   VERIGA E (inventura)   — create (snapshot) → count → submit → approve:
//                            CAS claim + absolutna nastavitev skozi zalogovni
//                            kanon → write-off 9.00 + FEFO razknjižba + link
//                            line.stockTransactionId; double approve → 409
//   §19/§21 REKONCILIACIJA — GET /api/reports/eod: cogs == Σ|totalCost|
//                            ('sale') == 45.00, procurementCost == 285.00
//                            (restock 225 + PO 60), writeOffCost == 15.00
//                            (odpad 6 + inventura 9), revenue == 487.76;
//                            LEDGER KONTINUITETA: multiset(previousQty) ==
//                            multiset(newQty \ final) — veriga brez vrzelj
//
// COGS vir resnice (dokazano iz kode): StockTransaction.totalCost tipa
// 'sale' — spot cost = costPerUnit ob odvodnem trenutku (snapshot); poročila
// (reports/eod `costs.cogs`) grupirajo iste vrstice po poslovnem dnevu. Drill
// DOKAZUJE, da je prihodkovna in stroškovna stran istega poslovnega dogodka
// rekoncilirana na istem porečju (isti LJ dan, isti locationId scope).
//
// Opomba: auth-middleware (requireAuth) je mockan na MEJI (realna session
// struktura); VSE ostalo (route handlerji, zod, R106/R182 zalogovni kanon z
// advisory locki, R123 yield matematika, R120 FEFO razknjižba, R132 prevzemni
// kanon z GRN + price history, R119 odpadni ledger, P0-01 inventurni kanon,
// Decimal celovod) je REALNO nad PGlite.
// Zagon: PGLITE_DATA_DIR=/tmp/pglite-data-it bun run db:init-pglite
//        → PGLITE_DATA_DIR=/tmp/pglite-data-it bunx vitest run
//          tests/integration/r209-inventory-chain-drill.test.ts
//          --config vitest.config.integration.ts
// ============================================

import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'

// KLJUČNO: tests/setup.ts globalno mock-ira @/lib/db — tu želimo PRAVEGA klienta.
vi.unmock('@/lib/db')

// Auth na meji: realna session struktura (vzorec r128/r132/r151/r207)
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
            error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna.' }), { status: 401 }),
          },
    // resolveTenantLocationId / resolveTenantLocationIdOrThrow ostanejo REALNI
  }
})

import { db } from '@/lib/db'
import { POST as ordersPost } from '@/app/api/orders/route'
import { POST as checksPost } from '@/app/api/checks/route'
import { POST as paymentsPost } from '@/app/api/payments/route'
import { POST as restockPost } from '@/app/api/inventory/restock/route'
import { POST as wastePost } from '@/app/api/waste/route'
import { POST as wasteReversePost } from '@/app/api/waste/[id]/reverse/route'
import { POST as stocktakePost } from '@/app/api/stocktakes/route'
import { PATCH as stocktakePatch } from '@/app/api/stocktakes/[id]/route'
import { POST as stocktakeSubmitPost } from '@/app/api/stocktakes/[id]/submit/route'
import { POST as stocktakeApprovePost } from '@/app/api/stocktakes/[id]/approve/route'
import { POST as poReceive } from '@/app/api/purchase-orders/[id]/receive/route'
import { PUT as adjustBatchPut } from '@/app/api/inventory/adjust/route'
import { GET as reportsEodGet } from '@/app/api/reports/eod/route'
import { ljubljanaDayBounds, ljubljanaTodayStr } from '@/lib/timezone-sl'
import { fetchEodData } from '@/app/api/reports/eod/_helpers/data-fetch'
import { computeEodMetrics } from '@/app/api/reports/eod/_helpers/metrics'
import { fetchFinancialData } from '@/app/api/reports/financial/_helpers-queries'
import { computeStockCosts } from '@/app/api/reports/financial/_helpers-compute/tips-tables-heatmap'
import { fetchFursShiftCogs } from '@/app/api/dashboard/_helpers/furs-shift-cogs'

const RUN_ID = `r209-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const YEAR = new Date().getFullYear()

// ---------- Seed ID-ji ----------
const IDS = {
  location: `${RUN_ID}-loc`,
  employee: `${RUN_ID}-emp`,
  supplier: `${RUN_ID}-sup`,
  menu: `${RUN_ID}-menu`,
  category: `${RUN_ID}-cat`,
  menuItemPizza: `${RUN_ID}-mi-pizza`,
  menuItemJuice: `${RUN_ID}-mi-juice`,
  invFlour: `${RUN_ID}-inv-flour`, // receptna sestavina (kg)
  invJuice: `${RUN_ID}-inv-juice`, // direktna 1:1 povezava (kos)
  invOil: `${RUN_ID}-inv-oil`, // PO prevzem (L)
  invWaste: `${RUN_ID}-inv-waste`, // odpad (kos)
  invBatch: `${RUN_ID}-inv-batch`, // R214 G4: batch-PUT adjust (FEFO serije)
  invG2: `${RUN_ID}-inv-g2`, // R216 G2: business-day bucketiranje (cross-midnight)
  po: `${RUN_ID}-po`,
  po2: `${RUN_ID}-po-2`, // R212 G7: idempotency replay (2. PO — 1. je terminalan)
}

const IDEM_ORDER_PIZZA = `${RUN_ID}-order-pizza`
const IDEM_ORDER_JUICE = `${RUN_ID}-order-juice`
const IDEM_PAY = `${RUN_ID}-pay-1`
const IDEM_WASTE = `${RUN_ID}-waste-1`
const IDEM_STOCKTAKE = `${RUN_ID}-st-1`
// R212 G7: klientov idempotencyKey na PO prevzemu (R116 kanon)
const IDEM_RECV_1 = `${RUN_ID}-recv-1`
const IDEM_RECV_2 = `${RUN_ID}-recv-2`

// ---------- Pričakovani zneski/količine (P1-8 Decimal kanon) ----------
// Naročilo: 20 × 19.99 = 399.80; DDV 22 % = 87.956 → 87.96; total = 487.76
const EXP = { subtotal: 399.8, vat: 87.96, total: 487.76 }
// Recept: usable 0.25 kg/servis @ yield 50 % → RAW = 0.5 kg/servis; 20 servisov = 10 kg
const EXP_RAW_PER_SERVING = 0.5
const EXP_SALE_QTY = 10 // 20 × 0.5
const EXP_SALE_COST = 45.0 // 10 kg × 4.50
// FEFO: LOT-B (expires +2 dni, 8 kg) najprej, nato LOT-A (+30 dni) 2 kg
const EXP_LOT_B_QTY = 8
const EXP_LOT_A_QTY = 42
// Procurement: restock 8×4.50 + 42×4.50 + PO 5×12.00 = 285.00
const EXP_PROCUREMENT_TOTAL = 285.0
// Write-off: odpad 2×3.00 + inventura 2×4.50 = 15.00
const EXP_WRITEOFF_TOTAL = 15.0
// COGS: 45.00 (sok attempt vrstica ima totalCost 0)
const EXP_COGS = 45.0

async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

function req(url: string, method: string, body?: unknown): Request {
  return new Request(`http://local${url}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: 'Bearer integration' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

function post(url: string, body?: unknown): Request {
  return req(url, 'POST', body)
}

function withParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ---------- State med testi ----------
let orderPizzaId = ''
let checkId = ''
let shiftlessPayId = ''
let stocktakeId = ''
let stocktakeLineFlour = ''
let wasteRecordId = ''
const auditStart = new Date(Date.now() - 60_000)

beforeAll(async () => {
  await db.location.create({
    data: {
      id: IDS.location,
      name: 'R209 Lokacija',
      code: `${RUN_ID}-L`,
      premisesId: `${RUN_ID}-p`,
      isActive: true,
    },
  })

  await db.employee.create({
    data: {
      id: IDS.employee,
      name: 'R209 Test Skladovnik',
      email: `${RUN_ID}@r209-test.local`,
      role: 'admin', // admin = bypass vseh permission zahtev (manage_inventory/view_reports/manage_cash)
      status: 'active',
      pin: `pin-${RUN_ID}`,
      locationId: IDS.location,
    },
  })

  await db.supplier.create({
    data: { id: IDS.supplier, name: `Dobavitelj ${RUN_ID}`, code: `${RUN_ID}-S` },
  })

  // Meni + artikli (pizza = receptna pot, sok = direktna pot)
  await db.menu.create({ data: { id: IDS.menu, name: `R209 Meni ${RUN_ID}`, locationId: IDS.location } })
  await db.category.create({ data: { id: IDS.category, name: `R209 Kat ${RUN_ID}`, menuId: IDS.menu } })
  await db.menuItem.create({
    data: { id: IDS.menuItemPizza, name: 'R209 Test Pica', price: 19.99, categoryId: IDS.category, vatRate: 22 },
  })
  await db.menuItem.create({
    data: { id: IDS.menuItemJuice, name: 'R209 Test Sok', price: 5.0, categoryId: IDS.category, vatRate: 22 },
  })

  // Zalogovni artikli — vse na testni lokaciji (inventura snapshot je tak location-scoped)
  await db.inventoryItem.create({
    data: {
      id: IDS.invFlour,
      name: 'R209 Moka tip 500',
      unit: 'kg',
      quantity: 0, // napolnjena prek restocka z serijami (veriga B)
      minQuantity: 5,
      costPerUnit: 4.5,
      servingsPerUnit: 1,
      locationId: IDS.location,
    },
  })
  await db.inventoryItem.create({
    data: {
      id: IDS.invJuice,
      name: 'R209 Sokovanje',
      unit: 'kos',
      quantity: 3, // zavestno pod potrebjo 10 servisov (razprodani scenarij)
      minQuantity: 1,
      costPerUnit: 1.5,
      servingsPerUnit: 2, // 1 kos = 2 servisa → direktna pot: 0.5 kos/servis
      menuItemId: IDS.menuItemJuice,
      locationId: IDS.location,
    },
  })
  await db.inventoryItem.create({
    data: {
      id: IDS.invOil,
      name: 'R209 Oljčno olje',
      unit: 'L',
      quantity: 10,
      minQuantity: 2,
      costPerUnit: 12.0,
      servingsPerUnit: 1,
      locationId: IDS.location,
    },
  })
  await db.inventoryItem.create({
    data: {
      id: IDS.invWaste,
      name: 'R209 Pokvarljivo',
      unit: 'kos',
      quantity: 20,
      minQuantity: 2,
      costPerUnit: 3.0,
      servingsPerUnit: 1,
      locationId: IDS.location,
    },
  })

  // R214 G4: batch artikel + 2 seriji (FEFO: LOT-G4-B izteče prej → porabljen prvi)
  await db.inventoryItem.create({
    data: {
      id: IDS.invBatch,
      name: 'R214 Batch Artikel',
      unit: 'kos',
      quantity: 8,
      minQuantity: 1,
      costPerUnit: 2.0,
      servingsPerUnit: 1,
      locationId: IDS.location,
    },
  })
  const day2G4 = new Date(Date.now() + 2 * 24 * 3600 * 1000)
  const day30G4 = new Date(Date.now() + 30 * 24 * 3600 * 1000)
  await db.inventoryBatch.create({
    data: {
      inventoryItemId: IDS.invBatch,
      locationId: IDS.location,
      lotNumber: 'LOT-G4-B',
      receivedAt: new Date(Date.now() - 36 * 3600 * 1000),
      expiryDate: day2G4,
      quantityInitial: 3,
      quantityRemaining: 3,
      unit: 'kos',
      unitCost: 2.0,
      status: 'ACTIVE',
    },
  })
  await db.inventoryBatch.create({
    data: {
      inventoryItemId: IDS.invBatch,
      locationId: IDS.location,
      lotNumber: 'LOT-G4-A',
      receivedAt: new Date(Date.now() - 72 * 3600 * 1000),
      expiryDate: day30G4,
      quantityInitial: 5,
      quantityRemaining: 5,
      unit: 'kos',
      unitCost: 2.0,
      status: 'ACTIVE',
    },
  })

  // R216 G2: artikel za business-day bucketiranje (cross-midnight scenarij)
  await db.inventoryItem.create({
    data: {
      id: IDS.invG2,
      name: 'R216 G2 Artikel',
      unit: 'kg',
      quantity: 48.6,
      minQuantity: 1,
      costPerUnit: 0.6,
      servingsPerUnit: 1,
      locationId: IDS.location,
    },
  })

  // Recept: pica ← moka, usable 0.25 kg/servis @ yield 50 % (RAW = 0.5 kg/servis)
  await db.recipeItem.create({
    data: {
      menuItemId: IDS.menuItemPizza,
      inventoryItemId: IDS.invFlour,
      quantityPerServing: 0.25,
      yieldPercent: 50,
      unit: 'kg',
    },
  })

  // PO direktno v bazi (drill testira prevzem — kreacija PO pokrita v r129/r131)
  await db.purchaseOrder.create({
    data: {
      id: IDS.po,
      poNumber: `ND-${YEAR}-020900`,
      supplierId: IDS.supplier,
      status: 'approved',
      locationId: IDS.location,
      subtotal: 60,
      vatAmount: 13.2,
      totalAmount: 73.2,
      items: {
        create: [
          {
            id: `${IDS.po}-i-oil`,
            inventoryItemId: IDS.invOil,
            description: 'R209 Oljčno olje',
            quantityOrdered: 5,
            unit: 'L',
            unitPrice: 12.0,
            vatRate: 22,
            totalPrice: 60,
          },
        ],
      },
    },
  })

  // R212 G7: drugi PO za idempotency replay (1. PO je po VERIGA B terminalan
  // 'received' — replay vrednost se dokazuje na svežem approved naročilu)
  await db.purchaseOrder.create({
    data: {
      id: IDS.po2,
      poNumber: `ND-${YEAR}-020901`,
      supplierId: IDS.supplier,
      status: 'approved',
      locationId: IDS.location,
      subtotal: 60,
      vatAmount: 13.2,
      totalAmount: 73.2,
      items: {
        create: [
          {
            id: `${IDS.po2}-i-oil`,
            inventoryItemId: IDS.invOil,
            description: 'R212 Oljčno olje (G7)',
            quantityOrdered: 5,
            unit: 'L',
            unitPrice: 12.0,
            vatRate: 22,
            totalPrice: 60,
          },
        ],
      },
    },
  })

  // Privzeta seja: admin lokacije (bypass permission zahtev,.locationId scope aktiven)
  authRef.current = { employeeId: IDS.employee, role: 'admin', locationId: IDS.location, permissions: [] }
})

afterAll(async () => {
  // Čiščenje po FK redu — ORKENTIRANO na RUN_ID entitete (IT tečejo zaporedno,
  // fileParallelism: false, a delijo isto PGlite bazo — nikoli deleteMany brez scope-a).
  const itemIds = [IDS.invFlour, IDS.invJuice, IDS.invOil, IDS.invWaste, IDS.invBatch, IDS.invG2]

  await db.auditLog
    .deleteMany({
      where: {
        OR: [
          { locationId: IDS.location },
          { entityId: { in: [IDS.po, IDS.po2, `${IDS.po}-i-oil`, wasteRecordId, stocktakeId] } },
        ],
      },
    })
    .catch(() => {})
  await db.stocktakeItem.deleteMany({ where: { stocktakeId } }).catch(() => {})
  await db.stocktake.deleteMany({ where: { id: stocktakeId } }).catch(() => {})
  await db.wasteRecord.deleteMany({ where: { inventoryItemId: { in: itemIds } } }).catch(() => {})
  // StockBatchAllocation kaskadira s StockTransaction (onDelete: Cascade)
  await db.stockTransaction.deleteMany({ where: { inventoryItemId: { in: itemIds } } }).catch(() => {})
  await db.inventoryBatch.deleteMany({ where: { inventoryItemId: { in: itemIds } } }).catch(() => {})
  await db.supplierPriceHistory.deleteMany({ where: { inventoryItemId: { in: itemIds } } }).catch(() => {})
  await db.accountsPayableLine.deleteMany({ where: { accountsPayable: { purchaseOrderId: { in: [IDS.po, IDS.po2] } } } }).catch(() => {})
  await db.accountsPayable.deleteMany({ where: { purchaseOrderId: { in: [IDS.po, IDS.po2] } } }).catch(() => {})
  await db.goodsReceiptItem.deleteMany({ where: { goodsReceipt: { purchaseOrderId: { in: [IDS.po, IDS.po2] } } } }).catch(() => {})
  await db.goodsReceipt.deleteMany({ where: { purchaseOrderId: { in: [IDS.po, IDS.po2] } } }).catch(() => {})
  await db.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: { in: [IDS.po, IDS.po2] } } }).catch(() => {})
  await db.purchaseOrder.deleteMany({ where: { id: { in: [IDS.po, IDS.po2] } } }).catch(() => {})
  await db.payment.deleteMany({ where: { idempotencyKey: IDEM_PAY } }).catch(() => {})
  await db.order.deleteMany({ where: { idempotencyKey: { in: [IDEM_ORDER_PIZZA, IDEM_ORDER_JUICE] } } }).catch(() => {})
  // R216 G2: direkt kreirana naročila (brez idempotencyKey — po id)
  await db.order.deleteMany({ where: { id: { in: [`${RUN_ID}-g2-order-paid`, `${RUN_ID}-g2-order-unpaid`] } } }).catch(() => {})
  await db.menuItem.deleteMany({ where: { id: { in: [IDS.menuItemPizza, IDS.menuItemJuice] } } }).catch(() => {})
  await db.category.deleteMany({ where: { id: IDS.category } }).catch(() => {})
  await db.menu.deleteMany({ where: { id: IDS.menu } }).catch(() => {})
  await db.inventoryItem.deleteMany({ where: { id: { in: itemIds } } }).catch(() => {})
  await db.supplier.deleteMany({ where: { id: IDS.supplier } }).catch(() => {})
  await db.employee.deleteMany({ where: { id: IDS.employee } }).catch(() => {})
  await db.location.deleteMany({ where: { id: IDS.location } }).catch(() => {})
  await db.$disconnect().catch(() => {})
})

// ============================================
// VERIGA B: prevzem z serijami (lot + expiry) — FEFO bralna baza
// ============================================
describe('R209 B: restock z serijami → InventoryBatch + procurement ledger (§22-B osnova)', () => {
  it('restock 2× z lot+expiry → 2 aktivni seriji + procurement StockTx (36.00 + 189.00)', async () => {
    const day2 = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString()
    const day30 = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()

    // LOT-B: prej poteče — FEFO ga porabi PRVEGA (§22-H determinizem)
    const resB = await restockPost(
      post('/api/inventory/restock', {
        inventoryItemId: IDS.invFlour,
        quantity: EXP_LOT_B_QTY,
        reason: 'R209 prevzem LOT-B',
        batch: { lotNumber: 'LOT-R209-B', expiryDate: day2, supplierId: IDS.supplier, unitCost: 4.5 },
      }),
    )
    expect(resB.status).toBe(200)

    const resA = await restockPost(
      post('/api/inventory/restock', {
        inventoryItemId: IDS.invFlour,
        quantity: EXP_LOT_A_QTY,
        reason: 'R209 prevzem LOT-A',
        batch: { lotNumber: 'LOT-R209-A', expiryDate: day30, supplierId: IDS.supplier, unitCost: 4.5 },
      }),
    )
    expect(resA.status).toBe(200)

    // §21 database-state: artikel 50 kg, 2 aktivni seriji z pravimi ostanki
    const flour = await db.inventoryItem.findUnique({ where: { id: IDS.invFlour } })
    expect(Number(flour!.quantity)).toBe(50)

    const batches = await db.inventoryBatch.findMany({ where: { inventoryItemId: IDS.invFlour }, orderBy: { lotNumber: 'asc' } })
    expect(batches).toHaveLength(2)
    const lotA = batches.find((b) => b.lotNumber === 'LOT-R209-A')!
    const lotB = batches.find((b) => b.lotNumber === 'LOT-R209-B')!
    expect(Number(lotA.quantityRemaining)).toBe(EXP_LOT_A_QTY)
    expect(Number(lotB.quantityRemaining)).toBe(EXP_LOT_B_QTY)
    expect(lotA.status).toBe('ACTIVE')
    expect(lotB.status).toBe('ACTIVE')
    expect(lotA.supplierId).toBe(IDS.supplier)

    // Procurement ledger: 2 vrstici, totalCost == qty × costPerUnit
    const procTxs = await db.stockTransaction.findMany({
      where: { inventoryItemId: IDS.invFlour, type: 'procurement' },
      orderBy: { createdAt: 'asc' },
    })
    expect(procTxs).toHaveLength(2)
    expect(Number(procTxs[0].totalCost)).toBe(36.0)
    expect(Number(procTxs[1].totalCost)).toBe(189.0)
    expect(Number(procTxs[0].newQty)).toBe(EXP_LOT_B_QTY)
    expect(Number(procTxs[1].newQty)).toBe(50)
  })
})

// ============================================
// VERIGA A: prodaja → recept (yield) → zaloga → FEFO (§6 + §22-A/H)
// ============================================
describe('R209 A: naročilo 20 pica → RAW odvod 10 kg + FEFO razknjižba po odlagi', () => {
  it('POST /api/orders → sale StockTx (quantity −10, totalCost 45.00, snapshot cene) + FEFO: LOT-B 8 → EXHAUSTED, LOT-A 2', async () => {
    const res = await ordersPost(
      post('/api/orders', {
        type: 'takeout',
        orderItems: [{ menuItemId: IDS.menuItemPizza, quantity: 20 }],
        idempotencyKey: IDEM_ORDER_PIZZA,
      }),
    )
    expect(res.status).toBe(201)

    const order = await db.order.findUnique({ where: { idempotencyKey: IDEM_ORDER_PIZZA } })
    expect(order).not.toBeNull()
    orderPizzaId = order!.id
    expect(Number(order!.subtotal)).toBe(EXP.subtotal)
    expect(Number(order!.tax)).toBe(EXP.vat)
    expect(Number(order!.total)).toBe(EXP.total)
    expect(order!.paymentStatus).toBe('unpaid')
    expect(order!.locationId).toBe(IDS.location)
    expect(order!.inventoryDeducted).toBe(true) // CAS claim — exactly-once vrata

    // §6: točna količina = RAW (usable / yield) × količina prodaje
    const saleTx = await db.stockTransaction.findFirst({
      where: { inventoryItemId: IDS.invFlour, type: 'sale', orderId: orderPizzaId },
    })
    expect(saleTx).not.toBeNull()
    expect(Number(saleTx!.quantity)).toBe(-EXP_SALE_QTY)
    expect(Number(saleTx!.previousQty)).toBe(50)
    expect(Number(saleTx!.newQty)).toBe(40)
    // Cost snapshot ob odvodnem trenutku (§15: cost basis = InventoryItem.costPerUnit)
    expect(Number(saleTx!.costPerUnit)).toBe(4.5)
    expect(Number(saleTx!.totalCost)).toBe(EXP_SALE_COST)
    expect(saleTx!.reason).toContain('Prodaja')

    // §22-H: FEFO determinizem — per-batch razknjižba po expiryDate ASC
    const allocations = await db.stockBatchAllocation.findMany({
      where: { stockTransactionId: saleTx!.id },
      include: { batch: true },
    })
    expect(allocations).toHaveLength(2)
    const allocB = allocations.find((a) => a.batch.lotNumber === 'LOT-R209-B')!
    const allocA = allocations.find((a) => a.batch.lotNumber === 'LOT-R209-A')!
    expect(Number(allocB.quantity)).toBe(-EXP_LOT_B_QTY) // prej potečujoča serija porabljena ZUNAJ
    expect(Number(allocA.quantity)).toBe(-2)

    // Serija stanja: LOT-B izčrpana, LOT-A 40
    const lotB = await db.inventoryBatch.findFirst({ where: { lotNumber: 'LOT-R209-B' } })
    const lotA = await db.inventoryBatch.findFirst({ where: { lotNumber: 'LOT-R209-A' } })
    expect(lotB!.status).toBe('EXHAUSTED')
    expect(Number(lotB!.quantityRemaining)).toBe(0)
    expect(lotA!.status).toBe('ACTIVE')
    expect(Number(lotA!.quantityRemaining)).toBe(40)

    // Zaloga na artiklu
    const flour = await db.inventoryItem.findUnique({ where: { id: IDS.invFlour } })
    expect(Number(flour!.quantity)).toBe(40)
  })

  it('§5 EXACT-ONCE: replay order idempotencyKey → 200 ISTI order, EN zalogovni efekt', async () => {
    const saleTxCountBefore = await db.stockTransaction.count({
      where: { inventoryItemId: IDS.invFlour, type: 'sale', orderId: orderPizzaId },
    })

    const res = await ordersPost(
      post('/api/orders', {
        type: 'takeout',
        orderItems: [{ menuItemId: IDS.menuItemPizza, quantity: 20 }],
        idempotencyKey: IDEM_ORDER_PIZZA,
      }),
    )
    // R116/R128 kanon: obstoječ → 200 z ISTIM orderjem (ne 201, ne dup)
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(String(body.id)).toBe(orderPizzaId)

    // EN zalogovni efekt: še vedno natanko 1 sale tx, zaloga nespremenjena
    expect(
      await db.stockTransaction.count({
        where: { inventoryItemId: IDS.invFlour, type: 'sale', orderId: orderPizzaId },
      }),
    ).toBe(saleTxCountBefore)
    const flour = await db.inventoryItem.findUnique({ where: { id: IDS.invFlour } })
    expect(Number(flour!.quantity)).toBe(40)
  })
})

// ============================================
// VERIGA I: razprodano / zadnja enota (§22-I + §5 last-unit)
// ============================================
describe('R209 I: razprodano — fail-closed 409 (R124) + allowOutOfStock attempt vrstica (ni negativne zaloge)', () => {
  it('§22-I(a): naročilo 10 sokov nad 3 kosi → 409 + soldOutItems, NI naročila NI odvoda', async () => {
    const txBefore = await db.stockTransaction.count({ where: { inventoryItemId: IDS.invJuice } })

    const res = await ordersPost(
      post('/api/orders', {
        type: 'takeout',
        orderItems: [{ menuItemId: IDS.menuItemJuice, quantity: 10 }],
        idempotencyKey: IDEM_ORDER_JUICE,
      }),
    )
    expect(res.status).toBe(409)
    const body = await asJson(res)
    const soldOut = body.soldOutItems as Array<Record<string, unknown>>
    expect(Array.isArray(soldOut)).toBe(true)
    expect(soldOut.some((s) => s.menuItemId === IDS.menuItemJuice)).toBe(true)

    // Fail-closed: naročilo NE obstaja, zaloga nedotaknjena, brez ledger vrstic
    expect(await db.order.findUnique({ where: { idempotencyKey: IDEM_ORDER_JUICE } })).toBeNull()
    expect(await db.stockTransaction.count({ where: { inventoryItemId: IDS.invJuice } })).toBe(txBefore)
    const juice = await db.inventoryItem.findUnique({ where: { id: IDS.invJuice } })
    expect(Number(juice!.quantity)).toBe(3)
  })

  it('§22-I(b): allowOutOfStock → order obstane, pogojni decrement FAILA → attempt vrstica qty 0, zaloga ostane 3', async () => {
    const res = await ordersPost(
      post('/api/orders', {
        type: 'takeout',
        orderItems: [{ menuItemId: IDS.menuItemJuice, quantity: 10 }],
        idempotencyKey: IDEM_ORDER_JUICE,
        allowOutOfStock: true,
      }),
    )
    expect(res.status).toBe(201)

    const order = await db.order.findUnique({ where: { idempotencyKey: IDEM_ORDER_JUICE } })
    expect(order).not.toBeNull()

    // Attempt vrstica (transparenten poskus, NI finančnega efekta)
    const attemptTx = await db.stockTransaction.findFirst({
      where: { inventoryItemId: IDS.invJuice, type: 'sale', orderId: order!.id },
    })
    expect(attemptTx).not.toBeNull()
    expect(Number(attemptTx!.quantity)).toBe(0)
    expect(Number(attemptTx!.totalCost)).toBe(0)
    expect(attemptTx!.reason).toContain('POSKUS PRODAJE')
    expect(Number(attemptTx!.previousQty)).toBe(3)
    expect(Number(attemptTx!.newQty)).toBe(3)

    // Kanon: negativna zaloga NEMOGOČA (pogojni decrement je edina pisalna pot)
    const juice = await db.inventoryItem.findUnique({ where: { id: IDS.invJuice } })
    expect(Number(juice!.quantity)).toBe(3)
  })
})

// ============================================
// VERIGA A (plačilo): check + cash → paid (§19 prihodkovna stran)
// ============================================
describe('R209 A: plačilo — Σ(completed) == ček == naročilo na cent', () => {
  it('check + cash plačilo 487.76 → paid', async () => {
    const order = await db.order.findUnique({ where: { idempotencyKey: IDEM_ORDER_PIZZA }, include: { orderItems: true } })
    const resCheck = await checksPost(
      post('/api/checks', {
        orderId: order!.id,
        orderItemIds: order!.orderItems.map((i) => i.id),
      }),
    )
    expect(resCheck.status).toBe(201)
    const check = (await asJson(resCheck)) as Record<string, number | string>
    checkId = String(check.id)
    expect(Number(check.total)).toBe(EXP.total)

    const resPay = await paymentsPost(
      post('/api/payments', {
        checkId,
        amount: EXP.total,
        type: 'cash',
        idempotencyKey: IDEM_PAY,
      }),
    )
    expect(resPay.status).toBe(201)
    const pay = (await asJson(resPay)) as Record<string, unknown>
    shiftlessPayId = String(pay.id)

    const orderAfter = await db.order.findUnique({ where: { idempotencyKey: IDEM_ORDER_PIZZA } })
    expect(orderAfter!.paymentStatus).toBe('paid')
    expect(orderAfter!.paidAt).not.toBeNull()

    const paidSum = await db.payment.aggregate({
      where: { checkId, status: 'completed' },
      _sum: { amount: true },
    })
    expect(Number(paidSum._sum.amount)).toBe(EXP.total)
  })
})

// ============================================
// VERIGA B: PO → receive → zaloga + GRN + price history (§10/§22-B/C temelj)
// ============================================
describe('R209 B: PO prevzem → zaloga +5 L + procurement 60.00 + GRN + price history', () => {
  it('POST /api/purchase-orders/[id]/receive → stock 15, StockTx procurement, GRN dokument, SupplierPriceHistory 12.00, PO received', async () => {
    const res = await poReceive(
      req(`/api/purchase-orders/${IDS.po}/receive`, 'POST', {
        receivedItems: [{ itemId: `${IDS.po}-i-oil`, quantityReceived: 5 }],
        supplierDocNumber: 'DOB-R209-77',
        notes: 'R209 drill prevzem',
      }),
      withParams(IDS.po),
    )
    expect(res.status).toBe(200)
    const body = await asJson(res)
    const grn = body.grn as Record<string, unknown>
    expect(grn.grnNumber).toBe(`GR-${YEAR}-000001`)
    expect(grn.status).toBe('confirmed')

    // §21 database-state: zaloga 10 → 15, procurement ledger
    const oil = await db.inventoryItem.findUnique({ where: { id: IDS.invOil } })
    expect(Number(oil!.quantity)).toBe(15)

    const procTx = await db.stockTransaction.findFirst({
      where: { inventoryItemId: IDS.invOil, type: 'procurement' },
    })
    expect(procTx).not.toBeNull()
    expect(Number(procTx!.quantity)).toBe(5)
    expect(Number(procTx!.previousQty)).toBe(10)
    expect(Number(procTx!.newQty)).toBe(15)
    expect(Number(procTx!.totalCost)).toBe(60.0)
    // Kanon: StockTx.supplierDoc nosi PO številko (sledljivost do naročila);
    // št. dobavnice dobavitelja živi v GRN dokumentu (supplierDocNumber).
    expect(procTx!.supplierDoc).toBe(`ND-${YEAR}-020900`)

    // GRN dokument + linija (dobavnica živi v bazi, ne samo v odgovoru)
    const grnRow = await db.goodsReceipt.findUnique({
      where: { grnNumber: String(grn.grnNumber) },
      include: { items: true },
    })
    expect(grnRow).not.toBeNull()
    expect(grnRow!.purchaseOrderId).toBe(IDS.po)
    expect(grnRow!.items).toHaveLength(1)
    expect(Number(grnRow!.items[0].quantityAccepted)).toBe(5)

    // R130: price history zajeta OB prevzemu (source goods_receipt)
    const ph = await db.supplierPriceHistory.findFirst({
      where: { inventoryItemId: IDS.invOil },
    })
    expect(ph).not.toBeNull()
    expect(Number(ph!.unitPrice)).toBe(12.0)
    expect(ph!.source).toBe('goods_receipt')
    expect(ph!.purchaseOrderId).toBe(IDS.po)

    // PO terminalno stanje
    const po = await db.purchaseOrder.findUnique({ where: { id: IDS.po } })
    expect(po!.status).toBe('received')
  })

  it('§5 EXACT-ONCE: duplicate receive → 400 "že popolnoma prejeto", EN efekt', async () => {
    const res = await poReceive(
      req(`/api/purchase-orders/${IDS.po}/receive`, 'POST', {
        receivedItems: [{ itemId: `${IDS.po}-i-oil`, quantityReceived: 5 }],
        supplierDocNumber: 'DOB-R209-RETRY',
      }),
      withParams(IDS.po),
    )
    expect(res.status).toBe(400)
    const body = await asJson(res)
    expect(String(body.error)).toContain('že popolnoma prejeto')

    // §21: NI dvojnega zalogovnega efekta, NI dup GRN, NI dup price history
    const oil = await db.inventoryItem.findUnique({ where: { id: IDS.invOil } })
    expect(Number(oil!.quantity)).toBe(15)
    expect(await db.stockTransaction.count({ where: { inventoryItemId: IDS.invOil, type: 'procurement' } })).toBe(1)
    expect(await db.goodsReceipt.count({ where: { purchaseOrderId: IDS.po } })).toBe(1)
    expect(await db.supplierPriceHistory.count({ where: { inventoryItemId: IDS.invOil } })).toBe(1)
  })
})

// ============================================
// VERIGA D: odpad → write-off + WasteRecord + replay + reversala (§12/§22-D)
// ============================================
describe('R209 D: odpad → write-off 6.00 + WasteRecord snapshot; replay → ISTA vrstica; reverse → return; double reverse → 409', () => {
  it('POST /api/waste → write-off StockTx + WasteRecord snapshot + audit WASTE_CREATE', async () => {
    const res = await wastePost(
      post('/api/waste', {
        inventoryItemId: IDS.invWaste,
        quantity: 2,
        reason: 'SPOILED',
        note: 'R209 drill odpad',
        idempotencyKey: IDEM_WASTE,
      }),
    )
    expect(res.status).toBe(201)
    const body = await asJson(res)
    expect(body.replay).toBe(false)
    const record = body.record as Record<string, unknown>
    wasteRecordId = String(record.id)
    expect(Number(record.quantity)).toBe(2)
    expect(Number(record.totalCost)).toBe(6.0)
    expect(record.reason).toBe('SPOILED')

    // §21: write-off ledger + snapshot povezava (1 tx = 1 odpis + 1 zapis)
    const wasteTx = await db.stockTransaction.findFirst({
      where: { inventoryItemId: IDS.invWaste, type: 'write-off' },
    })
    expect(wasteTx).not.toBeNull()
    expect(Number(wasteTx!.quantity)).toBe(-2)
    expect(Number(wasteTx!.previousQty)).toBe(20)
    expect(Number(wasteTx!.newQty)).toBe(18)
    expect(Number(wasteTx!.totalCost)).toBe(6.0)
    expect(String(record.stockTransactionId)).toBe(wasteTx!.id)

    const dbRecord = await db.wasteRecord.findUnique({ where: { id: wasteRecordId } })
    expect(dbRecord!.locationId).toBe(IDS.location)
    expect(Number(dbRecord!.costPerUnit)).toBe(3.0)

    // Audit sled
    const audit = await db.auditLog.findFirst({ where: { action: 'WASTE_CREATE', entityId: wasteRecordId } })
    expect(audit).not.toBeNull()
  })

  it('§5 EXACT-ONCE: waste replay z ISTIM idempotencyKey → ISTA vrstica (replay: true), EN efekt', async () => {
    const res = await wastePost(
      post('/api/waste', {
        inventoryItemId: IDS.invWaste,
        quantity: 2,
        reason: 'SPOILED',
        idempotencyKey: IDEM_WASTE,
      }),
    )
    expect(res.status).toBe(200) // replay veja → 200 z ISTO vrstico + replay: true
    const body = await asJson(res)
    expect(body.replay).toBe(true)
    const record = body.record as Record<string, unknown>
    expect(String(record.id)).toBe(wasteRecordId) // ISTA ledger vrstica

    // EN odpis, EN zapis, zaloga ostane 18
    expect(await db.wasteRecord.count({ where: { inventoryItemId: IDS.invWaste } })).toBe(1)
    expect(await db.stockTransaction.count({ where: { inventoryItemId: IDS.invWaste, type: 'write-off' } })).toBe(1)
    const item = await db.inventoryItem.findUnique({ where: { id: IDS.invWaste } })
    expect(Number(item!.quantity)).toBe(18)
  })

  it('reverse → kompenzacijski return s snapshot ceno; double reverse → 409', async () => {
    const res = await wasteReversePost(post(`/api/waste/${wasteRecordId}/reverse`), withParams(wasteRecordId))
    expect(res.status).toBe(200)

    // Return ledger: +2, snapshot totalCost 6.00 (NI nove cene)
    const returnTx = await db.stockTransaction.findFirst({
      where: { inventoryItemId: IDS.invWaste, type: 'return' },
    })
    expect(returnTx).not.toBeNull()
    expect(Number(returnTx!.quantity)).toBe(2)
    expect(Number(returnTx!.totalCost)).toBe(6.0)

    const dbRecord = await db.wasteRecord.findUnique({ where: { id: wasteRecordId } })
    expect(dbRecord!.reversedAt).not.toBeNull()
    expect(dbRecord!.reversalStockTransactionId).toBe(returnTx!.id)

    const item = await db.inventoryItem.findUnique({ where: { id: IDS.invWaste } })
    expect(Number(item!.quantity)).toBe(20)

    // Double reverse → 409 (reversal NIKOLI ne briše, drugi kompenzacijski NI možen)
    const res2 = await wasteReversePost(post(`/api/waste/${wasteRecordId}/reverse`), withParams(wasteRecordId))
    expect(res2.status).toBe(409)
    expect(await db.stockTransaction.count({ where: { inventoryItemId: IDS.invWaste, type: 'return' } })).toBe(1)
  })
})

// ============================================
// VERIGA E: inventura → count → submit → approve (§12/§22-E)
// ============================================
describe('R209 E: inventura — snapshot → štetje → submit → approve skozi zalogovni kanon; double approve → 409', () => {
  it('create (snapshot) → count 38 → submit → approve → write-off 9.00 + FEFO + line link', async () => {
    const resCreate = await stocktakePost(
      post('/api/stocktakes', { note: 'R209 drill inventura', idempotencyKey: IDEM_STOCKTAKE }),
    )
    expect(resCreate.status).toBe(201)
    const created = await asJson(resCreate)
    const stocktake = created.stocktake as { id: string; status: string; lines: Array<Record<string, unknown>> }
    stocktakeId = stocktake.id
    expect(stocktake.status).toBe('DRAFT')

    // Snapshot linije za artikle obsega (lastna lokacija + skupni vir)
    const flourLine = stocktake.lines.find((l) => l.inventoryItemId === IDS.invFlour)!
    stocktakeLineFlour = String(flourLine.id)
    expect(Number(flourLine.expectedQuantity)).toBe(40)
    expect(flourLine.countedQuantity).toBeNull() // še neprešteano

    // Štetje: moka 38 (razlika −2 vs tx-fresh 40)
    const resPatch = await stocktakePatch(
      req(`/api/stocktakes/${stocktakeId}`, 'PATCH', {
        counts: [{ lineId: stocktakeLineFlour, countedQuantity: 38, lineNote: 'R209 štetje' }],
      }),
      withParams(stocktakeId),
    )
    expect(resPatch.status).toBe(200)

    // DRAFT → IN_REVIEW (štetje zaklenjeno)
    const resSubmit = await stocktakeSubmitPost(post(`/api/stocktakes/${stocktakeId}/submit`), withParams(stocktakeId))
    expect(resSubmit.status).toBe(200)

    // IN_REVIEW → APPROVED: absolutna nastavitev skozi kanon (CAS + advisory lock)
    const resApprove = await stocktakeApprovePost(
      post(`/api/stocktakes/${stocktakeId}/approve`),
      withParams(stocktakeId),
    )
    expect(resApprove.status).toBe(200)
    const approved = await asJson(resApprove) as { summary: { adjustedLines: number; totalVarianceValue: number } }
    expect(approved.summary.adjustedLines).toBe(1)
    expect(approved.summary.totalVarianceValue).toBe(-9.0) // −2 kg × 4.50

    // §21: write-off ledger + FEFO razknjižba + line link
    const adjustTx = await db.stockTransaction.findFirst({
      where: { inventoryItemId: IDS.invFlour, type: 'write-off' },
    })
    expect(adjustTx).not.toBeNull()
    expect(Number(adjustTx!.quantity)).toBe(-2)
    expect(Number(adjustTx!.previousQty)).toBe(40)
    expect(Number(adjustTx!.newQty)).toBe(38)
    expect(Number(adjustTx!.totalCost)).toBe(9.0)
    expect(adjustTx!.reason).toContain('Inventura')

    const line = await db.stocktakeItem.findUnique({ where: { id: stocktakeLineFlour } })
    expect(line!.stockTransactionId).toBe(adjustTx!.id)

    const flour = await db.inventoryItem.findUnique({ where: { id: IDS.invFlour } })
    expect(Number(flour!.quantity)).toBe(38)

    // FEFO: negativna korekcija se razknjiži po serijah (LOT-A je edina aktivna)
    const alloc = await db.stockBatchAllocation.findFirst({
      where: { stockTransactionId: adjustTx!.id, inventoryItemId: IDS.invFlour },
    })
    expect(alloc).not.toBeNull()
    expect(Number(alloc!.quantity)).toBe(-2)
  })

  it('§5 EXACT-ONCE: double approve → 409 "že potrjena", EN korekcijski efekt', async () => {
    const writeOffCount = await db.stockTransaction.count({
      where: { inventoryItemId: IDS.invFlour, type: 'write-off' },
    })

    const res = await stocktakeApprovePost(post(`/api/stocktakes/${stocktakeId}/approve`), withParams(stocktakeId))
    expect(res.status).toBe(409)
    const body = await asJson(res)
    expect(String(body.error)).toContain('že potrjena')

    expect(
      await db.stockTransaction.count({ where: { inventoryItemId: IDS.invFlour, type: 'write-off' } }),
    ).toBe(writeOffCount)
    const flour = await db.inventoryItem.findUnique({ where: { id: IDS.invFlour } })
    expect(Number(flour!.quantity)).toBe(38)
  })
})

// ============================================
// §19/§21: REKONCILIACIJA inventory ↔ financial + LEDGER KONTINUITETA
// ============================================
describe('R209 §19: reports/eod — cogs/procurement/writeOff == Σ persisted StockTxs; revenue == plačilo', () => {
  it('GET /api/reports/eod → costs.cogs 45.00, procurementCost 285.00, writeOffCost 15.00, revenue 487.76', async () => {
    const date = ljubljanaTodayStr()
    const res = await reportsEodGet(
      new Request(`http://local/api/reports/eod?date=${date}`, {
        headers: { authorization: 'Bearer integration' },
      }),
    )
    expect(res.status).toBe(200)
    const body = (await asJson(res)) as {
      date: string
      summary: { totalRevenue: number; completedOrders: number }
      costs: { procurementCost: number; writeOffCost: number; cogs: number; grossProfit: number }
    }
    expect(body.date).toBe(date)

    // §19: COGS == Σ|totalCost| type='sale' (ISTE vrstice, ki jih je ustvaril odvod)
    expect(body.costs.cogs).toBe(EXP_COGS)
    // Procurement: restock 36 + 189 + PO receive 60
    expect(body.costs.procurementCost).toBe(EXP_PROCUREMENT_TOTAL)
    // Write-off: odpad 6.00 + inventura 9.00
    expect(body.costs.writeOffCost).toBe(EXP_WRITEOFF_TOTAL)
    // Prihodki: isti poslovni dogodek (order paid danes)
    expect(body.summary.totalRevenue).toBe(EXP.total)
    expect(body.summary.completedOrders).toBe(1)

    // Bruto: revenue − cogs − writeOff
    expect(body.costs.grossProfit).toBeCloseTo(EXP.total - EXP_COGS - EXP_WRITEOFF_TOTAL, 2)
  })

  it('§21 LEDGER KONTINUITETA: multiset(previousQty) == multiset(newQty) ∪ {initial} \\ {final} — veriga moka brez vrzelj', async () => {
    const txs = await db.stockTransaction.findMany({
      where: { inventoryItemId: IDS.invFlour },
      orderBy: { createdAt: 'asc' },
    })
    // restock LOT-B + restock LOT-A + prodaja + inventurni write-off
    expect(txs).toHaveLength(4)
    expect(txs.map((t) => t.type).sort()).toEqual(['procurement', 'procurement', 'sale', 'write-off'].sort())

    const prevs = txs.map((t) => Number(t.previousQty)).sort((a, b) => a - b)
    const news = txs.map((t) => Number(t.newQty)).sort((a, b) => a - b)
    // Vsak newQty (razen končnega 38) se pojavi kot previousQty naslednjega
    // dogodka — brezvrstična formulacija (odporna na enako-milisekundne zapise):
    // previousQty == { 0, 8, 40, 50 }, newQty == { 8, 38, 40, 50 }
    expect(prevs).toEqual([0, 8, 40, 50])
    expect(news).toEqual([8, 38, 40, 50])

    // §15: cost basis vsake prodaje je SNAPSHOT ob odvodu (ne slednja cena)
    const saleTx = txs.find((t) => t.type === 'sale')!
    expect(Number(saleTx.costPerUnit)).toBe(4.5)
  })
})

// ============================================
// R212 G7 (epik #144, #152 korak 2): PO receive idempotency — R116 kanon
// ============================================
// Vrzel G7 (docs/INVENTORY-CHAIN.md §5): prevzem je imel SAMO terminalni
// status guard + cap-check — dup prevzem z ISTIMI količinami po statusu
// `partial` (retry omrežja/klienta) je po oblikovanju prištel zalogo DVAKRAT.
// FIX: klientov opcijski idempotencyKey na GRN (@@unique(purchaseOrderId,
// idempotencyKey)) — replay check POD per-PO advisory lockom in PRED
// terminalnimi zaščitami → retry = 200 ISTI GRN, EN efekt.
// OPOMBA: ta blok teče PO §19/§21 rekonciliaciji (file order) — EOD vrata
// (procurementCost 285.00) so že potrjena, novi prevzemi jih ne vplivajo.
describe('R212 G7: receive idempotencyKey → replay = ISTI GRN, EN efekt', () => {
  it('§5 EXACT-ONCE (G7): partial receive z ključem → 200 GRN + zaloga +2; replay ISTEGA ključa → ISTI GRN, ZERO nov efekt', async () => {
    // 1. delni prevzem (2 od 5 L) z idempotencyKey
    const res1 = await poReceive(
      req(`/api/purchase-orders/${IDS.po2}/receive`, 'POST', {
        receivedItems: [{ itemId: `${IDS.po2}-i-oil`, quantityReceived: 2 }],
        supplierDocNumber: 'DOB-R212-A',
        idempotencyKey: IDEM_RECV_1,
      }),
      withParams(IDS.po2),
    )
    expect(res1.status).toBe(200)
    const body1 = await asJson(res1)
    expect(body1.replay).toBe(false)
    const grnA = body1.grn as Record<string, unknown>
    expect(grnA.status).toBe('confirmed')

    // Zaloga 15 → 17, EN nov procurement tx, EN GRN, EN price-history vrstica
    const oil = await db.inventoryItem.findUnique({ where: { id: IDS.invOil } })
    expect(Number(oil!.quantity)).toBe(17)
    expect(await db.stockTransaction.count({ where: { inventoryItemId: IDS.invOil, type: 'procurement' } })).toBe(2)
    expect(await db.goodsReceipt.count({ where: { purchaseOrderId: IDS.po2 } })).toBe(1)
    expect(await db.supplierPriceHistory.count({ where: { inventoryItemId: IDS.invOil } })).toBe(2)
    expect(String(grnA.grnNumber)).toBe(
      (await db.goodsReceipt.findFirst({ where: { purchaseOrderId: IDS.po2 } }))!.grnNumber,
    )

    // 2. REPLAY ISTEGA ključa (retry omrežja) → 200 ISTI GRN, ZERO efekt
    const res2 = await poReceive(
      req(`/api/purchase-orders/${IDS.po2}/receive`, 'POST', {
        receivedItems: [{ itemId: `${IDS.po2}-i-oil`, quantityReceived: 2 }],
        supplierDocNumber: 'DOB-R212-A',
        idempotencyKey: IDEM_RECV_1,
      }),
      withParams(IDS.po2),
    )
    expect(res2.status).toBe(200)
    const body2 = await asJson(res2)
    expect(body2.replay).toBe(true)
    expect(String(body2.message)).toContain('replay')
    expect((body2.grn as Record<string, unknown>).grnNumber).toBe(grnA.grnNumber)

    // §21: NI sekundarnega zalogovnega efekta — vse števce nespremenjene
    const oilAfter = await db.inventoryItem.findUnique({ where: { id: IDS.invOil } })
    expect(Number(oilAfter!.quantity)).toBe(17)
    expect(await db.stockTransaction.count({ where: { inventoryItemId: IDS.invOil, type: 'procurement' } })).toBe(2)
    expect(await db.goodsReceipt.count({ where: { purchaseOrderId: IDS.po2 } })).toBe(1)
    expect(await db.supplierPriceHistory.count({ where: { inventoryItemId: IDS.invOil } })).toBe(2)

    // GRN nosi persistiran ključ (replay check ga išče)
    const grnRow = await db.goodsReceipt.findFirst({ where: { purchaseOrderId: IDS.po2 } })
    expect(grnRow!.idempotencyKey).toBe(IDEM_RECV_1)
  })

  it('G7: cap-check ostane pred replay-om za NOV ključ (400 presega, brez GRN)', async () => {
    // 2 + 4 > 5 → cap-check (neodvisen od ključa — nov ključ NI replay)
    const res = await poReceive(
      req(`/api/purchase-orders/${IDS.po2}/receive`, 'POST', {
        receivedItems: [{ itemId: `${IDS.po2}-i-oil`, quantityReceived: 4 }],
        idempotencyKey: IDEM_RECV_2,
      }),
      withParams(IDS.po2),
    )
    expect(res.status).toBe(400)
    const body = await asJson(res)
    expect(String(body.error)).toContain('presega naročeno')

    // Fail-closed: NI GRN (neuspel tx ne persistira ključa), zaloga nespremenjena
    expect(await db.goodsReceipt.count({ where: { purchaseOrderId: IDS.po2 } })).toBe(1)
    const oil = await db.inventoryItem.findUnique({ where: { id: IDS.invOil } })
    expect(Number(oil!.quantity)).toBe(17)
  })

  it('§5 EXACT-ONCE (G7): zaključek z 2. ključem → GRN-2 + AP; replay OBIH ključev po terminalnem statusu → 200 ISTI GRN (ne 400)', async () => {
    // Zaključek prevzema (3 preostala L) z drugim ključem
    const resC = await poReceive(
      req(`/api/purchase-orders/${IDS.po2}/receive`, 'POST', {
        receivedItems: [{ itemId: `${IDS.po2}-i-oil`, quantityReceived: 3 }],
        supplierDocNumber: 'DOB-R212-B',
        idempotencyKey: IDEM_RECV_2,
      }),
      withParams(IDS.po2),
    )
    expect(resC.status).toBe(200)
    const bodyC = await asJson(resC)
    expect(bodyC.replay).toBe(false)
    const grnB = bodyC.grn as Record<string, unknown>
    expect(grnB.grnNumber).not.toBe(
      (await db.goodsReceipt.findFirst({ where: { purchaseOrderId: IDS.po2, idempotencyKey: IDEM_RECV_1 } }))!.grnNumber,
    )

    // Zaloga 17 → 20, PO received, AP avto-obveznost, 3. procurement tx
    const oil = await db.inventoryItem.findUnique({ where: { id: IDS.invOil } })
    expect(Number(oil!.quantity)).toBe(20)
    expect((await db.purchaseOrder.findUnique({ where: { id: IDS.po2 } }))!.status).toBe('received')
    expect(await db.accountsPayable.count({ where: { purchaseOrderId: IDS.po2 } })).toBe(1)
    expect(await db.stockTransaction.count({ where: { inventoryItemId: IDS.invOil, type: 'procurement' } })).toBe(3)
    expect(await db.supplierPriceHistory.count({ where: { inventoryItemId: IDS.invOil } })).toBe(3)

    // KLJUČNA G7 VREDNOST: retry 1. ključa PO terminalnem statusu → REPLAY
    // 200 ISTI GRN (prej: 400 'že popolnoma prejeto' — klient brez naznanila)
    const resR1 = await poReceive(
      req(`/api/purchase-orders/${IDS.po2}/receive`, 'POST', {
        receivedItems: [{ itemId: `${IDS.po2}-i-oil`, quantityReceived: 2 }],
        idempotencyKey: IDEM_RECV_1,
      }),
      withParams(IDS.po2),
    )
    expect(resR1.status).toBe(200)
    const bodyR1 = await asJson(resR1)
    expect(bodyR1.replay).toBe(true)
    expect((bodyR1.grn as Record<string, unknown>).grnNumber).toBe(
      (await db.goodsReceipt.findFirst({ where: { purchaseOrderId: IDS.po2, idempotencyKey: IDEM_RECV_1 } }))!.grnNumber,
    )

    // Replay 2. ključa → ISTI GRN-2
    const resR2 = await poReceive(
      req(`/api/purchase-orders/${IDS.po2}/receive`, 'POST', {
        receivedItems: [{ itemId: `${IDS.po2}-i-oil`, quantityReceived: 3 }],
        idempotencyKey: IDEM_RECV_2,
      }),
      withParams(IDS.po2),
    )
    expect(resR2.status).toBe(200)
    const bodyR2 = await asJson(resR2)
    expect(bodyR2.replay).toBe(true)
    expect((bodyR2.grn as Record<string, unknown>).grnNumber).toBe(grnB.grnNumber)

    // EN efekt čez oba replay-a
    const oilAfter = await db.inventoryItem.findUnique({ where: { id: IDS.invOil } })
    expect(Number(oilAfter!.quantity)).toBe(20)
    expect(await db.goodsReceipt.count({ where: { purchaseOrderId: IDS.po2 } })).toBe(2)
    expect(await db.stockTransaction.count({ where: { inventoryItemId: IDS.invOil, type: 'procurement' } })).toBe(3)
    expect(await db.accountsPayable.count({ where: { purchaseOrderId: IDS.po2 } })).toBe(1)
  })

  it('G7: legacy brez ključa BIT-FOR-BIT nespremenjen — duplicate no-key → 400 "že popolnoma prejeto"', async () => {
    const res = await poReceive(
      req(`/api/purchase-orders/${IDS.po2}/receive`, 'POST', {
        receivedItems: [{ itemId: `${IDS.po2}-i-oil`, quantityReceived: 1 }],
        supplierDocNumber: 'DOB-R212-RETRY-NO-KEY',
      }),
      withParams(IDS.po2),
    )
    expect(res.status).toBe(400)
    const body = await asJson(res)
    expect(String(body.error)).toContain('že popolnoma prejeto')

    // EN efekt tudi brez ključa (terminal guard ostaja edina zavora za no-key)
    const oil = await db.inventoryItem.findUnique({ where: { id: IDS.invOil } })
    expect(Number(oil!.quantity)).toBe(20)
    expect(await db.goodsReceipt.count({ where: { purchaseOrderId: IDS.po2 } })).toBe(2)
  })
})

// ============================================
// R214 G4: batch-PUT adjust — kanon pariteta (ključavnice + Serializable +
// FEFO razknjižba + audit). P3 CAS/skipped semantika ostaje (unit P3 + r214).
// ============================================
describe('R214 G4: batch-PUT adjust — FEFO razknjižba po serijah + INVENTORY_ADJUST audit', () => {
  it('G4: batch write-off 4 kos → zaloga 4, StockTx −4 (8.00), FEFO: LOT-G4-B 3 + LOT-G4-A 1, audit INVENTORY_ADJUST tx-fresh', async () => {
    const res = await adjustBatchPut(
      req('/api/inventory/adjust', 'PUT', {
        items: [{ inventoryItemId: IDS.invBatch, quantity: 4, reason: 'G4 odpis poškodovanih' }],
        type: 'write-off',
        reason: 'G4 odpis poškodovanih',
        employeeName: IDS.employee,
      }),
    )
    expect(res.status).toBe(200)
    const body = (await asJson(res)) as {
      processed: number
      results: { transaction: { quantity: number; previousQty: number; newQty: number; totalCost: number } }[]
      skipped: { inventoryItemId: string; reason: string }[]
    }
    expect(body.processed).toBe(1)
    expect(body.skipped).toHaveLength(0)
    expect(body.results[0].transaction.quantity).toBe(-4)
    expect(body.results[0].transaction.previousQty).toBe(8)
    expect(body.results[0].transaction.newQty).toBe(4)
    expect(body.results[0].transaction.totalCost).toBe(8.0)

    // zaloga 8 → 4
    const after = await db.inventoryItem.findUnique({ where: { id: IDS.invBatch } })
    expect(Number(after!.quantity)).toBe(4)

    // FEFO: LOT-G4-B (izteče prej) porabljen v CELOSTI (3), LOT-G4-A 1
    const lotB = await db.inventoryBatch.findFirst({ where: { inventoryItemId: IDS.invBatch, lotNumber: 'LOT-G4-B' } })
    const lotA = await db.inventoryBatch.findFirst({ where: { inventoryItemId: IDS.invBatch, lotNumber: 'LOT-G4-A' } })
    expect(Number(lotB!.quantityRemaining)).toBe(0)
    expect(lotB!.status).toBe('EXHAUSTED')
    expect(Number(lotA!.quantityRemaining)).toBe(4)

    // alokacijske vrstice: −3 + −1 (kanon konvencija: odvod = negativen quantity), vezane na ISTI StockTx
    const stockTx = await db.stockTransaction.findFirst({
      where: { inventoryItemId: IDS.invBatch, type: 'write-off', quantity: -4 },
      orderBy: { createdAt: 'desc' },
    })
    expect(stockTx).toBeTruthy()
    const allocations = await db.stockBatchAllocation.findMany({ where: { stockTransactionId: stockTx!.id } })
    expect(allocations).toHaveLength(2)
    const byLot = new Map<string, number>()
    for (const a of allocations) {
      const batch = await db.inventoryBatch.findUnique({ where: { id: a.batchId } })
      byLot.set(batch!.lotNumber, Number(a.quantity))
    }
    expect(byLot.get('LOT-G4-B')).toBe(-3)
    expect(byLot.get('LOT-G4-A')).toBe(-1)

    // audit INVENTORY_ADJUST: tx-fresh vrednosti (prej NI bilo audita — G4)
    const audits = await db.auditLog.findMany({
      where: { entityId: IDS.invBatch, action: 'INVENTORY_ADJUST' },
      orderBy: { timestamp: 'desc' },
    })
    expect(audits.length).toBeGreaterThanOrEqual(1)
    const latest = JSON.parse(audits[0].details) as {
      type: string
      quantity: number
      previousQty: number
      newQty: number
      itemName: string
    }
    expect(latest).toMatchObject({
      type: 'write-off',
      quantity: -4,
      previousQty: 8,
      newQty: 4,
      itemName: 'R214 Batch Artikel',
    })
  })

  it('G4: mixed batch — uspešen odpis + skip (premalo) → attempt StockTx qty 0, skip BREZ alokacije in BREZ audita', async () => {
    // invOil ima 20 (veriga B/G7); 999 → skip. invBatch zahteva 2 → ok (4 → 2).
    const res = await adjustBatchPut(
      req('/api/inventory/adjust', 'PUT', {
        items: [
          { inventoryItemId: IDS.invBatch, quantity: 2, reason: 'G4 partial odpis' },
          { inventoryItemId: IDS.invOil, quantity: 999, reason: 'G4 premalo' },
        ],
        type: 'write-off',
        reason: 'G4 mixed odpis',
        employeeName: IDS.employee,
      }),
    )
    expect(res.status).toBe(200)
    const body = (await asJson(res)) as {
      processed: number
      results: { transaction: { inventoryItemId: string; quantity: number; newQty: number } }[]
      skipped: { inventoryItemId: string; reason: string }[]
    }
    expect(body.processed).toBe(1)
    expect(body.skipped).toHaveLength(1)
    expect(body.skipped[0].inventoryItemId).toBe(IDS.invOil)
    expect(body.skipped[0].reason).toContain('Premalo zaloge')
    expect(body.skipped[0].reason).toContain('na voljo: 20')
    expect(body.skipped[0].reason).toContain('potrebno: 999')
    expect(body.results[0].transaction.inventoryItemId).toBe(IDS.invBatch)
    expect(body.results[0].transaction.newQty).toBe(2)

    // invBatch 4 → 2 (FEFO nadaljuje na LOT-G4-A)
    const batchAfter = await db.inventoryItem.findUnique({ where: { id: IDS.invBatch } })
    expect(Number(batchAfter!.quantity)).toBe(2)
    const lotA2 = await db.inventoryBatch.findFirst({ where: { inventoryItemId: IDS.invBatch, lotNumber: 'LOT-G4-A' } })
    expect(Number(lotA2!.quantityRemaining)).toBe(2)

    // skip: NE gre v negativo, attempt StockTx quantity 0 (P3 semantika nespremenjena)
    const oilAttempt = await db.stockTransaction.findFirst({
      where: { inventoryItemId: IDS.invOil, quantity: 0, reason: { contains: 'POSKUS' } },
      orderBy: { createdAt: 'desc' },
    })
    expect(oilAttempt).toBeTruthy()
    const oilAfter = await db.inventoryItem.findUnique({ where: { id: IDS.invOil } })
    expect(Number(oilAfter!.quantity)).toBe(20)

    // skip NI revidiran kot odpis: NI INVENTORY_ADJUST za invOil (poskus viden v StockTx POSKUS vrstici)
    const oilAudits = await db.auditLog.count({ where: { entityId: IDS.invOil, action: 'INVENTORY_ADJUST' } })
    expect(oilAudits).toBe(0)
  })
})

// ============================================
// R216 G2 (epik #144, #152 korak 2): SALE-CHAIN COGS BUSINESS-DAY BUCKETIRANJE
// ============================================
// Vrzel G2 (docs/INVENTORY-CHAIN.md §5): prihodki so bucketirani na
// Order.paidAt (LJ poslovni dan — fiskalni kanon P2-08), COGS pa na
// StockTransaction.createdAt (čas ognja). Naročilo ob 23:50 / plačilo ob
// 00:10 je razdelilo bruto maržo med dneva.
//
// FIX (kanon pariteta, usklajeno z #148 ljubljanaDayBounds): sale-chain
// ('sale' + 'return') se bucketira na order.paidAt — ISTI kanon kot
// prihodki; fallback (brez plačanega naročila) + ne-naročilni tipi ostanejo
// na času ognja (BIT-FOR-BIT). Relacija StockTransaction.order (0026).
//
// SCENARIJ (fikcni datumi 2026-03-15/16/17 — neodvisni od dana poganjanja):
//   • naročilo ognjeno 23:50 (D1), plačano 00:10 (D2), sale COGS 10.00;
//   • storno (return −2.00) ognjen DAN KASNEJE (D3 01:00) — sledi prodajnemu
//     poslovnemu dnevu (D2), ne svojemu času ognja;
//   • neplačano naročilo (sale 5.00, paidAt null) → fallback createdAt (D2);
//   • sale brez orderId (1.00) → fallback createdAt (D2);
//   • prevzem (30.00) → ostane na času ognja (D2).
// OPOMBA: blok teče PO §19/§21 rekonciliaciji (file order) in uporablja
// fikcne datume izven »danes« — ne vpliva na prejšnja EOD vrata.
describe('R216 G2: sale-chain COGS na poslovnem dnevu prodaje (order.paidAt kanon)', () => {
  const D1 = '2026-03-15'
  const D2 = '2026-03-16'
  const D3 = '2026-03-17'
  const b = (d: string) => ljubljanaDayBounds(d)
  const dayEndIncl = (d: string) => new Date(b(d).end.getTime() - 1)

  // Kanonski trenutki (LJ lokalni časi, DST-varno prek ljubljanaDayBounds)
  const FIRE_AT = new Date(b(D1).end.getTime() - 10 * 60_000) // D1 23:50 LJ (ognjen)
  const PAID_AT = new Date(b(D2).start.getTime() + 10 * 60_000) // D2 00:10 LJ (plačan)
  const RETURN_AT = new Date(b(D3).start.getTime() + 60 * 60_000) // D3 01:00 LJ (storno naslednji dan)
  const PROC_AT = new Date(b(D2).start.getTime() + 9 * 3600_000) // D2 09:00 LJ
  const UNPAID_AT = new Date(b(D2).start.getTime() + 12 * 3600_000) // D2 12:00 LJ
  const NOORDER_AT = new Date(b(D2).start.getTime() + 13 * 3600_000) // D2 13:00 LJ

  beforeAll(async () => {
    // Naročili (direktno v bazi — vrzel G2 je BRALNA bucketing lastnost, ne
    // write-pot; orderNumber unikaten po lokaciji — visok offset izven drill obsega)
    await db.order.create({
      data: {
        id: `${RUN_ID}-g2-order-paid`,
        orderNumber: 900001,
        locationId: IDS.location,
        status: 'completed',
        paymentStatus: 'paid',
        paidAt: PAID_AT,
        inventoryDeducted: true,
        subtotal: 82, tax: 18, total: 100, totalWithTip: 100,
      },
    })
    await db.order.create({
      data: {
        id: `${RUN_ID}-g2-order-unpaid`,
        orderNumber: 900002,
        locationId: IDS.location,
        status: 'in-progress',
        paymentStatus: 'unpaid',
      },
    })

    // Zalogovne vrstice (koherentna previous/new veriga po §21 vzorcu)
    await db.stockTransaction.create({
      data: { inventoryItemId: IDS.invG2, type: 'procurement', quantity: 50, previousQty: 0, newQty: 50, costPerUnit: 0.6, totalCost: 30, createdAt: PROC_AT, reason: 'G2 prevzem (ostane na casu ognja)' },
    })
    await db.stockTransaction.create({
      data: { inventoryItemId: IDS.invG2, type: 'sale', quantity: -1, previousQty: 50, newQty: 49, costPerUnit: 10, totalCost: 10, orderId: `${RUN_ID}-g2-order-paid`, createdAt: FIRE_AT, reason: 'G2 cross-midnight prodaja (23:50)' },
    })
    await db.stockTransaction.create({
      data: { inventoryItemId: IDS.invG2, type: 'return', quantity: 0.2, previousQty: 49, newQty: 49.2, costPerUnit: 10, totalCost: -2, orderId: `${RUN_ID}-g2-order-paid`, createdAt: RETURN_AT, reason: 'G2 storno dan kasneje — sledi prodajnemu dnevu' },
    })
    await db.stockTransaction.create({
      data: { inventoryItemId: IDS.invG2, type: 'sale', quantity: -0.5, previousQty: 49.2, newQty: 48.7, costPerUnit: 10, totalCost: 5, orderId: `${RUN_ID}-g2-order-unpaid`, createdAt: UNPAID_AT, reason: 'G2 neplacano narocilo (fallback createdAt)' },
    })
    await db.stockTransaction.create({
      data: { inventoryItemId: IDS.invG2, type: 'sale', quantity: -0.1, previousQty: 48.7, newQty: 48.6, costPerUnit: 10, totalCost: 1, createdAt: NOORDER_AT, reason: 'G2 sale brez orderId (fallback createdAt)' },
    })
  })

  it('G2: poslovni dan D2 — sale Σ 16 (10+5+1), return Σ −2, procurement 30; EOD marža koherentna (100 − 16)', async () => {
    const raw = await fetchEodData(b(D2).start, dayEndIncl(D2), IDS.location)
    const byType = new Map(raw.stockCostGroups.map((g) => [g.type, Number(g._sum.totalCost)]))
    // sale-chain po poslovnem dnevu prodaje: cross-midnight sale (ognjen D1
    // 23:50!) je na D2; neplačano (fallback) + brez orderId (fallback) tudi
    expect(byType.get('sale')).toBe(16)
    // storno (ognjen D3 01:00!) je na prodajnem dnevu D2 — ne na svojem času ognja
    expect(byType.get('return')).toBe(-2)
    // ne-naročilni tip ostane na času ognja
    expect(byType.get('procurement')).toBe(30)

    // EOD metriko: prihodek (plačano naročilo, paidAt D2) in njegov COGS na ISTEM dnevu
    const metrics = computeEodMetrics(raw)
    expect(metrics.summary.totalRevenue).toBe(100)
    expect(metrics.costs.cogs).toBe(16)
    expect(metrics.costs.procurementCost).toBe(30)
    expect(metrics.costs.grossProfit).toBeCloseTo(84, 2)
  })

  it('G2: požarni dan D1 in dan kasneje D3 — sale-chain NI na času ognja (prazne skupine)', async () => {
    const rawD1 = await fetchEodData(b(D1).start, dayEndIncl(D1), IDS.location)
    expect(rawD1.stockCostGroups).toEqual([])

    const rawD3 = await fetchEodData(b(D3).start, dayEndIncl(D3), IDS.location)
    // storno (ognjen D3) je šel na prodajni dan D2 — D3 je prazen
    expect(rawD3.stockCostGroups).toEqual([])
  })

  it('G2: kanon pariteta čez konzumente — financial (OR-veje) in dashboard furs-shift-cogs vidita ISTO bucketiranje', async () => {
    // Financial report (konzument 1): stockCostGroups index 7
    const fin = await fetchFinancialData(b(D2).start, dayEndIncl(D2), b(D2).start, dayEndIncl(D2), IDS.location)
    const finStock = fin[7] as Parameters<typeof computeStockCosts>[0]
    const finByType = new Map(finStock.map((g) => [g.type, Number(g._sum.totalCost)]))
    expect(finByType.get('sale')).toBe(16)
    expect(finByType.get('return')).toBe(-2)
    // financial margin: grossProfit = revenue − cogs (writeOff ločeno: abs(write-off)+abs(return) = 2)
    const costs = computeStockCosts(finStock, 100)
    expect(costs.cogs).toBe(16)
    expect(costs.writeOffCost).toBe(2)
    expect(costs.grossProfit).toBeCloseTo(84, 2)

    // Financial požarni dan D1: sale-chain odsoten (prej bi poklical 23:50 ognjen sale)
    const finD1 = await fetchFinancialData(b(D1).start, dayEndIncl(D1), b(D1).start, dayEndIncl(D1), IDS.location)
    expect(finD1[7]).toEqual([])

    // Dashboard furs-shift-cogs (konzument 3): todayCogs 16, marža koherentna
    const dash = await fetchFursShiftCogs(b(D2).start, b(D3).start, 100, IDS.location)
    expect(dash.todayCogs).toBe(16)
    expect(dash.grossProfit).toBeCloseTo(84, 2)
    expect(dash.grossMargin).toBeCloseTo(84, 2)
  })
})
