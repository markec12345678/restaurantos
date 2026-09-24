// ============================================
// WASTE LEDGER — pisalni kanon (epic #115 §3, runda 119)
// ============================================
// R119 razširja R106 inventory pisalni kanon z odpadom: WasteRecord + povezani
// StockTransaction ('write-off') + atomarni pogojni decrement nastanejo v ENI
// transakciji (prej: odpis iz /api/inventory/adjust NIMA poslovne odpadne
// sledi — razlog/vrednost/uporabnik — in UI WasteTracker je fabriciral podatke).
//
// Kanon (zrcali adjustInventoryItemStock / R105/R106):
//   $transaction(Serializable) + pg_advisory_xact_lock('inv-stock:' + itemId)
//   + tx-fresh scoped re-read + atomarni pogojni decrement (quantity >= qty,
//   negativna zaloga nemogoča) + strukturirani { error, status } throw-i +
//   P2002/P2034 → 409 v catch blokih rut.
//
// KLJUČNA lastnost: advisory lock ključ je SKUPAJ z vsemi ostalimi zalogovnimi
// pisci (inventoryStockLockKey) → odpad, prodaja, restock, adjust in reversali
// se na istem artiklu striktno serializirajo → StockTransaction zgodovina
// (previousQty → newQty) ostane brezvsnežna veriga.

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { toNum, round2, round3, multiply } from '@/lib/decimal'
import { inventoryStockLockKey } from '@/app/api/inventory/_helpers/stock-mutations'
import { allocateBatchesFEFO, applyBatchAllocations, restoreBatchesFromAllocations } from '@/lib/stock-deduction/batch-allocation'
import { wasteReasonLabel, type WasteReason } from '@/lib/waste-reasons'

const TX_OPTS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  timeout: 10_000,
} as const

type TransactionClient = Prisma.TransactionClient

export interface WasteRecordResult {
  record: Record<string, unknown>
  replay: boolean
}

/**
 * Scope pravila za odpad (razlika od adjust kanona je DOKUMENTIRANA):
 *   - lokacijsko vezana seja / super-admin z izrecnim locationId: artikel mora
 *     imeti locationId = ciljna lokacija ALI NULL (skupni vir — enaka semantika
 *     kot prodajna poraba, ki sme odvesti skupno zalogo na kateri koli lokaciji).
 *   - super-admin MORA podati locationId (fail-closed 400 v ruti).
 * Odpad je fizičen dogodek NA LOKACIJI → WasteRecord.locationId je vedno
 * konkretna lokacija, tudi ko je odvedena skupna (NULL) zaloga.
 */
function wasteItemWhere(inventoryItemId: string, locationId: string) {
  return {
    id: inventoryItemId,
    OR: [{ locationId }, { locationId: null }],
  }
}

/**
 * R120 (epic #115 §4): razporeditev odpada po serijah.
 *  • batchId podan → fail-closed validacija (status/remaining/lokacija/artikel)
 *    + pogojni decrement serije; napaka → strukturirani throw (uporabnik je
 *    izbral KONKRETNO serijo, tiho FEFO ne bi bil pošten).
 *  • batchId NI podan → FEFO avtomatska razporeditev (sale-safety: preostanek
 *    brez serij je dovoljen, odpad zaradi sledljivosti ne pade).
 */
