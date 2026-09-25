// NABAVNO NAROČILO — Schema + prevzem blaga helper
//
// R105 (TOCTOU razred iz R100–R104): prevzem blaga je imel DVE kopiji
// ranljivega toka (POST /api/purchase-orders/[id]/receive + PUT/PATCH
// action='receive' → handleReceiveAction), obe z ISTO forenziko:
//
//   PO-1 (HIGH, TOCTOU double-receive): PO + items so bili prebrani IZVEN
//      $transaction (stale), prevoz check-then-act pa je znotraj transakcije
//      računal iz STALE quantityReceived: `totalReceived = stale + qty` →
//      dva sočasna prevzema istega čeka → oba prebereta isto začetno stanje →
//      cap-check preživita oba → inventory increment ×2 (dvojna zaloga) +
//      dve StockTransaction vrstici. handleReceiveAction je imel poleg tega
//      SPLOH brez `status === 'received'` guard-a (popolnoma prejeto naročilo
//      je bilo prevzeto ŠE ENKRAT — dvojna zaloga + dvojna obveznost).
//      FIX (kanon R104 qr-pay/staff plačilna pot): ENA skupna funkcija
//      receivePurchaseOrderItems() — $transaction(Serializable) +
//      pg_advisory_xact_lock(hashtext(poId)) + tx-fresh re-read PO in items +
//      validacija SAMO proti svežim podatkom.
//   PO-2 (HIGH, dvojna obveznost): `allReceived` roll-up → AccountsPayable
//      create brez obstoječega-AP pregleda → dva sočasna zaključka (ali
//      zaporedna prevzema prek PUT brez status guard-a) = DVE AP vrstici
//      (dvojna obveznost do dobavitelja). apNumber je @unique + count+1
//      števec → sočasni zaključek DVEH različnih PO = P2002 na apNumber →
//      prej 500 (čeprav je prevzem uspel). FIX: tx-fresh findFirst
//      (purchaseOrderId) skip-if-exists + P2002 → 409 retry (nikoli 500),
//      P2034 → 409.
//   PO-3 (MEDIUM, cancelled prevzem): status 'cancelled' NI bil obravnavan —
//      prevzem preklicanega naročila je tiho povečal zalogo (rollback stanja
//      sploh ni bilo). FIX: 400 za received IN cancelled (tx-fresh).
//   PO-4 (MEDIUM, tihi no-op): handleReceiveAction je NEZNAN itemId tiho
//      preskočil (`continue`) → 200 "Blago prevzeto" BREZ vsakega pisanja
//      (audit log pravi prevzem, zaloga se ni spremenila — revizijska
//      neskladja). FIX: 400 fail-closed (parity s POST potjo).
//   PO-5 (MEDIUM, state machine race) PUT/PATCH: `existing` stale read +
//      prehod-validacija + NEPOGOJEN update({ where: { id } }) → dva sočasna
//      prehoda (npr. submitted→approved in submitted→cancelled) oba preživita
//      validacijo proti istemu stale statusu → last-write-wins obide state
//      machine. FIX: CAS updateMany (where: { id, status: existing.status })
//      → count 0 → 409 (R102/R103 vzorec).
//   PO-6 (error kontrakt, R102 F1 razred): `throw new Error('...presega...')`
//      + string-matching catch → krhek; strukturirani { error, status }
//      throw-i iz tx teles + structuredErrorResponse (canonical).

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { toNum, round2, greaterThan, greaterThanOrEqual, isPositive, multiply } from '@/lib/decimal'
import { structuredErrorResponse } from '@/lib/structured-error'
import { logger } from '@/lib/logger'

export const purchaseOrderUpdateSchema = z.object({
  action: z.enum(['receive']).optional(),
  receivedItems: z.array(z.object({
    itemId: z.string().max(100, 'ID postavke je predolg'),
    quantityReceived: z.number().min(0.01, 'Količina mora biti pozitivna').max(99999, 'Količina je prevelika'),
  })).max(100, 'Največ 100 postavk na prevzem').optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'partial', 'received', 'cancelled']).optional(),
  expectedDate: z.string().max(30, 'Datum je predolg').optional(),
  notes: z.string().max(2000, 'Opombe so predolge').optional(),
  approvedBy: z.string().max(100, 'Odobritelj je predolg').optional(),
  deliveryAddress: z.string().max(500, 'Naslov dostave je predolg').optional(),
  deliveryNotes: z.string().max(2000, 'Opombe dostave so predolge').optional(),
})

// State machine validacija za status
export const VALID_PO_TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'cancelled'],
  approved: ['partial', 'received', 'cancelled'],
  partial: ['received', 'cancelled'],
  received: [],
  cancelled: [],
}

export interface ReceivePurchaseOrderItemsResult {
  po: Record<string, unknown>
  allReceived: boolean
  anyPartial: boolean
}

