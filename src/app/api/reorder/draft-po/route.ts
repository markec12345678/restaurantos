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

interface DraftOrder {
  id: string
  poNumber: string
  supplierName: string
  itemCount: number
  totalAmount: number
  expectedDate: string
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

      // ENA transakcija per PO (števec + glava + postavke atomarno)
      const po = await db.$transaction(async (tx) => {
        // Obstoječi številčni kanon (pariteta POST /api/purchase-orders)
        const counterName = `purchaseOrderNumber-${year}`
        const seq = await getNextCounter(counterName, tx)
        const poNumber = `ND-${year}-${String(seq).padStart(6, '0')}`

        let subtotal = 0
        const poItems = group.map(keeper => {
          const totalPrice = round2(multiply(keeper.suggestedQty, keeper.costPerUnit))
          subtotal += totalPrice
          return {
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
          }
        })
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
            notes: factorsNote,
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
      })
    }

    return NextResponse.json({ orders, skipped }, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/reorder/draft-po', 'Napaka pri pripravi osnutka naročilnic')
  }
}
