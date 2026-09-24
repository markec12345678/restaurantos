// ============================================
// BATCH / LOT / EXPIRY — FEFO poraba + sledljivost (epic #115 §4, runda 120)
// ============================================
//
// R120 razširja zalogovni kanon (R106/R119) s sledljivostjo serij:
//
//   supplier → prevzem ('procurement' + InventoryBatch) → poraba/odpad
//   (StockBatchAllocation −) → vračilo/reversala (+)
//
// ARHITEKTURNO PRAVILO (§28 epica): batch NI neodvisen vir zaloge.
// InventoryItem.quantity + StockTransaction ostata edina source-of-truth
// za količino; batch je sledljivostna projekcija prevzemov na ledger.
// Vsak odvod količine poteka po obstoječem atomarnem kanonu (pogojni
// updateMany na InventoryItem), nato pa se ISTA količina razporedi po
// serijah FEFO — First Expired, First Out:
//
//   orderBy: expiryDate ASC (PG: NULLS LAST → brez roka uporabe porabi
//            zadnji), receivedAt ASC, createdAt ASC
//
// VARNOSTNE LASTNOSTI:
//  • batch.quantityRemaining NIKOLI negativen — vsak odvod je pogojni
//    updateMany (quantityRemaining >= slice), enak vzorec kot R106 guard.
//  • Poraba ni odvisna od serij: če serije ne pokrijejo celotne količine
//    (nezabeležena/legacy zaloga), je preostanek "unbatched" — prodaja
//    ZARADI sledljivosti NIKOLI ne pade.
//  • Konkurenca: dve sočasni prodaji na istem artiklu — alokacija ponovno
//    prebere serije ob vsakem pogojnem decrementu; izgubljeno serijo
//    (count=0) preskoči in nadaljuje z naslednjo. Pod Serializable+advisory
//    lock (restock/adjust/waste) je alokacija striktno serializirana; na
//    prodajni poti (Read Committed + pogojni guardi) je deterministična
//    kolikor je mogoče, brez blokade prodaje.
//  • Sale-safety first: nepričakovana napaka alokacije se ZAPIše v log in
//    pogoltne — prodajna transakcija se ne sme podreti zaradi sledljivosti.

import { toNum, round3 } from '../decimal'
import { logger } from '../logger'
import { Prisma } from '@prisma/client'

type TransactionClient = Prisma.TransactionClient

export interface BatchAllocationSlice {
  batchId: string
  quantity: number // − odvod iz serije / + vnos v serijo
}

const MAX_ALLOCATION_PASSES = 4

/**
 * FEFO naslovi serij za podano količino: pogojno decrementira
 * quantityRemaining po expiryDate ASC (NULL zadnji) → receivedAt ASC.
 * Vrne rezane alokacije (vsota ≤ quantity; preostanek = unbatched).
 * Nikoli ne meče poslovnih napak — nezadostnost serij je veljavna izid.
 */
export async function allocateBatchesFEFO(
  tx: TransactionClient,
  opts: { inventoryItemId: string; quantity: number },
): Promise<BatchAllocationSlice[]> {
  const { inventoryItemId, quantity } = opts
  const need = round3(Math.max(0, quantity))
  if (need <= 0) return []

  const slices: BatchAllocationSlice[] = []
  let remainingNeed = need

  for (let pass = 0; pass < MAX_ALLOCATION_PASSES && remainingNeed > 0; pass++) {
    // FEFO vrstni red: expiryDate ASC (NULLS LAST v PG), nato receivedAt,
    // nato createdAt. Samo aktivne serije s preostankom > 0.
    const batches = await tx.inventoryBatch.findMany({
      where: {
        inventoryItemId,
        status: 'ACTIVE',
        quantityRemaining: { gt: 0 },
      },
      orderBy: [{ expiryDate: 'asc' }, { receivedAt: 'asc' }, { createdAt: 'asc' }],
    })

    let progressThisPass = false

    for (const batch of batches) {
      if (remainingNeed <= 0) break
      const available = round3(toNum(batch.quantityRemaining))
      if (available <= 0) continue
      const take = Math.min(available, remainingNeed)

      // Pogojni decrement (R106 vzorec): druga transakcija nam lahko med
      // branjem in pisanjem vzame del serije — count=0 → poskusimo še
      // enkrat z vračanim prebranom (naslednji pass).
      const guard = await tx.inventoryBatch.updateMany({
        where: {
          id: batch.id,
          status: 'ACTIVE',
          quantityRemaining: { gte: take },
        },
        data: { quantityRemaining: { decrement: take } },
      })
      if (guard.count === 0) continue

      // Ali je serija izčrpana? → status EXHAUSTED (pogojno, da ne povozimo
      // morebitnega vzporednega zapisa)
      const fresh = await tx.inventoryBatch.findUnique({
        where: { id: batch.id },
        select: { quantityRemaining: true },
      })
      if (fresh && toNum(fresh.quantityRemaining) <= 0) {
        await tx.inventoryBatch.updateMany({
          where: { id: batch.id, status: 'ACTIVE', quantityRemaining: { lte: 0 } },
          data: { status: 'EXHAUSTED' },
        })
      }

      slices.push({ batchId: batch.id, quantity: -take })
      remainingNeed = round3(remainingNeed - take)
      progressThisPass = true
    }

    if (!progressThisPass) break // serije so črpane → preostanek unbatched
  }

  return slices
}

