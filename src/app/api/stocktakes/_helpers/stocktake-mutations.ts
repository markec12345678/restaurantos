// ============================================
// STOCKTAKE — pisalni kanon (epic #115 P0-01, runda 121)
// ============================================
// Fizična inventura + reconciliation po P0-01 kanonu:
//   theoretical stock → physical count → variance → approval → adjustment →
//   new baseline.
//
// ARHITEKTURNO PRAVILO (§28, pariteta z R106/R119/R120): InventoryItem.quantity
// se NIKOLI ne spremeni mimo sledljivega ledger dogodka. Potrditev inventure
// (approveStocktake) aplicira korekcije per vrstico SKOZI isti zalogovni
// kanon kot prodaja/odpad/restock:
//   $transaction(Serializable) + pg_advisory_xact_lock('inv-stock:' + itemId)
//   + tx-fresh re-read + absolutna nastavitev = preštetje + StockTransaction
//   ('adjustment' pozitivno / 'write-off' negativno, previousQty → newQty)
//   + FEFO batch razknjižba negativne razlike (R120 mirror odpisa).
//
// AVTORITATIVNA razlika = counted − tx-fresh zaloga OB POTRDITVI (ledger
// resnica). Snapshot razlika na vrstici (counted − expected ob štetju) je
// pregledna informacija; če se je zaloga med štetjem in potrditvijo spremenila
// (prodaja/odpad), ledger pokaže dejanski korektivni vnos — veriga
// previousQty → newQty ostane brezvsnežna.
//
// ZAŠČITA PRED DVOJNO POTRDITVIJO: approve claim je pogojni updateMany
// (status IN_REVIEW → APPROVED) znotraj transakcije — dva vzporedna approve-a
// povzročita natanko ENO aplicirano korekcijo (drugi dobi 409 / P2034 → 409).

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { toNum, round2, round3, multiply } from '@/lib/decimal'
import { inventoryStockLockKey } from '@/app/api/inventory/_helpers/stock-mutations'
import { recordBatchConsumption } from '@/lib/stock-deduction/batch-allocation'

const TX_OPTS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  timeout: 15_000,
} as const

type TransactionClient = Prisma.TransactionClient

export const STOCKTAKE_STATUSES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'CANCELLED'] as const
export type StocktakeStatus = (typeof STOCKTAKE_STATUSES)[number]

/**
 * Scope pravila za vrstice inventure (pariteta z waste kanonom — DOKUMENTIRANO):
 * artikel je v obsegu inventure, če je lastnik lokacije ALI skupni (NULL) vir.
 * Korekcija skupnega vira ob potrditvi doseže fizično stanje na tej lokaciji
 * (enaka semantika kot prodajna poraba skupne zaloge).
 */
function stocktakeItemWhere(inventoryItemId: string, locationId: string) {
  return {
    id: inventoryItemId,
    OR: [{ locationId }, { locationId: null }],
  }
}

// ============================================
// CREATE — nova inventura (DRAFT) z snapshotom teoretičnega stanja
// ============================================

export async function createStocktake(opts: {
  locationId: string
  note: string
  idempotencyKey: string | null
  createdByName: string
}): Promise<{ stocktake: Record<string, unknown>; replay: boolean }> {
  const { locationId, note, idempotencyKey, createdByName } = opts

  return await db.$transaction(async (tx: TransactionClient) => {
    // Replay pod transakcijo (P2002 race-path lovimo še v ruti)
    if (idempotencyKey) {
      const existing = await tx.stocktake.findFirst({
        where: { locationId, idempotencyKey },
        include: { lines: true },
      })
      if (existing) {
        return { stocktake: existing as unknown as Record<string, unknown>, replay: true }
      }
    }

    // Snapshot vseh artiklov obsega (lastna lokacija ALI skupni vir)
    const items = await tx.inventoryItem.findMany({
      where: { OR: [{ locationId }, { locationId: null }] },
      orderBy: { name: 'asc' },
    })

    const stocktake = await tx.stocktake.create({
      data: {
        locationId,
        status: 'DRAFT',
        note,
        createdByName,
        idempotencyKey,
        lines: {
          create: items.map(item => ({
            inventoryItemId: item.id,
            itemName: item.name,
            unit: item.unit,
            expectedQuantity: item.quantity,
            costPerUnit: item.costPerUnit,
          })),
        },
      },
      include: { lines: true },
    })

    return { stocktake: stocktake as unknown as Record<string, unknown>, replay: false }
  }, TX_OPTS)
}

