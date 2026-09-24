// ============================================
// BATCH PREPARATION — pisalni kanon (epic #115 P0-04, runda 122)
// ============================================
// Sub-recepture / priprava vmesnih produktov: sestavine (input
// InventoryItem) → proizveden vmesni produkt (output InventoryItem).
//
// ARHITEKTURNO PRAVILO (§28, pariteta z R106/R119/R120/R121):
// InventoryItem.quantity se NIKOLI ne spremeni mimo sledljivega ledger
// dogodka. Zaključek priprave (completeBatchPreparation) aplicira porabo
// in proizvodnjo SKOZI isti zalogovni kanon kot prodaja/odpad/restock/
// inventura:
//   $transaction(Serializable) + pg_advisory_xact_lock('inv-stock:' + itemId)
//   (SKUPNI ključ z vsemi pisci; determinističen vrstni red po itemId —
//   brez deadlockov) + tx-fresh re-read + CAS quantity guard +
//   StockTransaction ('batch-consumption' / 'batch-production',
//   previousQty → newQty) + FEFO razknjižba input odpisa (R120 mirror).
//
// ZAŠČITI (P0 §2 checklist: retry ne podvoji porabe):
//   • create: idempotency po (locationId, idempotencyKey) — R116 kanon
//   • complete: pogojni updateMany status claim (DRAFT → COMPLETED) —
//     dva vzporedna complete-a → natanko ENA aplicirana poraba (409)
//   • CAS guard per artikel (quantity: currentQty) — sočasna prodaja → 409
//
// COST BASIS (P0-05 tla): outputCostPerUnit = Σ(input.totalCost po
// tx-fresh cenah) / outputQuantity — izdelek dobi realni proizvodni
// strošek; food cost v recepturah uporablja isti source of truth.

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { toNum, round2, round3, multiply, divide } from '@/lib/decimal'
import { inventoryStockLockKey } from '@/app/api/inventory/_helpers/stock-mutations'
import { recordBatchConsumption } from '@/lib/stock-deduction/batch-allocation'

const TX_OPTS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  timeout: 15_000,
} as const

type TransactionClient = Prisma.TransactionClient

export const BATCH_PREPARATION_STATUSES = ['DRAFT', 'COMPLETED', 'CANCELLED'] as const
export type BatchPreparationStatus = (typeof BATCH_PREPARATION_STATUSES)[number]

/** Nova kanonična tipa ledgerja (aditivna razširitev StockTransaction.type) */
export const BATCH_TX_CONSUMPTION = 'batch-consumption' as const
export const BATCH_TX_PRODUCTION = 'batch-production' as const

/** Scope pravila (pariteta z waste/stocktake kanonom — DOKUMENTIRANO):
 *  artikel je v obsegu lokacije, če je lastnik lokacije ALI skupni (NULL) vir. */
function itemInScopeWhere(inventoryItemId: string, locationId: string) {
  return {
    id: inventoryItemId,
    OR: [{ locationId }, { locationId: null }],
  }
}

export interface BatchLineInput {
  inventoryItemId: string
  quantity: number
}

interface ResolvedLine {
  inventoryItemId: string
  itemName: string
  unit: string
  quantity: number
  costPerUnit: number
}

/**
 * Validacija + snapshot vrstic priprave (lastna lokacija ALI skupni vir;
 * distinct sestavine; sestavina ≠ izhodni artikel; količine > 0).
 */