async function allocateWasteToBatches(
  tx: Prisma.TransactionClient,
  opts: {
    inventoryItemId: string
    locationId: string
    quantity: number
    stockTransactionId: string
    batchId: string | null
  },
): Promise<void> {
  const { inventoryItemId, locationId, quantity, stockTransactionId, batchId } = opts

  if (batchId) {
    // Tx-fresh re-read + fail-closed validacija izbrane serije
    const batch = await tx.inventoryBatch.findFirst({
      where: { id: batchId, inventoryItemId },
    })
    if (!batch) {
      throw { error: 'Izbrana serija ni najdena za ta artikel', status: 400 }
    }
    if (batch.locationId != null && batch.locationId !== locationId) {
      // Serija tuge lokacije — nikoli ne odpišemo tuj zaloge (tenant kanon)
      throw { error: 'Izbrana serija ne pripada tej lokaciji', status: 400 }
    }
    if (batch.status !== 'ACTIVE') {
      throw { error: 'Izbrana serija ni več aktivna', status: 400 }
    }
    const remaining = round3(toNum(batch.quantityRemaining))
    if (remaining < quantity) {
      throw {
        error: `Serija ${batch.lotNumber} ima samo ${remaining} preostanek (potrebno ${quantity})`,
        status: 400,
      }
    }
    const guard = await tx.inventoryBatch.updateMany({
      where: { id: batchId, status: 'ACTIVE', quantityRemaining: { gte: quantity } },
      data: { quantityRemaining: { decrement: quantity } },
    })
    if (guard.count === 0) {
      throw { error: 'Serija je bila spremenjena sočasno — poskusite znova', status: 409 }
    }
    await tx.inventoryBatch.updateMany({
      where: { id: batchId, status: 'ACTIVE', quantityRemaining: { lte: 0 } },
      data: { status: 'EXHAUSTED' },
    })
    await applyBatchAllocations(tx, {
      stockTransactionId,
      inventoryItemId,
      slices: [{ batchId, quantity: -quantity }],
    })
    return
  }

  // FEFO avtomatska razporeditev (First Expired, First Out)
  const slices = await allocateBatchesFEFO(tx, { inventoryItemId, quantity })
  if (slices.length > 0) {
    await applyBatchAllocations(tx, { stockTransactionId, inventoryItemId, slices })
  }
}

/**
 * R119: zabeleži odpad — atomarno: zaščiten odpis + StockTransaction
 * ('write-off') + WasteRecord snapshot v ENI Serializable transakciji.
 * Idempotency (R116 kanon): enak (locationId, idempotencyKey) → replay iste
 * vrstice (retry NIKOLI ne odpiše zaloge dvakrat).
 * R120 (epic #115 §4): opcijski batchId — odpad lahko cilja KONKRETNO serijo
 * (npr. pretečen lot); brez njega se razporedi FEFO.
 */
export async function createWasteRecord(opts: {
  locationId: string
  inventoryItemId: string
  quantity: number
  reason: WasteReason
  note: string
  idempotencyKey: string | null
  recordedByUserId: string | null
  batchId?: string | null
}): Promise<WasteRecordResult> {
  const { locationId, inventoryItemId, quantity, reason, note, idempotencyKey, recordedByUserId, batchId } = opts

  return await db.$transaction(async (tx: TransactionClient) => {
    // Advisory lock per item — SKUPNI ključ z vsemi zalogovnimi pisci (R106):
    // odpad, prodaja, restock, adjust in reversali se na istem artiklu
    // serializirajo → StockTransaction veriga (previousQty → newQty) brez prepletov.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${inventoryStockLockKey(inventoryItemId)}))`

    // Replay preverimo POD ključavnico (še pred odpisom) — enak ključ = brez
    // sekundarnega odpisa; P2002 race-path lovimo še v ruti (dva vzporedna
    // zahtevka prideta sem istočasno).
    if (idempotencyKey) {
      const existing = await tx.wasteRecord.findFirst({
        where: { locationId, idempotencyKey },
      })
      if (existing) {
        return { record: existing as unknown as Record<string, unknown>, replay: true }
      }
    }

    // Tx-fresh scoped re-read (artikel = lastna ali skupna zaloga te lokacije)
    const item = await tx.inventoryItem.findFirst({
      where: wasteItemWhere(inventoryItemId, locationId),
    })
    if (!item) {
      throw { error: 'Zalogov artikel ni najden na tej lokaciji', status: 404 }
    }

    const currentQty = toNum(item.quantity)

    // Atomarni pogojni decrement (R106: negativna zaloga NEMOGOČA tudi, če
    // Serializable konflikt ubeži validaciji)
    const guard = await tx.inventoryItem.updateMany({
      where: { id: inventoryItemId, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } },
    })
    if (guard.count === 0) {
      throw {
        error: `Odpis (${quantity}) presega razpoložljivo zalogo (${currentQty}) za "${item.name}"`,
        status: 400,
      }
    }

    const updated = await tx.inventoryItem.findUnique({
      where: { id: inventoryItemId },
      select: { quantity: true },
    })
    const newQty = toNum(updated?.quantity ?? currentQty - quantity)
    const costPerUnit = toNum(item.costPerUnit)
    const totalCost = round2(multiply(quantity, costPerUnit))

    const stockTx = await tx.stockTransaction.create({
      data: {
        inventoryItemId,
        type: 'write-off',
        quantity: -quantity,
        previousQty: currentQty,
        newQty,
        costPerUnit: item.costPerUnit,
        totalCost,
        reason: `Odpad — ${wasteReasonLabel(reason)}`,
        note,
        employeeName: recordedByUserId ?? '',
      },
    })

    // R120 (epic #115 §4): razporeditev odpada po serijah (izbrana lot ali FEFO)
    await allocateWasteToBatches(tx, {
      inventoryItemId,
      locationId,
      quantity,
      stockTransactionId: stockTx.id,
      batchId: batchId ?? null,
    })

    const record = await tx.wasteRecord.create({
      data: {
        locationId,
        inventoryItemId,
        quantity,
        unit: item.unit,
        reason,
        note,
        costPerUnit: item.costPerUnit,
        totalCost,
        stockTransactionId: stockTx.id,
        idempotencyKey,
        recordedByUserId,
      },
    })

    return { record: record as unknown as Record<string, unknown>, replay: false }
  }, TX_OPTS)
}

