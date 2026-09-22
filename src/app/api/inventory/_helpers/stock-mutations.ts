// ZALOGA — ENOTNI PISALNI KANON (R106)
//
// R106 (TOCTOU razred iz R100–R105): zalogovne pisalne poti so imele tri
// neodvisne vrzeli, vse iste forenske družine (stale read → read-modify-write
// / unconditional write):
//
//   INV-1 (HIGH, POST /api/inventory/adjust):
//     (a) odpisna pot: tx re-read + `delta = -min(qty, currentQty)` + NEPOGOJEN
//         `decrement` → dva sočasna odpisa oba prebereta isto zalogo, oba
//         preživita cap in oba odštejeta → NEGATIVNA ZALOGA (POST pot NI imela
//         atomarnega `quantity: { gte }` guard-a — samo batch PUT ga je, fix P3;
//         negativna zaloga = prodaja nezalogovanega blaga + FURS neusklajenost).
//     (b) absolutna pot (type='adjustment', newQuantity): `delta = target −
//         currentQty` prebranega tx → dva sočasna "nastavi na 100" (z 50) →
//         oba izračunata delta=+50 → končna zaloga 150 (LOST UPDATE —
//         če-ki-ta-ko ne moremo doseči "nastavi na X" brez serializacije).
//     (c) error kontrakt: `throw new Error('Artikel ni najden')` → 500 namesto
//         strukturirane 404 (R103/R104/R105 PO-6/Q razred "[object Object]").
//
//   INV-2 (HIGH, PUT/PATCH /api/inventory/[id]): `existing` prebran IZVEN tx,
//     `diff = newQty − stale` izračunan izven tx, `update({ where: { id } })`
//     NEPOGOJEN absolute set → sočasna prodaja (decrement) se TIHO PREPIŠE
//     (last-write-wins clobber — izgubljen odvod zaloge, StockTransaction
//     zgodovina pa pravi, da je bil odvod izveden → revizijska neskladja);
//     dva sočasna PUT-a = dve StockTransaction vrstici z istim previousQty.
//
//   INV-3 (MEDIUM, POST /api/inventory/restock): tx teles je pisal na raw
//     `where: { id }` BREZ scope re-checka v tx (izbris med odgovorom →
//     P2025 → 500) in brez per-item ključavnice → sočasni restock+adjust =
//     preplet StockTransaction audit vrstic (previousQty drift).
//
// KANON (zrcali R105 receivePurchaseOrderItems / R104 qr-pay + create-payment):
//   $transaction(Serializable) + pg_advisory_xact_lock(hashtext('inv-stock:' +
//   itemId)) + tx-fresh scoped re-read + validacija SAMO proti svežim podatkom
//   + atomarni pogojni update-ji (updateMany gte za odpise) + strukturirani
//   { error, status } throw-i (structuredErrorResponse v rutah) +
//   P2002/P2034 → 409 v catch blokih.
//
// SKUPNI KLJUČ KLJUČAVNICE ('inv-stock:' + inventoryItemId) čez VSE tri
// helperje → vse per-item zalogovne mutacije (odpis, absolutna prilagoditev,
// restock, ročna nastavitev) se STRIKTNO SERIALIZIRAJO na istem artiklu —
// StockTransaction zgodovina (previousQty → newQty) postane brezvsnežna veriga.

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { toNum, round2, multiply, divide, isPositive } from '@/lib/decimal'

export interface StockMutationResult {
  item: Record<string, unknown>
  transaction: Record<string, unknown> | null
}

/** R106: skupni per-item lock ključ — serializira VSE zalogovne pisalne poti. */
export function inventoryStockLockKey(inventoryItemId: string): string {
  return `inv-stock:${inventoryItemId}`
}

const TX_OPTS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  timeout: 10_000,
} as const

function scopedItemWhere(inventoryItemId: string, sessionLocationId: string | null) {
  // OPOMBA (shared stock): InventoryItem.locationId je NULLABLE po zasnovi —
  // ko seja NI lokacijsko vezana (super-admin) se filter NE uporabi (enaka
  // politika kot R80/R81-F scoped lookupi).
  return {
    id: inventoryItemId,
    ...(sessionLocationId ? { locationId: sessionLocationId } : {}),
  }
}

