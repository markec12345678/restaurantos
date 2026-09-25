// ============================================
// R130 (epic #115 P1-08): ZGODOVINA NABAVNIH CEN DOBAVITELJEV
// ============================================
//
// GET /api/inventory/price-history?inventoryItemId=X  → časovnica cen artikla
// GET /api/inventory/price-history?supplierId=Y       → cene dobavitelja,
//   grupirano po artiklih (items[]) + flat rows
//   (oba parametra = filter po obeh; NOBENEGA → 400 PARAM_REQUIRED)
// POST /api/inventory/price-history                   → ročni vnos
//   (source 'manual', audit SUPPLIER_PRICE_MANUAL)
//
// Vrstice ob prevzemu blaga se zajamejo SAMODEJNO v receive kanonu
// (receivePurchaseOrderItems, source 'goods_receipt') — ta ruta je branje +
// ročne korekcije.
//
// Decimal kontrakt (kanon P1-08): izračun v Prisma.Decimal, čez API mejo kot
// STRING (unitPrice/vatRate/stats cene) — zgodovina/analitika ne sme izgubiti
// natančnosti. Stats: '@/lib/suppliers/price-history' (čist kanon).
//
// Fail-closed: auth manage_inventory (pariteta GET /api/inventory/reorder),
// tenant scope (resolveTenantLocationIdOrThrow); artikel izven scope-a je
// 404 (ne razkritje obstoja, pariteta notInScopeResponse).
// ============================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db, createAuditLog } from '@/lib/db'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT, PRICE_HISTORY_MANUAL_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { notInScopeResponse } from '@/lib/tenant-scope'
import {
  summarizePrices,
  type PriceHistoryRowInput,
  type PriceSummary,
} from '@/lib/suppliers/price-history'

export const dynamic = 'force-dynamic'

/** Zgornja meja vrstic v odgovoru (zadnjih 200 po observedAt desc). */
const ROW_LIMIT = 200

// --- Zod sheme (Zod je hišni kanon za body validacijo) ---
const manualPriceSchema = z.object({
  supplierId: z.string().min(1, 'supplierId je obvezen').max(100, 'supplierId je predolg'),
  inventoryItemId: z.string().min(1, 'inventoryItemId je obvezen').max(100, 'inventoryItemId je predolg'),
  // > 0 se preverja explicitno (koda PRICE_INVALID) — Zod tu samo tip.
  unitPrice: z.number({ message: 'unitPrice mora biti število' }),
  unit: z.string().max(30, 'Enota je predolga').optional(),
  vatRate: z.number().min(0, 'DDV ne more biti negativen').max(100, 'DDV ne more presegati 100%').optional(),
  note: z.string().max(500, 'Opomba je predolga').optional(),
  observedAt: z.string().max(40, 'Datum je predolg').optional(),
})

// --- Serijalizacija (Decimal → STRING čez API mejo) ---

interface PriceHistoryDbRow {
  id: string
  supplierId: string
  inventoryItemId: string
  unitPrice: { toString: () => string }
  vatRate: { toString: () => string } | null
  unit: string
  source: string
  purchaseOrderId: string | null
  observedAt: Date
  createdAt: Date
  note: string
}

interface SerializedRow {
  id: string
  supplierId: string
  supplierName: string
  inventoryItemId: string
  inventoryItemName: string
  itemUnit: string
  unitPrice: string
  vatRate: string | null
  unit: string
  source: string
  purchaseOrderId: string | null
  observedAt: string
  createdAt: string
  note: string
}

function serializeRow(
  row: PriceHistoryDbRow,
  supplierName: string,
  itemName: string,
  itemUnit: string,
): SerializedRow {
  return {
    id: row.id,
    supplierId: row.supplierId,
    supplierName,
    inventoryItemId: row.inventoryItemId,
    inventoryItemName: itemName,
    itemUnit,
    unitPrice: row.unitPrice.toString(),
    vatRate: row.vatRate == null ? null : row.vatRate.toString(),
    unit: row.unit,
    source: row.source,
    purchaseOrderId: row.purchaseOrderId,
    observedAt: row.observedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    note: row.note,
  }
}