async function resolveLines(
  tx: TransactionClient,
  opts: { locationId: string; lines: BatchLineInput[]; outputItemId: string },
): Promise<ResolvedLine[]> {
  const { locationId, lines, outputItemId } = opts

  if (lines.length === 0) {
    throw { error: 'Priprava potrebuje vsaj eno sestavino', status: 400 }
  }
  if (lines.length > 50) {
    throw { error: 'Priprava ima preveč sestavin (max 50)', status: 400 }
  }

  // Distinct — ista sestavina dvakrat je modeliran napake (@@unique jo tudi DDZ)
  const seen = new Set<string>()
  const normalized: { inventoryItemId: string; quantity: number }[] = []
  for (const l of lines) {
    const quantity = round3(l.quantity)
    if (!(quantity > 0)) {
      throw { error: 'Količina sestavine mora biti večja od 0', status: 400 }
    }
    if (seen.has(l.inventoryItemId)) {
      throw { error: 'Sestavina je navedena dvakrat — združite količine', status: 400 }
    }
    seen.add(l.inventoryItemId)
    if (l.inventoryItemId === outputItemId) {
      throw { error: 'Izhodni artikel ne sme biti hkrati sestavina', status: 400 }
    }
    normalized.push({ inventoryItemId: l.inventoryItemId, quantity })
  }

  const resolved: ResolvedLine[] = []
  for (const l of normalized) {
    const item = await tx.inventoryItem.findFirst({
      where: itemInScopeWhere(l.inventoryItemId, locationId),
    })
    if (!item) {
      throw {
        error: 'Sestavina ni najdena v obsegu te lokacije',
        status: 400,
      }
    }
    resolved.push({
      inventoryItemId: item.id,
      itemName: item.name,
      unit: item.unit,
      quantity: l.quantity,
      costPerUnit: toNum(item.costPerUnit),
    })
  }
  return resolved
}

/** Validacija izhodnega artikla (obseg lokacije) — vrača tx-fresh vrstico. */
async function resolveOutputItem(tx: TransactionClient, outputItemId: string, locationId: string) {
  const item = await tx.inventoryItem.findFirst({
    where: itemInScopeWhere(outputItemId, locationId),
  })
  if (!item) {
    throw { error: 'Izhodni artikel ni najden v obsegu te lokacije', status: 400 }
  }
  return item
}

// ============================================
// CREATE — nova priprava (DRAFT) s snapshotom sestavin
// ============================================

export async function createBatchPreparation(opts: {
  locationId: string
  outputItemId: string
  outputQuantity: number
  note: string
  idempotencyKey: string | null
  createdByName: string
  lines: BatchLineInput[]
}): Promise<{ preparation: Record<string, unknown>; replay: boolean }> {
  const { locationId, outputItemId, outputQuantity, note, idempotencyKey, createdByName, lines } = opts

  return await db.$transaction(async (tx: TransactionClient) => {
    // Replay pod transakcijo (P2002 race-path lovimo še v ruti)
    if (idempotencyKey) {
      const existing = await tx.batchPreparation.findFirst({
        where: { locationId, idempotencyKey },
        include: { lines: true },
      })
      if (existing) {
        return { preparation: existing as unknown as Record<string, unknown>, replay: true }
      }
    }

    const outputQuantityNorm = round3(outputQuantity)
    if (!(outputQuantityNorm > 0)) {
      throw { error: 'Proizvedena količina mora biti večja od 0', status: 400 }
    }

    const outputItem = await resolveOutputItem(tx, outputItemId, locationId)
    const resolvedLines = await resolveLines(tx, { locationId, lines, outputItemId })

    const preparation = await tx.batchPreparation.create({
      data: {
        locationId,
        status: 'DRAFT',
        outputItemId,
        outputQuantity: outputQuantityNorm,
        outputUnit: outputItem.unit,
        note,
        createdByName,
        idempotencyKey,
        lines: {
          create: resolvedLines.map(l => ({
            inventoryItemId: l.inventoryItemId,
            itemName: l.itemName,
            unit: l.unit,
            quantity: l.quantity,
            costPerUnit: l.costPerUnit,
          })),
        },
      },
      include: { lines: true },
    })

    return { preparation: preparation as unknown as Record<string, unknown>, replay: false }
  }, TX_OPTS)
}

// ============================================
// PATCH — urejanje osnutka (samo DRAFT)
// ============================================