/**
 * R105: EDIRNI prevzemni tok za OBE entry point-a (POST receive route +
 * PUT/PATCH action='receive'). Kanon R104 (qr-pay/qr staff plačilna pot):
 * Serializable + advisory lock per PO + tx-fresh re-read + validacija samo
 * proti svežim podatkom + idempotentno AP ustvarjanje.
 */
export async function receivePurchaseOrderItems(opts: {
  poId: string
  // R86-2b pariteta: scope.locationId iz resolveTenantLocationIdOrThrow
  // (string | null — super-admin brez lokacije = globalni nadzor).
  sessionLocationId: string | null
  receivedItems: { itemId: string; quantityReceived: number }[]
  employeeId: string | null
  notes?: string
}): Promise<ReceivePurchaseOrderItemsResult> {
  const { poId, sessionLocationId, receivedItems, employeeId, notes } = opts

  return await db.$transaction(async (tx) => {
    // R105 PO-1: advisory lock per PO — serializira sočasne prevzeme ISTEGA
    // naročila (kanon create-payment.ts / qr-pay confirm R104).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${poId}))`

    // Tx-fresh scoped re-read (prej stale read izven transakcije)
    const po = await tx.purchaseOrder.findFirst({
      where: { id: poId, ...(sessionLocationId ? { locationId: sessionLocationId } : {}) },
      include: { items: true, supplier: true },
    })
    if (!po) {
      throw { error: 'Naročilo ni najdeno', status: 404 }
    }

    // R105 PO-3: terminalna stanja — received (dvojni prevzem) IN cancelled
    // (tiho povečanje zaloge preklicanega naročila) sta zavrnjena proti
    // TX-FRESH statusu, ne stale.
    if (po.status === 'received') {
      throw { error: 'Naročilo je že popolnoma prejeto', status: 400 }
    }
    if (po.status === 'cancelled') {
      throw { error: 'Naročila ni mogoče prevzeti — je preklicano', status: 400 }
    }

    for (const receivedItem of receivedItems) {
      // R105 PO-1/PO-4: item se išče v TX-FRESH items; neznan itemId je
      // fail-closed 400 (prej tihi `continue` = 200 brez vsakega pisanja).
      const poItem = po.items.find(i => i.id === receivedItem.itemId)
      if (!poItem) {
        throw { error: `Postavka ${receivedItem.itemId} ni najdena v naročilu`, status: 400 }
      }

      // Cap-check proti svežim podatkom (pod lockom + Serializable sta dva
      // sočasna prevzema serializirana — stale prebereta ne obstajata več).
      const totalReceived = round2(toNum(poItem.quantityReceived) + receivedItem.quantityReceived)
      if (greaterThan(totalReceived, toNum(poItem.quantityOrdered))) {
        throw {
          error: `Postavka "${poItem.description}": prevzeta količina (${totalReceived}) presega naročeno (${toNum(poItem.quantityOrdered)})`,
          status: 400,
        }
      }

      // Posodobi postavko naročila
      await tx.purchaseOrderItem.update({
        where: { id: poItem.id },
        data: {
          quantityReceived: totalReceived,
          status: greaterThanOrEqual(totalReceived, poItem.quantityOrdered) ? 'received' : 'partial',
        },
      })

      // Posodobi zalogo, če je povezana (atomic increment + forenzika iz
      // post-op vrednosti — R103 G3 ledger kanon)
      if (poItem.inventoryItemId) {
        const receivedQty = round2(receivedItem.quantityReceived)
        const updatedInv = await tx.inventoryItem.update({
          where: { id: poItem.inventoryItemId },
          data: {
            quantity: { increment: receivedQty },
            lastRestocked: new Date(),
          },
        })
        const newQty = round2(toNum(updatedInv.quantity))
        const prevQty = round2(newQty - receivedQty)

        await tx.stockTransaction.create({
          data: {
            inventoryItemId: poItem.inventoryItemId,
            type: 'procurement',
            quantity: receivedQty,
            previousQty: prevQty,
            newQty: newQty,
            costPerUnit: round2(toNum(poItem.unitPrice)),
            totalCost: round2(multiply(receivedQty, poItem.unitPrice)),
            reason: `Prejem ${po.poNumber}`,
            supplierDoc: po.poNumber,
            employeeName: employeeId || '',
          },
        })

        // R130 (epic #115 P1-08): zgodovina nabavnih cen — cena je del
        // prevzemnega poslovnega eventa, zato gre v ISTO transakcijo (kanon:
        // Serializable + advisory lock pokrijejo tudi zajem cene).
        // ZASEDNOST: unitPrice <= 0 (darilo/vzorec) se PRESKOČI — ne sme
        // pokvariti povprečij; prevzem pa zato NE SME pasti (best-effort per
        // vrstico: napaka zajema → logger.warn, tx nadaljuje).
        if (greaterThan(toNum(poItem.unitPrice), 0)) {
          try {
            await tx.supplierPriceHistory.create({
              data: {
                supplierId: po.supplierId,
                inventoryItemId: poItem.inventoryItemId,
                unitPrice: poItem.unitPrice,
                vatRate: poItem.vatRate,
                unit: poItem.unit,
                source: 'goods_receipt',
                purchaseOrderId: poId,
                locationId: po.locationId ?? null,
              },
            })
          } catch (priceErr) {
            logger.warn('R130', 'Zajem nabavne cene (goods_receipt) ni uspel — prevzem nadaljuje', priceErr)
          }
        }
      }
    }

    // Status roll-up iz TX-FRESH items
    const updatedPo = await tx.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    })
    const allReceived = updatedPo?.items.every(i => greaterThanOrEqual(i.quantityReceived, i.quantityOrdered)) ?? false
    const anyPartial = updatedPo?.items.some(i => isPositive(i.quantityReceived) && !greaterThanOrEqual(i.quantityReceived, i.quantityOrdered)) ?? false
    const newStatus = allReceived ? 'received' : anyPartial ? 'partial' : po.status

    const finalPo = await tx.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: newStatus,
        receivedDate: allReceived ? new Date() : null,
        ...(notes ? { notes } : {}),
      },
      include: {
        supplier: true,
        items: { include: { inventoryItem: true } },
      },
    })

    // R105 PO-2: AP idempotentno — tx-fresh findFirst po purchaseOrderId;
    // če obstaja (npr. mid-flight popravek / ponovljen zaključek), NE ustvari
    // dvojne obveznosti.
    if (allReceived) {
      const existingAp = await tx.accountsPayable.findFirst({
        where: { purchaseOrderId: poId },
      })
      if (!existingAp) {
        const year = new Date().getFullYear()
        const apCount = await tx.accountsPayable.count({ where: { apNumber: { startsWith: `AP-${year}-` } } })
        const apNumber = `AP-${year}-${String(apCount + 1).padStart(6, '0')}`
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 30) // Default 30 dni plačila

        await tx.accountsPayable.create({
          data: {
            apNumber,
            supplierId: po.supplierId,
            purchaseOrderId: po.id,
            invoiceNumber: po.poNumber,
            invoiceDate: new Date(),
            dueDate,
            subtotal: toNum(po.subtotal),
            vatAmount: toNum(po.vatAmount),
            totalAmount: toNum(po.totalAmount),
            status: 'open',
            notes: `Avtomatsko kreirano ob prejemu ${po.poNumber}`,
          },
        })
      }
    }

    return { po: finalPo as unknown as Record<string, unknown>, allReceived, anyPartial }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 10_000,
  })
}