/**
 * Zapiše alokacijske vrstice za podano StockTransaction (sled ledgerja).
 * Prazne alokacije = brezvrstic (unbatched količina).
 */
export async function applyBatchAllocations(
  tx: TransactionClient,
  opts: {
    stockTransactionId: string
    inventoryItemId: string
    slices: BatchAllocationSlice[]
  },
): Promise<void> {
  const { stockTransactionId, inventoryItemId, slices } = opts
  for (const slice of slices) {
    await tx.stockBatchAllocation.create({
      data: {
        batchId: slice.batchId,
        stockTransactionId,
        inventoryItemId,
        quantity: slice.quantity,
      },
    })
  }
}

/**
 * Sale-safety ovijalec za prodajne poti (deduct-recipe/deduct-direct/
 * online-order/webhooks): FEFO alokacija + vrstice v ENEM koraku.
 * Nepričakovana napaka se pogoltne (prodaja se NE podre zaradi sledljivosti)
 * — količinski kanon (pogojni decrement InventoryItem) je bil že izveden.
 */
export async function recordBatchConsumption(
  tx: TransactionClient,
  opts: { inventoryItemId: string; quantity: number; stockTransactionId: string },
): Promise<void> {
  try {
    const slices = await allocateBatchesFEFO(tx, {
      inventoryItemId: opts.inventoryItemId,
      quantity: opts.quantity,
    })
    if (slices.length === 0) return
    await applyBatchAllocations(tx, {
      stockTransactionId: opts.stockTransactionId,
      inventoryItemId: opts.inventoryItemId,
      slices,
    })
  } catch (err) {
    logger.error(
      'BATCH',
      `FEFO alokacija za artikel ${opts.inventoryItemId} ni uspela (prodaja ostane veljavna, količina je unbatched): ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/**
 * Vrne serije izvornih alokacij (mirror vračanje po snapshot kanonu
 * P1-inventory): za vsako odvodno vrstico izvornih transakcij pogojno
 * incrementira quantityRemaining (serija se vrne v ACTIVE, če je bila
 * EXHAUSTED) in zapiše pozitivno alokacijo na novo (vračilno) transakcijo.
 * Vrne dejansko vračene rezine (serija, ki je medtem izginila, se preskoči —
 * količina ostane unbatched).
 */
export async function restoreBatchesFromAllocations(
  tx: TransactionClient,
  opts: {
    sourceStockTransactionIds: string[]
    newStockTransactionId: string
    inventoryItemId: string
  },
): Promise<BatchAllocationSlice[]> {
  const { sourceStockTransactionIds, newStockTransactionId, inventoryItemId } = opts
  if (sourceStockTransactionIds.length === 0) return []

  const sourceAllocations = await tx.stockBatchAllocation.findMany({
    where: {
      stockTransactionId: { in: sourceStockTransactionIds },
      inventoryItemId,
      quantity: { lt: 0 }, // samo odvodi se vračajo (vnosi so že vhodne serije)
    },
  })

  const restored: BatchAllocationSlice[] = []
  for (const alloc of sourceAllocations) {
    const qty = round3(-toNum(alloc.quantity))
    if (qty <= 0) continue
    const guard = await tx.inventoryBatch.updateMany({
      where: { id: alloc.batchId },
      data: {
        quantityRemaining: { increment: qty },
        status: 'ACTIVE', // vračilo oživi izčrpano serijo (odpad/reversala)
      },
    })
    if (guard.count === 0) continue
    restored.push({ batchId: alloc.batchId, quantity: qty })
  }

  if (restored.length > 0) {
    await applyBatchAllocations(tx, {
      stockTransactionId: newStockTransactionId,
      inventoryItemId,
      slices: restored,
    })
  }
  return restored
}

/**
 * Izčrpa serijo pri prevzemu — restock z batch podatki ustvari serijo +
 * pozitivno alokacijo na 'procurement' transakciji (vhod v ledger serij).
 * Kliče se IZVEN kanon, pod istim advisory lock-om (serializirano).
 */
export async function recordBatchReceipt(
  tx: TransactionClient,
  opts: {
    inventoryItemId: string
    locationId: string | null
    unit: string
    quantity: number
    stockTransactionId: string
    lotNumber: string
    expiryDate?: Date | null
    supplierId?: string | null
    supplierName?: string
    unitCost?: number | null
    note?: string
  },
): Promise<Record<string, unknown>> {
  const qty = round3(opts.quantity)
  const batch = await tx.inventoryBatch.create({
    data: {
      inventoryItemId: opts.inventoryItemId,
      locationId: opts.locationId,
      lotNumber: opts.lotNumber,
      ...(opts.supplierId ? { supplierId: opts.supplierId } : {}),
      supplierName: opts.supplierName ?? '',
      expiryDate: opts.expiryDate ?? null,
      quantityInitial: qty,
      quantityRemaining: qty,
      unit: opts.unit,
      ...(opts.unitCost != null ? { unitCost: opts.unitCost } : {}),
      note: opts.note ?? '',
    },
  })
  await applyBatchAllocations(tx, {
    stockTransactionId: opts.stockTransactionId,
    inventoryItemId: opts.inventoryItemId,
    slices: [{ batchId: batch.id, quantity: qty }],
  })
  return batch as unknown as Record<string, unknown>
}