export async function updateBatchPreparationDraft(opts: {
  preparationId: string
  locationScope: string | null
  outputItemId?: string
  outputQuantity?: number
  note?: string
  lines?: BatchLineInput[]
}): Promise<Record<string, unknown>> {
  const { preparationId, locationScope } = opts

  return await db.$transaction(async (tx: TransactionClient) => {
    const preparation = await tx.batchPreparation.findFirst({
      where: {
        id: preparationId,
        ...(locationScope ? { locationId: locationScope } : {}),
      },
      include: { lines: true },
    })
    if (!preparation) {
      throw { error: 'Priprava ni najdena', status: 404 }
    }
    if (preparation.status !== 'DRAFT') {
      throw {
        error: 'Priprava je zaključena ali preklicana — urejanje ni več mogoče',
        status: 409,
      }
    }

    const data: Record<string, unknown> = {}

    if (opts.note !== undefined) {
      data.note = opts.note
    }

    if (opts.outputItemId !== undefined || opts.outputQuantity !== undefined) {
      const outputItemId = opts.outputItemId ?? preparation.outputItemId
      const outputQuantity =
        opts.outputQuantity !== undefined ? round3(opts.outputQuantity) : toNum(preparation.outputQuantity)
      if (!(outputQuantity > 0)) {
        throw { error: 'Proizvedena količina mora biti večja od 0', status: 400 }
      }
      // Izhodni artikel ne sme postati sestavina
      if (preparation.lines.some(l => l.inventoryItemId === outputItemId)) {
        throw { error: 'Izhodni artikel ne sme biti hkrati sestavina', status: 400 }
      }
      const outputItem = await resolveOutputItem(tx, outputItemId, preparation.locationId)
      data.outputItemId = outputItemId
      data.outputQuantity = outputQuantity
      data.outputUnit = outputItem.unit
    }

    if (opts.lines !== undefined) {
      const effectiveOutput = (data.outputItemId as string | undefined) ?? preparation.outputItemId
      const resolvedLines = await resolveLines(tx, {
        locationId: preparation.locationId,
        lines: opts.lines,
        outputItemId: effectiveOutput,
      })
      await tx.batchPreparationLine.deleteMany({ where: { preparationId } })
      // Eksplicitna per-vrstična kreacija (ne nested create) — enaka semantika
      // kot realna DB transakcija, enostavneje testirljivo (trap-DB hišni stil)
      for (const l of resolvedLines) {
        await tx.batchPreparationLine.create({
          data: {
            preparationId,
            inventoryItemId: l.inventoryItemId,
            itemName: l.itemName,
            unit: l.unit,
            quantity: l.quantity,
            costPerUnit: l.costPerUnit,
          },
        })
      }
    }

    const updated = await tx.batchPreparation.update({
      where: { id: preparationId },
      data,
      include: { lines: true },
    })
    return updated as unknown as Record<string, unknown>
  }, TX_OPTS)
}

// ============================================
// CANCEL — preklic osnutka (brez zalogovnih učinkov)
// ============================================

