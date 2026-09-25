// ============================================
// R131 (epic #115 P1-13): KATALOG DOBAVITELJA — pakiranja + cenik v paketih
// ============================================
//
// GET    /api/suppliers/[id]/catalog → katalog vrstice dobavitelja
//        ({ items: [{ id, supplierSku, packQty, packUnit, pricePerPack,
//        vatRate, minOrderPacks, isActive, note, baseUnitPrice,
//        inventoryItem: { id, name, unit, costPerUnit } }] })
// POST   /api/suppliers/[id]/catalog → upsert po (supplierId, inventoryItemId)
//        (201 create / 200 update; audit 'SUPPLIER_CATALOG_UPSERT')
// DELETE /api/suppliers/[id]/catalog?catalogItemId= → brisanje vrstice
//
// Kanon P1-13: packQty = osnovnih enot na 1 paket; pricePerPack = QUOTED cena
// na PAKET; baseUnitPrice = izračunana osnovna cena (pricePerPack / packQty,
// round4 prek '@/lib/procurement/pack-size'). Denar ostane na nivoju vrstice.
//
// Fail-closed: auth manage_inventory, dobavitelj 404 (ne razkrivamo tujih),
// artikel 404 izven lokacijskega scope-a (pariteta price-history POST),
// tenant scope resolveTenantLocationIdOrThrow. Rate limit AUTHENTICATED_LIMIT
// (pariteta draft-po).
// ============================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { db, createAuditLog } from '@/lib/db'
import { deepToNumbers, toNum } from '@/lib/decimal'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { baseUnitPrice } from '@/lib/procurement/pack-size'

export const dynamic = 'force-dynamic'

// --- Zod sheme (Zod je hišni kanon za body validacijo) ---
const catalogUpsertSchema = z.object({
  inventoryItemId: z.string().min(1, 'inventoryItemId je obvezen').max(100, 'inventoryItemId je predolg'),
  // > 0 in finite se preverjata explicitno (koda INVALID_INPUT) — Zod tu samo tip.
  packQty: z.number({ message: 'packQty mora biti število' }),
  packUnit: z.string().max(30, 'Oznaka pakiranja je predolga').default('paket'),
  pricePerPack: z.number({ message: 'pricePerPack mora biti število' }),
  vatRate: z.number().min(0, 'DDV ne more biti negativen').max(100, 'DDV ne more presegati 100%').nullable().optional(),
  minOrderPacks: z.number().int('minOrderPacks mora biti celo število').min(1, 'minOrderPacks mora biti vsaj 1').max(10000, 'minOrderPacks je prevelik').optional(),
  supplierSku: z.string().max(100, 'Šifra dobavitelja je predolga').optional(),
  note: z.string().max(500, 'Opomba je predolga').optional(),
  // Deaktivacija vrstice (UI akcija "deaktiviraj") gre prek istega upserta.
  isActive: z.boolean().optional(),
})

/** Zgornja meja vrstic v odgovoru (zaščita pred pretiranimi odgovori). */
const CATALOG_ROW_LIMIT = 500