// Prevzem blaga — PUT/PATCH action='receive' entry point.
// FIX R81-G (LEAK-HIGH, cross-tenant): scoped lookup prek skupnega kanona
// (sessionLocationId je OBVEZEN parameter — brez defaulta, R86-2b).
export async function handleReceiveAction(
  id: string,
  receivedItems: { itemId: string; quantityReceived: number }[],
  employeeId: string | null,
  sessionLocationId: string | null,
) {
  try {
    await receivePurchaseOrderItems({
      poId: id,
      sessionLocationId,
      receivedItems,
      employeeId,
    })
    return NextResponse.json({ success: true, message: 'Blago prevzeto in zaloga posodobljena' })
  } catch (error: unknown) {
    // R105 PO-6: strukturirani tx throw-i (400/404/409) → pravi statusi;
    // P2002/P2034 race-pathi → 409 (nikoli 500 '[object Object]').
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return NextResponse.json(
        { error: 'Prevzem je v obdelavi (sočasen dostop) — poskusite znova' },
        { status: 409 }
      )
    }
    return structuredErrorResponse(error, 'PUT/PATCH /api/purchase-orders/[id] (action=receive)', 'Napaka pri prevzemu blaga')
  }
}

/** R105 PO-5: CAS state-machine write za PUT/PATCH (count 0 → 409 race). */
export async function casUpdatePurchaseOrder(
  id: string,
  expectedStatus: string,
  sessionLocationId: string | null,
  updateData: Record<string, unknown>,
): Promise<{ ok: true; po: Record<string, unknown> } | { ok: false; conflict: true }> {
  const updated = await db.purchaseOrder.updateMany({
    where: {
      id,
      status: expectedStatus,
      ...(sessionLocationId ? { locationId: sessionLocationId } : {}),
    },
    data: updateData,
  })
  if (updated.count === 0) {
    return { ok: false, conflict: true }
  }
  const po = await db.purchaseOrder.findFirst({
    where: { id, ...(sessionLocationId ? { locationId: sessionLocationId } : {}) },
    include: { supplier: true, items: { include: { inventoryItem: true } } },
  })
  if (!po) return { ok: false, conflict: true }
  return { ok: true, po: po as unknown as Record<string, unknown> }
}