export async function cancelBatchPreparation(opts: {
  preparationId: string
  locationScope: string | null
}): Promise<Record<string, unknown>> {
  const { preparationId, locationScope } = opts

  return await db.$transaction(async (tx: TransactionClient) => {
    // Tx-fresh re-read za scope + semantiko napak (404 tujega ID-ja, ne 409)
    const existing = await tx.batchPreparation.findFirst({
      where: {
        id: preparationId,
        ...(locationScope ? { locationId: locationScope } : {}),
      },
    })
    if (!existing) {
      throw { error: 'Priprava ni najdena', status: 404 }
    }

    // Pogojni claim — dva vzporedna preklica: natanko ena sprememba
    const guard = await tx.batchPreparation.updateMany({
      where: { id: preparationId, status: 'DRAFT' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    })
    if (guard.count === 0) {
      throw {
        error: 'Zaključene (COMPLETED) priprave ni mogoče preklicati',
        status: 409,
      }
    }

    const updated = await tx.batchPreparation.findFirst({ where: { id: preparationId } })
    return updated as unknown as Record<string, unknown>
  }, TX_OPTS)
}

// ============================================
// COMPLETE — zaključek: poraba sestavin + proizvodnja izdelka
// ============================================

export interface BatchPreparationSummary {
  totalInputCost: number
  outputCostPerUnit: number
  outputQuantity: number
  inputs: { itemName: string; consumed: number; newQty: number }[]
}

/**
 * Zaključek priprave (P0-04: sestavine → izdelek, vse v ENI transakciji):
 *  1. tx-fresh scoped re-read glave (DRAFT)
 *  2. POGOJNI status claim (DRAFT → COMPLETED) — dvojni complete nemogočen
 *  3. per sestavina (determinističen vrstni red po itemId — brez deadlockov):
 *     advisory lock → tx-fresh zaloga → dovolj zaloge → CAS decrement →
 *     StockTransaction 'batch-consumption' + FEFO razknjižba (R120)
 *  4. izhodni artikel: advisory lock → CAS increment + costPerUnit =
 *     proizvodni strošek → StockTransaction 'batch-production'
 *  5. header snapshot: totalInputCost, outputCostPerUnit, povezana tx
 */
export async function completeBatchPreparation(opts: {
  preparationId: string
  locationScope: string | null
  completedByName: string
}): Promise<{ preparation: Record<string, unknown>; summary: BatchPreparationSummary }> {
  const { preparationId, locationScope, completedByName } = opts

  return await db.$transaction(async (tx: TransactionClient) => {
    // 1. Tx-fresh scoped re-read
    const preparation = await tx.batchPreparation.findFirst({
      where: {
        id: preparationId,
        ...(locationScope ? { locationId: locationScope } : {}),
      },
      include: { lines: true },
    })
    if (!preparation) {
      throw { error: 'Priprava ni najdena', status: 404 }
    }
    if (preparation.status === 'COMPLETED') {
      throw { error: 'Priprava je že zaključena', status: 409 }
    }
    if (preparation.status !== 'DRAFT') {
      throw { error: 'Preklicane priprave ni mogoče zaključiti', status: 409 }
    }
    if (preparation.lines.length === 0) {
      throw { error: 'Priprava nima sestavin — dodajte vsaj eno', status: 400 }
    }

    // 2. Pogojni claim — ZAŠČITA PRED DVOJNIM ZAKLJUČKOM. Dva vzporedna
    // complete-a: drugi updateMany zadenje 0 vrstic (status že COMPLETED) → 409.
    const claim = await tx.batchPreparation.updateMany({
      where: { id: preparationId, status: 'DRAFT' },
      data: { status: 'COMPLETED' },
    })
    if (claim.count === 0) {
      throw { error: 'Priprava je že zaključena (sočasen dostop)', status: 409 }
    }

    const outputQuantity = toNum(preparation.outputQuantity)

    // 3. Poraba sestavin — determinističen vrstni red zaklepov (po itemId)
    const sortedLines = [...preparation.lines].sort((a, b) =>
      a.inventoryItemId < b.inventoryItemId ? -1 : a.inventoryItemId > b.inventoryItemId ? 1 : 0,
    )

    const summary: BatchPreparationSummary = {
      totalInputCost: 0,
      outputCostPerUnit: 0,
      outputQuantity,
      inputs: [],
    }

    for (const line of sortedLines) {
      // Skupni advisory lock ključ z VSEMI zalogovnimi pisci (R106/R119/R120/R121)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${inventoryStockLockKey(line.inventoryItemId)}))`

      // Tx-fresh scoped re-read sestavine (lastna lokacija ALI skupni vir)
      const item = await tx.inventoryItem.findFirst({
        where: itemInScopeWhere(line.inventoryItemId, preparation.locationId),
      })
      if (!item) {
        throw {
          error: `Sestavina "${line.itemName}" ni več na voljo v obsegu te lokacije`,
          status: 400,
        }
      }

      const currentQty = toNum(item.quantity)
      const consumed = toNum(line.quantity)

      if (currentQty < consumed) {
        throw {
          error: `Zaloga sestavine "${line.itemName}" ni dovoljšnja (na stanju ${currentQty}, potrebno ${consumed})`,
          status: 400,
        }
      }

      // CAS guard — sočasna prodaja/odpad/inventura → 409 retry
      const newQty = round3(currentQty - consumed)
      const updated = await tx.inventoryItem.updateMany({
        where: { id: line.inventoryItemId, quantity: currentQty },
        data: { quantity: newQty },
      })
      if (updated.count === 0) {
        throw {
          error: `Zaloga za "${line.itemName}" je bila spremenjena sočasno — poskusite znova`,
          status: 409,
        }
      }

      const costPerUnit = toNum(item.costPerUnit)
      const lineCost = round2(multiply(consumed, costPerUnit))
      summary.totalInputCost = round2(summary.totalInputCost + lineCost)

      const stockTx = await tx.stockTransaction.create({
        data: {
          inventoryItemId: line.inventoryItemId,
          type: BATCH_TX_CONSUMPTION,
          quantity: -consumed,
          previousQty: currentQty,
          newQty,
          costPerUnit: item.costPerUnit,
          totalCost: lineCost,
          reason: `Priprava: izdelek × ${outputQuantity}`,
          note: preparation.note || '',
          employeeName: completedByName,
        },
      })

      // R120 mirror: odpis sestavine → FEFO razknjižba po serijah
      // (brez serij ostane unbatched, sledljivost ne podre priprave)
      await recordBatchConsumption(tx, {
        inventoryItemId: line.inventoryItemId,
        quantity: consumed,
        stockTransactionId: stockTx.id,
      })

      await tx.batchPreparationLine.update({
        where: { id: line.id },
        data: { inputStockTransactionId: stockTx.id },
      })

      summary.inputs.push({ itemName: line.itemName, consumed, newQty })
    }

    // 4. Izhodni artikel — advisory lock + CAS increment + cost basis
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${inventoryStockLockKey(preparation.outputItemId)}))`

    const outputItem = await tx.inventoryItem.findFirst({
      where: itemInScopeWhere(preparation.outputItemId, preparation.locationId),
    })
    if (!outputItem) {
      throw {
        error: 'Izhodni artikel ni več na voljo v obsegu te lokacije',
        status: 400,
      }
    }

    const outputCurrent = toNum(outputItem.quantity)
    const outputNew = round3(outputCurrent + outputQuantity)
    const outputCostPerUnit = round2(divide(summary.totalInputCost, outputQuantity))

    const outputUpdated = await tx.inventoryItem.updateMany({
      where: { id: preparation.outputItemId, quantity: outputCurrent },
      data: { quantity: outputNew, costPerUnit: outputCostPerUnit },
    })
    if (outputUpdated.count === 0) {
      throw {
        error: 'Zaloga izhodnega artikla je bila spremenjena sočasno — poskusite znova',
        status: 409,
      }
    }

    const outputTx = await tx.stockTransaction.create({
      data: {
        inventoryItemId: preparation.outputItemId,
        type: BATCH_TX_PRODUCTION,
        quantity: outputQuantity,
        previousQty: outputCurrent,
        newQty: outputNew,
        costPerUnit: outputCostPerUnit,
        totalCost: summary.totalInputCost,
        reason: `Priprava: ${preparation.lines.length} sestavin → izdelek`,
        note: preparation.note || '',
        employeeName: completedByName,
      },
    })

    // 5. Zaključek glave (claim je že nastavil status; dopolnimo snapshot)
    const completed = await tx.batchPreparation.update({
      where: { id: preparationId },
      data: {
        outputCostPerUnit,
        totalInputCost: summary.totalInputCost,
        outputUnit: outputItem.unit,
        completedByName,
        completedAt: new Date(),
        outputStockTransactionId: outputTx.id,
      },
    })

    summary.outputCostPerUnit = outputCostPerUnit

    return {
      preparation: completed as unknown as Record<string, unknown>,
      summary,
    }
  }, TX_OPTS)
}
