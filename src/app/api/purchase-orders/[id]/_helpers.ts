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
import { toNum, round2, round3, greaterThan, greaterThanOrEqual, isPositive, multiply } from '@/lib/decimal'
import {
  isValidPack,
  packsToBaseQty,
  baseUnitPrice,
  describePack,
} from '@/lib/procurement/pack-size'
import { structuredErrorResponse } from '@/lib/structured-error'
import { logger } from '@/lib/logger'

export const purchaseOrderUpdateSchema = z.object({
  action: z.enum(['receive']).optional(),
  receivedItems: z.array(z.object({
    itemId: z.string().max(100, 'ID postavke je predolg'),
    quantityReceived: z.number().min(0.01, 'Količina mora biti pozitivna').max(99999, 'Količina je prevelika'),
    // R132 (epic #115 P1-12): zavrnjena/odkvana količina (NE vstopi v zalogo;
    // cap-check kanon: accepted + rejected ≤ ordered). Default 0 = legacy
    // vedenje BIT-FOR-BIT nespremenjeno.
    quantityRejected: z.number().min(0, 'Zavrnjena količina ne sme biti negativna').max(99999, 'Zavrnjena količina je prevelika').default(0),
    rejectReason: z.string().max(200, 'Razlog zavrnitve je predolg').default(''),
  })).max(100, 'Največ 100 postavk na prevzem').optional(),
  // R132: št. dobavnice dobavitelja (GRN dokumentacija dostave)
  supplierDocNumber: z.string().max(100, 'Številka dobavnice je predolga').default(''),
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
  // R132 (epic #115 P1-12): prevzemni dokument (GRN) ustvarjen v istem tx —
  // vsak prevzem (tudi legacy delni) je dokumentiran (kanon #3).
  grn: { id: string; grnNumber: string; status: string; supplierDocNumber: string }
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
  receivedItems: {
    itemId: string
    quantityReceived: number
    // R132 (P1-12): zavrnjena/odkvana količina v ISTI enoti kot quantityReceived
    // (pack kanon: paketi, če je pack snapshot veljaven; sicer osnovne enote).
    quantityRejected?: number
    rejectReason?: string
  }[]
  employeeId: string | null
  // R132: snapshot imena zaposlenega (revizija GRN — route ga razreši iz seje)
  employeeName?: string
  notes?: string
  // R132: št. dobavnice dobavitelja (GRN dokumentacija dostave)
  supplierDocNumber?: string
}): Promise<ReceivePurchaseOrderItemsResult> {
  const { poId, sessionLocationId, receivedItems, employeeId, employeeName, notes, supplierDocNumber } = opts

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

    // R132 (epic #115 P1-12): GRN linije se zbirajo med zanko (snapshot iz
    // tx-fresh PO postavke) — dokument se ustvari PO uspešnem item roll-upu.
    const grnItems: Prisma.GoodsReceiptItemUncheckedCreateWithoutGoodsReceiptInput[] = []

    for (const receivedItem of receivedItems) {
      // R105 PO-1/PO-4: item se išče v TX-FRESH items; neznan itemId je
      // fail-closed 400 (prej tihi `continue` = 200 brez vsakega pisanja).
      const poItem = po.items.find(i => i.id === receivedItem.itemId)
      if (!poItem) {
        throw { error: `Postavka ${receivedItem.itemId} ni najdena v naročilu`, status: 400 }
      }

      // R132 (P1-12): zavrnjena/odkvana količina vrstice (default 0 = legacy).
      const quantityRejected = receivedItem.quantityRejected ?? 0
      const rejectReason = receivedItem.rejectReason ?? ''

      // Cap-check proti svežim podatkom (pod lockom + Serializable sta dva
      // sočasna prevzema serializirana — stale prebereta ne obstajata več).
      // R132 AMANDMA kanona #2: cap gre IZKLJUČNO na SPREJETO količino
      // (BIT-FOR-BIT R105). quantityRejected je dokumentacija dostave in NE
      // porablja naročilne kapacitete — sicer bi nadomestni prevzem poškodovanih
      // enot (10 naročenih, 1 odkvano, 1 nadomestilo) in odklonitev prevelike
      // dobave (12 poslano, 2 zavrnjeno) bili blokirani. Brez zavrnjenih je
      // formula identična obstoječemu cap-checku.
      const totalReceived = round2(toNum(poItem.quantityReceived) + receivedItem.quantityReceived)
      if (greaterThan(totalReceived, toNum(poItem.quantityOrdered))) {
        throw {
          error: `Postavka "${poItem.description}": prevzeta količina (${totalReceived}) presega naročeno (${toNum(poItem.quantityOrdered)})`,
          status: 400,
        }
      }

      // R132 (P1-12): GRN linija — snapshot opisa/enote/cene/pakiranja iz PO
      // postavke; accepted = delta (v ISTI enoti kot quantityReceived — pack
      // kanon R131), rejected/reason iz vrstice prevzema.
      grnItems.push({
        purchaseOrderItemId: poItem.id,
        inventoryItemId: poItem.inventoryItemId,
        description: poItem.description,
        unit: poItem.unit,
        quantityAccepted: receivedItem.quantityReceived,
        quantityRejected,
        rejectReason,
        packQty: poItem.packQty,
        packUnit: poItem.packUnit,
        unitPriceOrdered: poItem.unitPrice,
      })

      // Posodobi postavko naročila
      await tx.purchaseOrderItem.update({
        where: { id: poItem.id },
        data: {
          quantityReceived: totalReceived,
          // R132 (P1-12): kumulacija zavrnjenih/odkvanih (cap-check zgoraj
          // zagotavlja accepted + rejected ≤ ordered). 0 = legacy vedenje.
          quantityRejected: round3(toNum(poItem.quantityRejected) + quantityRejected),
          status: greaterThanOrEqual(totalReceived, poItem.quantityOrdered) ? 'received' : 'partial',
        },
      })

      // Posodobi zalogo, če je povezana (atomic increment + forenzika iz
      // post-op vrednosti — R103 G3 ledger kanon)
      if (poItem.inventoryItemId) {
        // R131 (epic #115 P1-13): pack-size konverzija. Ko ima PO postavka
        // veljaven packQty SNAPSHOT, je quantityReceived v PAKETIH — zaloga,
        // ledger in price history pa se vodijo v OSNOVNIH enotah (kanon
        // #4/#5). NULL/neveljaven packQty → legacy pot, BIT-FOR-BIT
        // nespremenjena (obstoječi prevzemni testi ostajajo zeleni).
        const packQtyNum = toNum(poItem.packQty)
        if (isValidPack(packQtyNum)) {
          const receivedPacks = receivedItem.quantityReceived
          // Osnovna količina = paketi × velikost paketa (round3 — zaloga 12,3)
          const baseQty = packsToBaseQty(receivedPacks, packQtyNum)
          // Osnovna cena = cena/paket ÷ packQty (round4 — price history 12,4)
          const basePrice = baseUnitPrice(toNum(poItem.unitPrice), packQtyNum)

          const updatedInv = await tx.inventoryItem.update({
            where: { id: poItem.inventoryItemId },
            data: {
              quantity: { increment: baseQty }, // BASE enote, NE paketi!
              lastRestocked: new Date(),
            },
          })
          // Forenzika iz post-op vrednosti (R103 G3 kanon ostane) — v BASE enotah
          const newQty = round3(toNum(updatedInv.quantity))
          const prevQty = round3(newQty - baseQty)

          await tx.stockTransaction.create({
            data: {
              inventoryItemId: poItem.inventoryItemId,
              type: 'procurement',
              quantity: baseQty,
              previousQty: prevQty,
              newQty: newQty,
              // Ledger costPerUnit je Decimal(12,2) — osnovna cena se pripiše
              // na 2 decimalki (pariteta legacy vrstice). DENAR pa ostane na
              // nivoju vrstice: totalCost = paketi × cena/paket (kanon #5 —
              // pariteta baseQty × basePrice na 2 decimalki).
              costPerUnit: round2(basePrice),
              totalCost: round2(multiply(receivedPacks, poItem.unitPrice)),
              reason: `Prejem ${po.poNumber}`,
              supplierDoc: po.poNumber,
              employeeName: employeeId || '',
            },
          })

          // Kanon #4: SupplierPriceHistory je VEDNO na OSNOVNI enoti
          // (unitPrice = baseUnitPrice, unit = InventoryItem.unit) — sicer bi
          // recipe cost in reorder center prejela NAPAČNO ceno (P1-08
          // nestrožnostna zaščita). Provenance opomba: "pack: 2 × vrečka po 25 kg".
          // ZASEDNOST: unitPrice (na paket) <= 0 se preskoči — pariteta R130.
          if (greaterThan(toNum(poItem.unitPrice), 0)) {
            try {
              await tx.supplierPriceHistory.create({
                data: {
                  supplierId: po.supplierId,
                  inventoryItemId: poItem.inventoryItemId,
                  unitPrice: basePrice,
                  vatRate: poItem.vatRate,
                  unit: updatedInv.unit,
                  source: 'goods_receipt',
                  purchaseOrderId: poId,
                  locationId: po.locationId ?? null,
                  note: `pack: ${receivedPacks} × ${describePack(packQtyNum, poItem.packUnit ?? '', updatedInv.unit)}`,
                },
              })
            } catch (priceErr) {
              logger.warn('R131', 'Zajem nabavne cene (goods_receipt, pack) ni uspel — prevzem nadaljuje', priceErr)
            }
          }
        } else {
          // LEGACY pot (packQty NULL/neveljaven) — BIT-FOR-BIT nespremenjena.
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
    }

    // R132 (epic #115 P1-12, kanon #3): vsak prevzem ustvari GRN dokument +
    // linije v ISTEM tx (tudi legacy delni prevzem). grnNumber = count+1
    // (pariteta PO-2: @unique + P2002 → 409 retry — catch v ruti). GRN ni
    // imutiben dokument v tej rundi (cancel NI v scope).
    const grnYear = new Date().getFullYear()
    const grnCount = await tx.goodsReceipt.count({ where: { grnNumber: { startsWith: `GR-${grnYear}-` } } })
    const grnNumber = `GR-${grnYear}-${String(grnCount + 1).padStart(6, '0')}`
    const grn = await tx.goodsReceipt.create({
      data: {
        grnNumber,
        purchaseOrderId: po.id,
        supplierId: po.supplierId,
        status: 'confirmed',
        supplierDocNumber: supplierDocNumber ?? '',
        notes: notes ?? '',
        receivedById: employeeId,
        receivedByName: employeeName ?? '',
        locationId: po.locationId ?? null,
        items: { create: grnItems },
      },
    })

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
            // R132 (P1-12): AP nosi lokacijo PO-ja (pariteta invoice POST poti)
            // — sicer AP list (tenant scope) ne vidi avto-obveznosti.
            locationId: po.locationId ?? null,
          },
        })
      }
    }

    return {
      po: finalPo as unknown as Record<string, unknown>,
      allReceived,
      anyPartial,
      grn: {
        id: grn.id,
        grnNumber: grn.grnNumber,
        status: grn.status,
        supplierDocNumber: grn.supplierDocNumber,
      },
    }
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
  receivedItems: { itemId: string; quantityReceived: number; quantityRejected?: number; rejectReason?: string }[],
  employeeId: string | null,
  sessionLocationId: string | null,
  // R132 (P1-12): GRN dokumentacija — PUT/PATCH entry poda dobavnico iz bodyja
  // (employeeName snapshot je POST-route avtoriteta; tu ostane prazen).
  opts?: { supplierDocNumber?: string },
) {
  try {
    await receivePurchaseOrderItems({
      poId: id,
      sessionLocationId,
      receivedItems,
      employeeId,
      supplierDocNumber: opts?.supplierDocNumber,
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