// ============================================
// UPDATE COUNTS — vnos/popravek štetja (samo DRAFT = ponovno štetje)
// ============================================

export interface StocktakeCountInput {
  lineId: string
  countedQuantity: number
  lineNote?: string
}

export async function updateStocktakeCounts(opts: {
  stocktakeId: string
  locationScope: string | null
  counts: StocktakeCountInput[]
  countedByName: string
}): Promise<Record<string, unknown>> {
  const { stocktakeId, locationScope, counts, countedByName } = opts

  return await db.$transaction(async (tx: TransactionClient) => {
    // Tx-fresh scoped re-read glave
    const stocktake = await tx.stocktake.findFirst({
      where: {
        id: stocktakeId,
        ...(locationScope ? { locationId: locationScope } : {}),
      },
      include: { lines: true },
    })
    if (!stocktake) {
      throw { error: 'Inventura ni najdena', status: 404 }
    }
    if (stocktake.status !== 'DRAFT') {
      throw {
        error: 'Štetje je zaklenjeno — inventura ni več v pripravi (DRAFT)',
        status: 409,
      }
    }

    const lineById = new Map(
      stocktake.lines.map(l => [l.id, l] as const),
    )
    const now = new Date()

    for (const c of counts) {
      const line = lineById.get(c.lineId)
      if (!line) {
        throw { error: `Vrstica ne pripada tej inventuri`, status: 400 }
      }
      const counted = round3(c.countedQuantity)
      if (counted < 0) {
        throw { error: `Preštecona količina ne sme biti negativna (${line.itemName})`, status: 400 }
      }
      const expected = toNum(line.expectedQuantity)
      const cost = toNum(line.costPerUnit)
      const variance = round3(counted - expected)
      await tx.stocktakeItem.update({
        where: { id: line.id },
        data: {
          countedQuantity: counted,
          varianceQuantity: variance,
          varianceValue: round2(multiply(variance, cost)),
          lineNote: c.lineNote ?? line.lineNote,
          countedAt: now,
          countedByName,
        },
      })
    }

    const updated = await tx.stocktake.findFirst({
      where: { id: stocktakeId },
      include: { lines: true },
    })
    return updated as unknown as Record<string, unknown>
  }, TX_OPTS)
}

// ============================================
// STATE TRANSITIONS — submit / recount / cancel (pogojni status guard)
// ============================================

/**
 * Pogojni prehod stanja — zaščita pred podvojenim prehodom (dva vzporedna
 * klica: natanko ena sprememba, drugi dobi 409). Vrne tx-fresh stanje.
 */
async function transitionStatus(
  tx: TransactionClient,
  opts: {
    stocktakeId: string
    locationScope: string | null
    from: string[]
    to: string
    patch: Record<string, unknown>
    conflictError: string
  },
): Promise<Record<string, unknown>> {
  const { stocktakeId, locationScope, from, to, patch, conflictError } = opts

  // Tx-fresh re-read za scope + semantiko napak (404 tujega ID-ja, ne 409)
  const existing = await tx.stocktake.findFirst({
    where: {
      id: stocktakeId,
      ...(locationScope ? { locationId: locationScope } : {}),
    },
  })
  if (!existing) {
    throw { error: 'Inventura ni najdena', status: 404 }
  }

  const guard = await tx.stocktake.updateMany({
    where: { id: stocktakeId, status: { in: from } },
    data: { status: to, ...patch },
  })
  if (guard.count === 0) {
    throw { error: conflictError, status: 409 }
  }

  const updated = await tx.stocktake.findFirst({
    where: { id: stocktakeId },
  })
  return updated as unknown as Record<string, unknown>
}