/**
 * R119: razveljavitev odpada — kompenzacijski StockTransaction ('return') +
 * označba reversedAt. Ledger vrstica se NIKOLI ne briše (revizijska sled);
 * kompenzacija uporablja snapshot cene odpisa (znesek par exactly cancela
 * write-off totalCost v zalogovnem ledgerju).
 */
export async function reverseWasteRecord(opts: {
  wasteRecordId: string
  sessionLocationId: string | null
  reversedByUserId: string | null
}): Promise<Record<string, unknown>> {
  const { wasteRecordId, sessionLocationId, reversedByUserId } = opts

  return await db.$transaction(async (tx: TransactionClient) => {
    // Tx-fresh scoped re-read (preverimo, da zapis sploh obstaja + scope)
    const record = await tx.wasteRecord.findFirst({
      where: {
        id: wasteRecordId,
        ...(sessionLocationId ? { locationId: sessionLocationId } : {}),
      },
    })
    if (!record) {
      throw { error: 'Zapis odpada ni najden', status: 404 }
    }
    if (record.reversedAt) {
      throw { error: 'Zapis odpada je že razveljavljen', status: 409 }
    }

    // Zaklenemo artikel s SKUPNIM zalogovnim ključem (pariteta z ustvarjanjem)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${inventoryStockLockKey(record.inventoryItemId)}))`

    const item = await tx.inventoryItem.findFirst({
      where: wasteItemWhere(record.inventoryItemId, record.locationId),
    })
    if (!item) {
      throw { error: 'Zalogov artikel ni več na voljo na tej lokaciji', status: 404 }
    }

    const currentQty = toNum(item.quantity)
    const qty = toNum(record.quantity)

    // Kompenzacijski return — increment (ne more pasti pod 0); totalCost iz
    // snapshot-a odpisa → par z write-off vnosom se točno poravna.
    const stockTx = await tx.stockTransaction.create({
      data: {
        inventoryItemId: record.inventoryItemId,
        type: 'return',
        quantity: qty,
        previousQty: currentQty,
        newQty: currentQty + qty,
        costPerUnit: item.costPerUnit,
        totalCost: record.totalCost,
        reason: 'Razveljavitev odpada',
        note: record.note,
        employeeName: reversedByUserId ?? '',
      },
    })

    await tx.inventoryItem.update({
      where: { id: record.inventoryItemId },
      data: { quantity: { increment: qty } },
    })

    // R120 (epic #115 §4): mirror vračanje serij — reversala vrne količino v
    // TOČNO TE serije, ki jih je odpis odvzel (snapshot alokacij write-off tx);
    // odpad brez serij (legacy/unbatched) ostane unbatched vračilo.
    if (record.stockTransactionId) {
      await restoreBatchesFromAllocations(tx, {
        sourceStockTransactionIds: [record.stockTransactionId],
        newStockTransactionId: stockTx.id,
        inventoryItemId: record.inventoryItemId,
      })
    }

    const reversed = await tx.wasteRecord.update({
      where: { id: record.id },
      data: {
        reversedAt: new Date(),
        reversalStockTransactionId: stockTx.id,
      },
    })

    return reversed as unknown as Record<string, unknown>
  }, TX_OPTS)
}
