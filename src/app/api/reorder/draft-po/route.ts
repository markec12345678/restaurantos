// ============================================
// POST /api/reorder/draft-po — R129 (EPIC #115 P1-07): DRAFT PO IZ KANONA
// ============================================
// Izbrane artikle (itemIds) pretvori v osnutke nabavnih naročilnic,
// GROUPED PO DOBAVITELJU, izključno prek kanona '@/lib/reorder/canon'
// (razložljiv predlog — faktorji gredo v opombo PO). NIČ ne podvaja
// obstoječega toka:
//   - številčenje PO prek obstoječega kanona getNextCounter
//     (`purchaseOrderNumber-YYYY` → ND-YYYY-NNNNNN, pariteta
//     POST /api/purchase-orders L113-116),
//   - prevzem ostane v obstoječem kanonu receivePurchaseOrderItems.
//
// Fail-closed pravila:
//   - scope: artikli izven tenant scope-a se TIHO preskočijo (reason
//     'not-found' — brez razkritja obstoja tujih artiklov),
//   - prazen dobavitelj pri artikel → 400 SUPPLIER_MISSING (brez
//     izmišljevanja 'Neznan dobavitelj' PO-ja),
//   - dobavitelj brez Supplier zapisa → 400 SUPPLIER_NOT_FOUND
//     (FK PurchaseOrder.supplierId je obvezen — ne fabrikiramo),
//   - super-admin brez lokacije → 400 (pariteta resolveWriteLocationId
//     kanona POST /api/purchase-orders — PO lokacija je poslovno NOT NULL).
//
// Preskočeni artikli (reason): 'ok' | 'covered-by-po' |
// 'insufficient-demand' (suggestedQty ≤ 0) | 'not-found' (izven scope-a).
// ============================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import {
  resolveTenantLocationIdOrThrow,
  tenantScopeToWhere,
  resolveWriteLocationId,
} from '@/lib/tenant-scope'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { getNextCounter } from '@/lib/counters'
import { toNum, round2, multiply } from '@/lib/decimal'
import {
  isValidPack,
  packsForBaseQty,
  packsToBaseQty,
  describePack,
} from '@/lib/procurement/pack-size'
import {
  collectActiveCatalogLines,
  catalogLineKey,
} from '@/lib/suppliers/catalog-db'
import {
  collectUsageFactsBatch,
  collectDeliveryFacts,
  collectOpenPurchaseOrders,
  resolveRuleLeadTimeMap,
  computeReorderSuggestion,
} from '@/lib/reorder/canon'

export const dynamic = 'force-dynamic'

const draftPoSchema = z.object({
  itemIds: z
    .array(z.string().min(1, 'ID artikla ne sme biti prazen'))
    .min(1, 'Izberi vsaj en artikel')
    .max(100, 'Največ 100 artiklov na osnutek'),
})

interface DraftOrderItemSummary {
  name: string
  packs: number
  packUnit: string | null
  packQty: number | null
  baseQty: number
  pricePerPack: number | null
  totalPrice: number
}

interface DraftOrder {
  id: string
  poNumber: string
  supplierName: string
  itemCount: number
  totalAmount: number
  expectedDate: string
  /** R131 (P1-13): povzetek postavk — pack vrstice v paketih, legacy v osnovnih enotah (packUnit/packQty/pricePerPack = null). */
  items: DraftOrderItemSummary[]
}