export async function submitStocktake(opts: {
  stocktakeId: string
  locationScope: string | null
}): Promise<Record<string, unknown>> {
  const stocktakeId = opts.stocktakeId

  return await db.$transaction(async (tx: TransactionClient) => {
    // Vsaj ena preštecona vrstica — prazna "pregled" inventura ni uporabna
    const existing = await tx.stocktake.findFirst({
      where: {
        id: stocktakeId,
        ...(opts.locationScope ? { locationId: opts.locationScope } : {}),
      },
    })
    if (!existing) {
      throw { error: 'Inventura ni najdena', status: 404 }
    }
    const countedCount = await tx.stocktakeItem.count({
      where: { stocktakeId, countedQuantity: { not: null } },
    })
    if (countedCount === 0) {
      throw { error: 'Inventura nima nobene preštecene vrstice', status: 400 }
    }

    return await transitionStatus(tx, {
      stocktakeId,
      locationScope: opts.locationScope,
      from: ['DRAFT'],
      to: 'IN_REVIEW',
      patch: { submittedAt: new Date() },
      conflictError: 'Inventura je že v pregledu ali zaključena',
    })
  }, TX_OPTS)
}

export async function recountStocktake(opts: {
  stocktakeId: string
  locationScope: string | null
}): Promise<Record<string, unknown>> {
  return await db.$transaction((tx: TransactionClient) =>
    transitionStatus(tx, {
      stocktakeId: opts.stocktakeId,
      locationScope: opts.locationScope,
      from: ['IN_REVIEW'],
      to: 'DRAFT',
      patch: { recountCount: { increment: 1 } },
      conflictError: 'Samo inventura v pregledu (IN_REVIEW) se lahko vrne v ponovno štetje',
    }), TX_OPTS)
}

export async function cancelStocktake(opts: {
  stocktakeId: string
  locationScope: string | null
}): Promise<Record<string, unknown>> {
  return await db.$transaction((tx: TransactionClient) =>
    transitionStatus(tx, {
      stocktakeId: opts.stocktakeId,
      locationScope: opts.locationScope,
      from: ['DRAFT', 'IN_REVIEW'],
      to: 'CANCELLED',
      patch: { cancelledAt: new Date() },
      conflictError: 'Zaključene (APPROVED) inventure ni mogoče preklicati',
    }), TX_OPTS)
}

// ============================================
// APPROVE — potrditev: apliciraj korekcije skozi zalogovni kanon
// ============================================

export interface StocktakeApprovalSummary {
  adjustedLines: number
  totalVarianceValue: number
  lines: { itemName: string; appliedDiff: number; newQty: number }[]
}

/**
 * Potrditev inventure (P0-01: approval → adjustment → new baseline).
 *
 * ENA Serializable transakcija:
 *  1. tx-fresh scoped re-read glave (IN_REVIEW)
 *  2. POGOJNI status claim (IN_REVIEW → APPROVED) — dvojna potrditev nemogoča
 *  3. per vrstica (counted, razvrščeno po itemId — determinističen vrstni red
 *     advisory zaklepov, brez deadlockov): tx-fresh zaloga, appliedDiff =
 *     counted − current; neničelna razlika → absolutna nastavitev = counted +
 *     StockTransaction ('adjustment'/'write-off', reason 'Inventura') +
 *     FEFO batch razknjižba minusa (R120 mirror)
 *  4. snapshot razlike na vrstici ostane pregledna informacija; aplicirana
 *     resnica = povezani StockTransaction
 */