// --- GET (katalog dobavitelja) ---
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Rate limit — blago branje (AUTHENTICATED_LIMIT kanon)
    const rl = await checkRateLimitAsync('supplier-catalog-get', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs)

    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'GET /api/suppliers/[id]/catalog',
    })
    if ('error' in scope) return scope.error

    const { id } = await params

    // Fail-closed 404: dobavitelj ne obstaja (ne razkrivamo, ne fabrikamo)
    const supplier = await db.supplier.findUnique({
      where: { id },
      select: { id: true, name: true },
    })
    if (!supplier) {
      return NextResponse.json({ error: 'Dobavitelj ni najden' }, { status: 404 })
    }

    const rows = await db.supplierItem.findMany({
      where: { supplierId: id },
      orderBy: { createdAt: 'asc' },
      take: CATALOG_ROW_LIMIT,
      include: {
        inventoryItem: { select: { id: true, name: true, unit: true, costPerUnit: true, locationId: true } },
      },
    })

    // Tenant scope: vrstica velja le, če je artikel lokacije scope-a
    // (pariteta price-history GET supplier mode; super-admin: null = vse).
    const scoped = scope.locationId
      ? rows.filter(r => r.inventoryItem.locationId === scope.locationId)
      : rows

    const items = scoped
      .map(r => ({
        id: r.id,
        supplierSku: r.supplierSku,
        packQty: r.packQty,
        packUnit: r.packUnit,
        pricePerPack: r.pricePerPack,
        vatRate: r.vatRate,
        minOrderPacks: r.minOrderPacks,
        isActive: r.isActive,
        note: r.note,
        // Izračunana osnovna cena (kanon: pricePerPack / packQty, round4)
        baseUnitPrice: baseUnitPrice(toNum(r.pricePerPack), toNum(r.packQty)),
        inventoryItem: {
          id: r.inventoryItem.id,
          name: r.inventoryItem.name,
          unit: r.inventoryItem.unit,
          costPerUnit: r.inventoryItem.costPerUnit,
        },
      }))
      // Stabilen prikaz po imenu artikla (UI tabela)
      .sort((a, b) => a.inventoryItem.name.localeCompare(b.inventoryItem.name, 'sl'))

    return NextResponse.json(deepToNumbers({ supplierId: supplier.id, supplierName: supplier.name, items }))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/suppliers/[id]/catalog', 'Napaka pri branju kataloga dobavitelja')
  }
}

// --- POST (upsert po paru supplierId + inventoryItemId) ---
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Rate limit — Write z auditom (AUTHENTICATED_LIMIT, pariteta draft-po)
    const rl = await checkRateLimitAsync('supplier-catalog-post', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs)

    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'POST /api/suppliers/[id]/catalog',
    })
    if ('error' in scope) return scope.error

    const { id } = await params

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(catalogUpsertSchema, bodyResult.data)
    if (validationError) return validationError

    // Kanon P1-13: packQty > 0 (finite) in pricePerPack >= 0 (finite) —
    // sicer 400 INVALID_INPUT (brez izmišljevanja pakiranja/cene).
    if (!Number.isFinite(data.packQty) || data.packQty <= 0) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'packQty mora biti pozitivno število (osnovnih enot na 1 paket)' },
        { status: 400 },
      )
    }
    if (!Number.isFinite(data.pricePerPack) || data.pricePerPack < 0) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'pricePerPack ne sme biti negativen' },
        { status: 400 },
      )
    }

    // Fail-closed reference checks (brez fabrikacije FK; pariteta price-history POST)
    const supplier = await db.supplier.findUnique({
      where: { id },
      select: { id: true, name: true },
    })
    if (!supplier) {
      return NextResponse.json({ error: 'SUPPLIER_NOT_FOUND', message: 'Dobavitelj ne obstaja' }, { status: 404 })
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
      return NextResponse.json({ error: 'ITEM_NOT_FOUND', message: 'Artikel ne obstaja' }, { status: 404 })
    }

    const upsertData = {
      supplierId: id,
      inventoryItemId: data.inventoryItemId,
      packQty: data.packQty,
      packUnit: data.packUnit,
      pricePerPack: data.pricePerPack,
      vatRate: data.vatRate ?? null,
      minOrderPacks: data.minOrderPacks ?? 1,
      supplierSku: data.supplierSku ?? '',
      note: data.note ?? '',
      isActive: data.isActive ?? true,
    }

    // Upsert po paru — findUnique + create/update (create/update status koda),
    // P2002 race → 409 retry (pariteta receive/AP kanona).
    const existing = await db.supplierItem.findUnique({
      where: { supplierId_inventoryItemId: { supplierId: id, inventoryItemId: data.inventoryItemId } },
      select: { id: true },
    })

    let row: { id: string }
    let created: boolean
    if (existing) {
      const updated = await db.supplierItem.update({ where: { id: existing.id }, data: upsertData })
      row = updated
      created = false
    } else {
      try {
        row = await db.supplierItem.create({ data: upsertData })
        created = true
      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return NextResponse.json(
            { error: 'CONFLICT', message: 'Katalog vrstica je bila ustvarjena vzporedno — poskusite znova' },
            { status: 409 },
          )
        }
        throw err
      }
    }

    // Audit (kanon createAuditLog — hash veriga; pariteta price-history POST)
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'SUPPLIER_CATALOG_UPSERT',
      entityType: 'SupplierItem',
      entityId: row.id,
      locationId: scope.locationId,
      details: {
        supplierId: id,
        supplierName: supplier.name,
        inventoryItemId: data.inventoryItemId,
        itemName: item.name,
        packQty: String(data.packQty),
        packUnit: data.packUnit,
        pricePerPack: String(data.pricePerPack),
        minOrderPacks: upsertData.minOrderPacks,
        isActive: upsertData.isActive,
        created,
      },
    })

    return NextResponse.json(
      {
        success: true,
        created,
        row: {
          id: row.id,
          supplierId: id,
          inventoryItemId: data.inventoryItemId,
          supplierSku: upsertData.supplierSku,
          packQty: upsertData.packQty,
          packUnit: upsertData.packUnit,
          pricePerPack: upsertData.pricePerPack,
          vatRate: upsertData.vatRate,
          minOrderPacks: upsertData.minOrderPacks,
          isActive: upsertData.isActive,
          note: upsertData.note,
          // Izračunana osnovna cena tudi v upsert odgovoru (UI hint)
          baseUnitPrice: baseUnitPrice(upsertData.pricePerPack, upsertData.packQty),
          inventoryItem: { id: item.id, name: item.name, unit: item.unit },
        },
      },
      { status: created ? 201 : 200 },
    )
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/suppliers/[id]/catalog', 'Napaka pri shranjevanju kataloga dobavitelja')
  }
}