export async function POST(req: Request) {
  try {
    // Rate limit — kreiranje PO je drag Write (AUTHENTICATED_LIMIT kanon)
    const rl = await checkRateLimitAsync('reorder-draft-po', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    // Tenant scope (kanon) — takoj po requireAuth, pred body parse-om
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'POST /api/reorder/draft-po',
    })
    if ('error' in scope) return scope.error

    // Fail-closed write scope (pariteta POST /api/purchase-orders): PO lokacija
    // je poslovno obvezna — super-admin brez izrecne ?locationId → 400.
    const writeLoc = resolveWriteLocationId(scope.locationId)
    if (!writeLoc.ok) return writeLoc.response
    const locationId = writeLoc.locationId

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(draftPoSchema, bodyResult.data)
    if (validationError) return validationError

    const itemIds = [...new Set(data.itemIds)]

    // Scoped load — artikli izven scope-a se tiho preskočijo (fail-closed,
    // brez razkritja obstoja; pariteta R85-4c reorder poti).
    const items = await db.inventoryItem.findMany({
      where: {
        id: { in: itemIds },
        ...tenantScopeToWhere({ locationId }),
      },
    })
    const itemMap = new Map(items.map(item => [item.id, item]))

    const skipped: Array<{ itemId: string; name: string; reason: string }> = []
    for (const id of itemIds) {
      if (!itemMap.has(id)) skipped.push({ itemId: id, name: '', reason: 'not-found' })
    }

    // Kanonska branja (batched) + izračun predlogov per artikel
    const scopedIds = items.map(item => item.id)
    const [factsByItem, rules, openPosByItem, deliveryByItem] = await Promise.all([
      collectUsageFactsBatch(db, scopedIds, { windowDays: 30, recentDays: 7 }),
      db.reorderRule.findMany({
        where: { inventoryItemId: { in: scopedIds } },
        select: { inventoryItemId: true, leadTimeDays: true, isActive: true },
      }),
      collectOpenPurchaseOrders(db, scopedIds),
      collectDeliveryFacts(db, scopedIds),
    ])
    const ruleLeadByItem = resolveRuleLeadTimeMap(rules)

    const keepers: Array<{
      itemId: string
      name: string
      unit: string
      supplier: string
      costPerUnit: number
      suggestedQty: number
      leadTimeDays: number
      factors: string[]
    }> = []

    for (const item of items) {
      const openPo = openPosByItem.get(item.id)
      const delivery = deliveryByItem.get(item.id)
      const canon = computeReorderSuggestion(
        {
          id: item.id,
          name: item.name,
          unit: item.unit,
          supplier: item.supplier,
          quantity: toNum(item.quantity),
          minQuantity: toNum(item.minQuantity),
          reorderPoint: item.reorderPoint == null ? null : toNum(item.reorderPoint),
          safetyStock: item.safetyStock == null ? null : toNum(item.safetyStock),
          leadTimeDays: item.leadTimeDays ?? null,
          costPerUnit: toNum(item.costPerUnit),
        },
        factsByItem.get(item.id) ?? {
          windowDays: 30, recentDays: 7, totalConsumed: 0, avgDailyUsage: 0,
          recentConsumed: 0, recentDailyUsage: 0, txCount: 0, hasEnoughData: false,
        },
        {
          openPoQty: openPo?.qty ?? 0,
          openPoRefs: openPo?.refs ?? [],
          ruleLeadTimeDays: ruleLeadByItem.get(item.id) ?? null,
          avgDeliveryDays: delivery?.avgDeliveryDays ?? null,
        },
      )

      // Kanon: KEEP samo status ('low'|'critical') s suggestedQty > 0.
      if (canon.status === 'ok' || canon.status === 'covered-by-po') {
        skipped.push({ itemId: item.id, name: item.name, reason: canon.status })
        continue
      }
      if (canon.suggestedQty <= 0) {
        skipped.push({ itemId: item.id, name: item.name, reason: 'insufficient-demand' })
        continue
      }

      keepers.push({
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        supplier: item.supplier,
        costPerUnit: toNum(item.costPerUnit),
        suggestedQty: canon.suggestedQty,
        leadTimeDays: canon.leadTimeDays,
        factors: canon.factors,
      })
    }

    // Fail-closed: prazen dobavitelj → 400 (brez 'Neznan dobavitelj' fabrikacije).
    const missingSupplier = keepers.filter(k => !k.supplier.trim())
    if (missingSupplier.length > 0) {
      return NextResponse.json(
        { error: 'SUPPLIER_MISSING', items: missingSupplier.map(k => k.name) },
        { status: 400 },
      )
    }

    // Supplier FK mora obstajati (@@unique name) — brez zapisa → 400 (ne fabrikamo).
    const supplierNames = [...new Set(keepers.map(k => k.supplier.trim()))]
    const suppliers = await db.supplier.findMany({
      where: { name: { in: supplierNames } },
      select: { id: true, name: true },
    })
    const missingSupplierRecords = supplierNames.filter(n => !suppliers.some(s => s.name === n))
    if (missingSupplierRecords.length > 0) {
      return NextResponse.json(
        { error: 'SUPPLIER_NOT_FOUND', suppliers: missingSupplierRecords },
        { status: 400 },
      )
    }
    const supplierByName = new Map(suppliers.map(s => [s.name, s]))

    // R131 (epic #115 P1-13): batch load AKTIVNIH katalog vrstic za pare
    // (dobavitelj, artikel) — ENA poizvedba (brez N+1). Strukturni guard v
    // kolektorju: brez supplierItem modela (starejši mocki) → prazna mapa →
    // vse vrstice legacy (NESPREMENJENO vedenje).
    const catalogLines = await collectActiveCatalogLines(
      db,
      suppliers.map(s => s.id),
      keepers.map(k => k.itemId),
    )

    // Grupiranje po dobavitelju → ENA draft PO per dobavitelj (lastna transakcija)
    const groups = new Map<string, typeof keepers>()
    for (const keeper of keepers) {
      const group = groups.get(keeper.supplier) ?? []
      group.push(keeper)
      groups.set(keeper.supplier, group)
    }

    const year = new Date().getFullYear()
    const orders: DraftOrder[] = []

    for (const [supplierName, group] of groups) {
      const supplier = supplierByName.get(supplierName)!
      const maxLead = Math.max(...group.map(k => k.leadTimeDays))
      const expectedDate = new Date(Date.now() + maxLead * 86_400_000)
      const factorsNote = group
        .map(k => `${k.name}: ${k.factors.join(' · ')}`)
        .join('\n')

      // R131 (P1-13): katalog-driven pack naročanje per vrstico. Katalog linija
      // velja ŠELE ko je packQty veljaven IN pricePerPack > 0 (kanon #6 —
      // nikoli ne izmišljuj cene); sicer legacy base-unit vrstica.
      const resolved = group.map(keeper => {
        const catalog = catalogLines.get(catalogLineKey(supplier.id, keeper.itemId))
        const packQtyNum = catalog ? toNum(catalog.packQty) : 0
        const pricePerPackNum = catalog ? toNum(catalog.pricePerPack) : 0
        if (catalog && isValidPack(packQtyNum) && pricePerPackNum > 0) {
          // CELE pakete (ceil advisory), vsaj minOrderPacks (pogodbeno minimum).
          const packs = Math.max(
            packsForBaseQty(keeper.suggestedQty, packQtyNum),
            Math.max(1, catalog.minOrderPacks || 1),
          )
          const baseQty = packsToBaseQty(packs, packQtyNum)
          const packUnit = catalog.packUnit || 'paket'
          const totalPrice = round2(multiply(packs, pricePerPackNum))
          return {
            isPack: true,
            explanation: `${keeper.name}: naročeno ${packs} × ${describePack(packQtyNum, packUnit, keeper.unit)} = ${baseQty} ${keeper.unit} (predlog ${keeper.suggestedQty} ${keeper.unit})`,
            line: {
              inventoryItemId: keeper.itemId,
              description: keeper.name,
              quantityOrdered: packs,
              quantityReceived: 0,
              unit: packUnit,
              unitPrice: pricePerPackNum,
              vatRate: 22.0,
              totalPrice,
              status: 'pending',
              notes: '',
              // Pack snapshot (kanon #3) — prevzem konvertira po TEM, ne po
              // trenutnem katalogu (zgodovinski PO ostane konsistenten).
              packQty: catalog.packQty,
              packUnit,
            },
            summary: {
              name: keeper.name,
              packs,
              packUnit,
              packQty: packQtyNum,
              baseQty,
              pricePerPack: pricePerPackNum,
              totalPrice,
            },
          }
        }
        // Legacy base-unit vrstica (NESPREMENJENA — pariteta R129)
        const totalPrice = round2(multiply(keeper.suggestedQty, keeper.costPerUnit))
        return {
          isPack: false,
          explanation: null as string | null,
          line: {
            inventoryItemId: keeper.itemId,
            description: keeper.name,
            quantityOrdered: keeper.suggestedQty,
            quantityReceived: 0,
            unit: keeper.unit,
            unitPrice: keeper.costPerUnit,
            vatRate: 22.0,
            totalPrice,
            status: 'pending',
            notes: '',
            packQty: null,
            packUnit: null,
          },
          summary: {
            name: keeper.name,
            packs: keeper.suggestedQty,
            packUnit: null,
            packQty: null,
            baseQty: keeper.suggestedQty,
            pricePerPack: null,
            totalPrice,
          },
        }
      })

      // Pack razlaga v opombi PO (razložljivost — pariteta factors R129)
      const packExplanations = resolved
        .map(r => r.explanation)
        .filter((e): e is string => e !== null)
      const poNotes = packExplanations.length > 0
        ? `${factorsNote}\n${packExplanations.join('\n')}`
        : factorsNote

      // ENA transakcija per PO (števec + glava + postavke atomarno)
      const po = await db.$transaction(async (tx) => {
        // Obstoječi številčni kanon (pariteta POST /api/purchase-orders)
        const counterName = `purchaseOrderNumber-${year}`
        const seq = await getNextCounter(counterName, tx)
        const poNumber = `ND-${year}-${String(seq).padStart(6, '0')}`

        const poItems = resolved.map(r => r.line)
        const subtotal = poItems.reduce((sum, i) => sum + i.totalPrice, 0)
        const vatAmount = round2(poItems.reduce((sum, i) => sum + (i.totalPrice * 22.0) / 100, 0))
        const totalAmount = round2(subtotal + vatAmount)

        return tx.purchaseOrder.create({
          data: {
            poNumber,
            supplierId: supplier.id,
            locationId,
            status: 'draft',
            orderDate: new Date(),
            expectedDate,
            subtotal: round2(subtotal),
            vatAmount,
            totalAmount,
            deliveryAddress: '',
            // R129: razložljiv predlog — faktorji kanona v opombi
            deliveryNotes: 'R129 reorder center — razložljiv predlog (factors v opombi)',
            requestedBy: authResult.session?.employeeId || '',
            approvedBy: '',
            // R131: pack razlaga se PRIDRUŽI faktorjem (brez podvajanja)
            notes: poNotes,
            items: { create: poItems },
          },
        })
      })

      orders.push({
        id: po.id,
        poNumber: po.poNumber,
        supplierName,
        itemCount: group.length,
        totalAmount: round2(toNum(po.totalAmount)),
        expectedDate: expectedDate.toISOString(),
        // R131 (P1-13): aditiven povzetek postavk (pack vrstice v paketih)
        items: resolved.map(r => r.summary),
      })
    }

    return NextResponse.json({ orders, skipped }, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/reorder/draft-po', 'Napaka pri pripravi osnutka naročilnic')
  }
}