/**
 * R106 INV-1: odpis/absolutna prilagoditev zaloge (POST /api/inventory/adjust).
 * Kanon R105: Serializable + advisory lock + tx-fresh re-read + validacija samo
 * proti svežim podatkom + atomarni pogojni decrement za odpise.
 */
export async function adjustInventoryItemStock(opts: {
  inventoryItemId: string
  sessionLocationId: string | null
  type: 'write-off' | 'adjustment' | 'return'
  quantity?: number
  newQuantity?: number
  reason: string
  note: string
  supplierDoc: string
  employeeName: string
}): Promise<StockMutationResult> {
  const { inventoryItemId, sessionLocationId, type, quantity, newQuantity, reason, note, supplierDoc, employeeName } = opts

  return await db.$transaction(async (tx) => {
    // R106 INV-1: advisory lock per item — serializira sočasne odpise,
    // prilagoditve, restocke in ročne nastavitve ISTEGA artikla.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${inventoryStockLockKey(inventoryItemId)}))`

    // Tx-fresh scoped re-read (prej: stale read izven transakcije določal cap)
    const item = await tx.inventoryItem.findFirst({
      where: scopedItemWhere(inventoryItemId, sessionLocationId),
    })
    if (!item) {
      throw { error: 'Zalogov artikel ni najden', status: 404 }
    }

    const currentQty = toNum(item.quantity)
    let delta: number
    let txQuantity: number

    if (type === 'adjustment' && newQuantity !== undefined) {
      // (b) absolutna pot — delta IZRAČUNAN IZ TX-FRESH zaloge (prej stale);
      //     pod lockom + Serializable je read-compute-write atomicen (lost update nemogoč)
      const target = Math.max(0, newQuantity)
      delta = target - currentQty
      txQuantity = delta
    } else {
      // (a) odpisna pot — fail-closed proti SVEŽIM podatkom
      const deduct = quantity ?? 0
      if (deduct <= 0) {
        throw { error: 'Količina mora biti pozitivna', status: 400 }
      }
      if (deduct > currentQty) {
        throw {
          error: `Odpis (${deduct}) presega razpoložljivo zalogo (${currentQty})`,
          status: 400,
        }
      }
      delta = -deduct
      txQuantity = -deduct
    }

    // Atomarni pogojni decrement (dvorno varovalo poleg lock+Serializable):
    // odpis NIKOLI ne pade pod 0, tudi če Serializable sodbni konflikt ubeži
    // validaciji (pariteta s P3 fixom v batch PUT poti).
    let updated: Record<string, unknown>
    if (delta < 0) {
      const guard = await tx.inventoryItem.updateMany({
        where: { id: inventoryItemId, quantity: { gte: Math.abs(delta) } },
        data: { quantity: { decrement: Math.abs(delta) } },
      })
      if (guard.count === 0) {
        throw {
          error: `Odpis (${Math.abs(delta)}) presega razpoložljivo zalogo (${currentQty})`,
          status: 400,
        }
      }
      updated = (await tx.inventoryItem.findUnique({
        where: { id: inventoryItemId },
        include: { menuItem: true },
      })) as Record<string, unknown>
    } else {
      updated = (await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: delta > 0 ? { quantity: { increment: delta } } : {},
        include: { menuItem: true },
      })) as Record<string, unknown>
    }

    const totalCost = round2(multiply(Math.abs(txQuantity), item.costPerUnit))
    const transaction = (await tx.stockTransaction.create({
      data: {
        inventoryItemId,
        type,
        quantity: txQuantity,
        previousQty: currentQty,
        newQty: currentQty + delta,
        costPerUnit: item.costPerUnit,
        totalCost,
        reason,
        note,
        supplierDoc,
        employeeName,
      },
    })) as unknown as Record<string, unknown>

    return { item: updated, transaction }
  }, TX_OPTS)
}

/**
 * R106 INV-3: vnos nabave (POST /api/inventory/restock). Kanon: Serializable +
 * advisory lock (SKUPNI ključ z adjust/PUT/PATCH — audit veriga brez prepletov)
 * + tx-fresh scoped re-read (strukturirana 404 namesto P2025 → 500).
 */