// --- DELETE (brisanje katalog vrstice) ---
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rl = await checkRateLimitAsync('supplier-catalog-delete', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs)

    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'DELETE /api/suppliers/[id]/catalog',
    })
    if ('error' in scope) return scope.error

    const { id } = await params
    const catalogItemId = (new URL(req.url).searchParams.get('catalogItemId') || '').trim()
    if (!catalogItemId) {
      return NextResponse.json(
        { error: 'PARAM_REQUIRED', message: 'Podati morate ?catalogItemId=' },
        { status: 400 },
      )
    }

    // Fail-closed: vrstica mora pripadati TEM dobavitelju (tuja vrstica = 404,
    // ne razkritje) in artikel mora biti v lokacijskem scope-u (pariteta GET).
    const line = await db.supplierItem.findFirst({
      where: { id: catalogItemId, supplierId: id },
      include: { inventoryItem: { select: { id: true, name: true, locationId: true } } },
    })
    if (!line) {
      return NextResponse.json({ error: 'Katalog vrstica ni najdena' }, { status: 404 })
    }
    if (scope.locationId && line.inventoryItem.locationId !== scope.locationId) {
      return NextResponse.json({ error: 'Katalog vrstica ni najdena' }, { status: 404 })
    }

    await db.supplierItem.delete({ where: { id: line.id } })

    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'SUPPLIER_CATALOG_DELETE',
      entityType: 'SupplierItem',
      entityId: line.id,
      locationId: scope.locationId,
      details: {
        supplierId: id,
        inventoryItemId: line.inventoryItemId,
        itemName: line.inventoryItem.name,
        packQty: String(line.packQty),
        packUnit: line.packUnit,
        pricePerPack: String(line.pricePerPack),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/suppliers/[id]/catalog', 'Napaka pri brisanju kataloga dobavitelja')
  }
}