export async function approveStocktake(opts: {
  stocktakeId: string
  locationScope: string | null
  approvedByName: string
}): Promise<{ stocktake: Record<string, unknown>; summary: StocktakeApprovalSummary }> {
  const { stocktakeId, locationScope, approvedByName } = opts

  return await db.$transaction(async (tx: TransactionClient) => {
    // 1. Tx-fresh scoped re-read
    const stocktake = await tx.stocktake.findFirst({
      where: {
        id: stocktakeId,
        ...(locationScope ? { locationId: locationScope } : {}),
      },
      include: { lines: true },
    })
    if (!stocktake) {
      throw { error: 'Inventura ni najdena', status: 404 }
    }
    if (stocktake.status === 'APPROVED') {
      throw { error: 'Inventura je že potrjena', status: 409 }
    }
    if (stocktake.status !== 'IN_REVIEW') {
      throw { error: 'Samo inventura v pregledu (IN_REVIEW) se lahko potrdi', status: 409 }
    }

    // 2. Pogojni claim — ZAŠČITA PRED DVOJNO POTRDITVIJO. Dva vzporedna
    // approve-a: drugi updateMany zadenje 0 vrstic (status že APPROVED) → 409.
    const claim = await tx.stocktake.updateMany({
      where: { id: stocktakeId, status: 'IN_REVIEW' },
      data: { status: 'APPROVED' },
    })
    if (claim.count === 0) {
      throw { error: 'Inventura je že potrjena (sočasen dostop)', status: 409 }
    }

    // 3. Korekcije per vrstica — determinističen vrstni red zaklepov
    const countedLines = stocktake.lines
      .filter(l => l.countedQuantity !== null && l.countedQuantity !== undefined)
      .sort((a, b) => (a.inventoryItemId < b.inventoryItemId ? -1 : a.inventoryItemId > b.inventoryItemId ? 1 : 0))

    const summary: StocktakeApprovalSummary = {
      adjustedLines: 0,
      totalVarianceValue: 0,
      lines: [],
    }

    for (const line of countedLines) {
      // Skupni advisory lock ključ z VSEMI zalogovnimi pisci (R106/R119/R120):
      // inventura se serializira s prodajo/odpadom/restockom → veriga
      // previousQty → newQty ostane brezvsnežna.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${inventoryStockLockKey(line.inventoryItemId)}))`

      // Tx-fresh scoped re-read artikla (lastna lokacija ALI skupni vir)
      const item = await tx.inventoryItem.findFirst({
        where: stocktakeItemWhere(line.inventoryItemId, stocktake.locationId),
      })
      if (!item) {
        throw {
          error: `Zalogov artikel "${line.itemName}" ni več na voljo v obsegu te lokacije`,
          status: 400,
        }
      }

      const currentQty = toNum(item.quantity)
      const counted = toNum(line.countedQuantity)
      const appliedDiff = round3(counted - currentQty)

      if (appliedDiff !== 0) {
        // Absolutna nastavitev = preštetje (new baseline). CAS guard
        // (quantity: currentQty) — sočasna prodaja/odpad = 409 retry.
        const updated = await tx.inventoryItem.updateMany({
          where: { id: line.inventoryItemId, quantity: currentQty },
          data: { quantity: counted },
        })
        if (updated.count === 0) {
          throw {
            error: `Zaloga za "${line.itemName}" je bila spremenjena sočasno — poskusite znova`,
            status: 409,
          }
        }

        const costPerUnit = toNum(line.costPerUnit)
        const stockTx = await tx.stockTransaction.create({
          data: {
            inventoryItemId: line.inventoryItemId,
            type: appliedDiff > 0 ? 'adjustment' : 'write-off',
            quantity: appliedDiff,
            previousQty: currentQty,
            newQty: currentQty + appliedDiff,
            costPerUnit: item.costPerUnit,
            totalCost: round2(multiply(Math.abs(appliedDiff), costPerUnit)),
            reason: `Inventura: ${line.itemName}`,
            note: line.lineNote || stocktake.note || '',
            employeeName: approvedByName,
          },
        })

        // R120 mirror: negativna korekcija = odpis → FEFO razknjižba po serijah
        // (sale-safety: brez serij ostane unbatched, sledljivost ne podre inventure)
        if (appliedDiff < 0) {
          await recordBatchConsumption(tx, {
            inventoryItemId: line.inventoryItemId,
            quantity: Math.abs(appliedDiff),
            stockTransactionId: stockTx.id,
          })
        }

        await tx.stocktakeItem.update({
          where: { id: line.id },
          data: { stockTransactionId: stockTx.id },
        })

        summary.adjustedLines += 1
        summary.totalVarianceValue = round2(
          summary.totalVarianceValue + round2(multiply(appliedDiff, costPerUnit)),
        )
        summary.lines.push({ itemName: line.itemName, appliedDiff, newQty: currentQty + appliedDiff })
      }
    }

    // 4. Zaključek glave (claim je že nastavil status; dopolnimo meta)
    const approved = await tx.stocktake.update({
      where: { id: stocktakeId },
      data: {
        approvedByName,
        approvedAt: new Date(),
      },
    })

    return {
      stocktake: approved as unknown as Record<string, unknown>,
      summary,
    }
  }, TX_OPTS)
}