function rowsToSummaryInput(rows: Array<{ unitPrice: { toString: () => string }; observedAt: Date }>): PriceHistoryRowInput[] {
  return rows.map(r => ({ unitPrice: r.unitPrice.toString(), observedAt: r.observedAt }))
}

// --- GET ---
export async function GET(req: Request) {
  try {
    // Rate limit — blago branje (AUTHENTICATED_LIMIT kanon)
    const rl = await checkRateLimitAsync('price-history-get', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs)

    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/inventory/price-history',
    })
    if ('error' in scope) return scope.error

    const inventoryItemId = (searchParams.get('inventoryItemId') || '').trim()
    const supplierId = (searchParams.get('supplierId') || '').trim()

    if (!inventoryItemId && !supplierId) {
      return NextResponse.json(
        { error: 'PARAM_REQUIRED', message: 'Podati morate ?inventoryItemId= ali ?supplierId=' },
        { status: 400 },
      )
    }

    // --- Režim A: artikel (zgodovina cen artikla; ?supplierId= dodatno zoži) ---
    if (inventoryItemId) {
      const item = await db.inventoryItem.findFirst({
        where: {
          id: inventoryItemId,
          ...(scope.locationId ? { locationId: scope.locationId } : {}),
        },
        select: { id: true, name: true, unit: true, supplier: true },
      })
      // Fail-closed 404: ne razkrivamo obstoja artikla na drugi lokaciji
      // (pariteta notInScopeResponse / daily-close detail).
      if (!item) return notInScopeResponse('Artikel')

      const rows = await db.supplierPriceHistory.findMany({
        where: {
          inventoryItemId,
          ...(supplierId ? { supplierId } : {}),
        },
        orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
        include: { supplier: { select: { name: true } } },
      })

      const stats = summarizePrices(rowsToSummaryInput(rows))
      return NextResponse.json({
        rows: rows.slice(0, ROW_LIMIT).map(r => serializeRow(r, r.supplier.name, item.name, item.unit)),
        stats,
        item: {
          inventoryItemId: item.id,
          name: item.name,
          unit: item.unit,
          supplier: item.supplier,
        },
      })
    }

    // --- Režim B: dobavitelj (grupirano po artiklih) ---
    const rows = await db.supplierPriceHistory.findMany({
      where: { supplierId },
      orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        supplier: { select: { name: true } },
        inventoryItem: { select: { id: true, name: true, unit: true, locationId: true } },
      },
    })

    // Tenant scope: vrstica velja le, če je artikel lokacije scope-a
    // (super-admin: null scope = vse). Fail-closed: NULL locationId artikel
    // je izključen za location-bound sejo.
    const scopedRows = scope.locationId
      ? rows.filter(r => r.inventoryItem.locationId === scope.locationId)
      : rows

    // Grupiranje po artiklu → { inventoryItemId, name, unit, ...stats }
    interface Group {
      inventoryItemId: string
      name: string
      unit: string
      rows: Array<{ unitPrice: { toString: () => string }; observedAt: Date }>
    }
    const groups = new Map<string, Group>()
    for (const r of scopedRows) {
      let g = groups.get(r.inventoryItemId)
      if (!g) {
        g = { inventoryItemId: r.inventoryItem.id, name: r.inventoryItem.name, unit: r.inventoryItem.unit, rows: [] }
        groups.set(r.inventoryItemId, g)
      }
      g.rows.push(r)
    }

    const items = [...groups.values()].map(g => {
      const stats: PriceSummary = summarizePrices(rowsToSummaryInput(g.rows))
      return {
        inventoryItemId: g.inventoryItemId,
        name: g.name,
        unit: g.unit,
        ...stats,
      }
    }).sort((a, b) => a.name.localeCompare(b.name, 'sl'))

    const stats = summarizePrices(rowsToSummaryInput(scopedRows))
    return NextResponse.json({
      rows: scopedRows.slice(0, ROW_LIMIT).map(r => serializeRow(r, r.supplier.name, r.inventoryItem.name, r.inventoryItem.unit)),
      stats,
      items,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/inventory/price-history', 'Napaka pri branju zgodovine cen')
  }
}