export async function restockInventoryItem(opts: {
  inventoryItemId: string
  sessionLocationId: string | null
  quantity: number
  reason: string
  note: string
  supplierDoc: string
  employeeName: string
}): Promise<StockMutationResult> {
  const { inventoryItemId, sessionLocationId, quantity, reason, note, supplierDoc, employeeName } = opts

  return await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${inventoryStockLockKey(inventoryItemId)}))`

    // Tx-fresh scoped re-read (prej: tx telo pisalo na raw id brez scope-a)
    const item = await tx.inventoryItem.findFirst({
      where: scopedItemWhere(inventoryItemId, sessionLocationId),
    })
    if (!item) {
      throw { error: 'Zalogov artikel ni najden', status: 404 }
    }

    const currentQty = toNum(item.quantity)

    const updated = (await tx.inventoryItem.update({
      where: { id: inventoryItemId },
      data: {
        quantity: { increment: quantity },
        lastRestocked: new Date(),
        ...(isPositive(item.servingsPerUnit)
          ? { costPerServing: round2(divide(item.costPerUnit, item.servingsPerUnit)) }
          : {}),
      },
      include: { menuItem: true },
    })) as Record<string, unknown>

    const transaction = (await tx.stockTransaction.create({
      data: {
        inventoryItemId,
        type: 'procurement',
        quantity,
        previousQty: currentQty,
        newQty: currentQty + quantity,
        costPerUnit: item.costPerUnit,
        totalCost: round2(multiply(quantity, item.costPerUnit)),
        reason,
        note,
        supplierDoc,
        employeeName,
      },
    })) as unknown as Record<string, unknown>

    return { item: updated, transaction }
  }, TX_OPTS)
}

/**
 * R106 INV-2: ročna nastavitev količine (PUT/PATCH /api/inventory/[id]).
 * `diff` je izračunan iz TX-FRESH zaloge (prej stale read izven tx) in pod
 * per-item lockom + Serializable je absolute set varen (sočasna prodaja se
 * ne more izgubiti — vsi zalogovni pisci na istem ključu ključavnice).
 * Ko fresh zaloga že ENAKA targetu: BREZ StockTransaction (samo metadata).
 */
export async function setInventoryItemQuantity(opts: {
  inventoryItemId: string
  sessionLocationId: string | null
  newQuantity: number
  extraUpdate: Record<string, unknown>
  reasonPositive: string
  reasonNegative: string
  note: string
  employeeName: string
}): Promise<StockMutationResult> {
  const { inventoryItemId, sessionLocationId, newQuantity, extraUpdate, reasonPositive, reasonNegative, note, employeeName } = opts

  return await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${inventoryStockLockKey(inventoryItemId)}))`

    const item = await tx.inventoryItem.findFirst({
      where: scopedItemWhere(inventoryItemId, sessionLocationId),
    })
    if (!item) {
      throw { error: 'Zalogov artikel ni najden', status: 404 }
    }

    const currentQty = toNum(item.quantity)
    const diff = newQuantity - currentQty

    if (diff === 0) {
      // Tx-fresh stanje že enako targetu — ni zalogovne spremembe, ni
      // StockTransaction (prej bi stale-read pot ustvarila lažni audit zapis).
      const updated = (await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: extraUpdate,
        include: { menuItem: true },
      })) as Record<string, unknown>
      return { item: updated, transaction: null }
    }

    const updated = (await tx.inventoryItem.update({
      where: { id: inventoryItemId },
      data: {
        ...extraUpdate,
        quantity: newQuantity,
        ...(diff > 0 ? { lastRestocked: new Date() } : {}),
      },
      include: { menuItem: true },
    })) as Record<string, unknown>

    const transaction = (await tx.stockTransaction.create({
      data: {
        inventoryItemId,
        type: diff > 0 ? 'adjustment' : 'write-off',
        quantity: diff,
        previousQty: currentQty,
        newQty: currentQty + diff,
        costPerUnit: item.costPerUnit,
        totalCost: round2(multiply(toNum(item.costPerUnit), diff)),
        reason: diff > 0 ? reasonPositive : reasonNegative,
        note,
        employeeName,
      },
    })) as unknown as Record<string, unknown>

    return { item: updated, transaction }
  }, TX_OPTS)
}