// --- POST (ročni vnos, source 'manual') ---
export async function POST(req: Request) {
  try {
    // Rate limit — strožje od branja (Write z auditom; PRICE_HISTORY_MANUAL_LIMIT)
    const rl = await checkRateLimitAsync('price-history-post', getClientIp(req), PRICE_HISTORY_MANUAL_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs)

    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'POST /api/inventory/price-history',
    })
    if ('error' in scope) return scope.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(manualPriceSchema, bodyResult.data)
    if (validationError) return validationError

    // R130 kanon: unitPrice <= 0 (in ne-finite) → 400 PRICE_INVALID —
    // darila/vzorci ne smejo pokvariti povprečij.
    if (!Number.isFinite(data.unitPrice) || data.unitPrice <= 0) {
      return NextResponse.json(
        { error: 'PRICE_INVALID', message: 'Cena mora biti pozitivno število' },
        { status: 400 },
      )
    }

    // Fail-closed reference checks (brez fabrikacije FK; koda namesto 500).
    const supplier = await db.supplier.findUnique({
      where: { id: data.supplierId },
      select: { id: true, name: true },
    })
    if (!supplier) {
      return NextResponse.json({ error: 'SUPPLIER_NOT_FOUND', message: 'Dobavitelj ne obstaja' }, { status: 400 })
    }

    const item = await db.inventoryItem.findFirst({
      where: {
        id: data.inventoryItemId,
        ...(scope.locationId ? { locationId: scope.locationId } : {}),
      },
      select: { id: true, name: true, unit: true },
    })
    if (!item) {
      // Enaka koda za "ne obstaja" in "izven lokacije" — brez razkritja obstoja.
      return NextResponse.json({ error: 'ITEM_NOT_FOUND', message: 'Artikel ne obstaja' }, { status: 400 })
    }

    // observedAt — ročni vnos je lahko backdated; neveljaven format → 400.
    let observedAt = new Date()
    if (data.observedAt !== undefined) {
      const parsed = new Date(data.observedAt)
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: 'OBSERVED_AT_INVALID', message: 'Neveljaven datum observedAt' },
          { status: 400 },
        )
      }
      observedAt = parsed
    }

    const row = await db.supplierPriceHistory.create({
      data: {
        supplierId: data.supplierId,
        inventoryItemId: data.inventoryItemId,
        unitPrice: data.unitPrice,
        vatRate: data.vatRate ?? null,
        unit: data.unit ?? item.unit, // default: enota artikla (shemski default "pcs")
        source: 'manual',
        locationId: scope.locationId ?? null,
        observedAt,
        note: data.note ?? '',
      },
    })

    // Audit (kanon createAuditLog — hash veriga, interni try/catch = best-effort).
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'SUPPLIER_PRICE_MANUAL',
      entityType: 'SupplierPriceHistory',
      entityId: row.id,
      locationId: scope.locationId,
      details: {
        supplierId: data.supplierId,
        supplierName: supplier.name,
        inventoryItemId: data.inventoryItemId,
        itemName: item.name,
        unitPrice: String(data.unitPrice),
        unit: data.unit ?? item.unit,
        vatRate: data.vatRate ?? null,
        observedAt: observedAt.toISOString(),
        source: 'manual',
      },
    })

    return NextResponse.json(
      { success: true, row: serializeRow(row, supplier.name, item.name, item.unit) },
      { status: 201 },
    )
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/inventory/price-history', 'Napaka pri shranjevanju nabavne cene')
  }
}
