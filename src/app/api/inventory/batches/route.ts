// ============================================
// BATCH / LOT / EXPIRY API — serije zaloge (epic #115 §4, runda 120)
// ============================================
// GET /api/inventory/batches — sledljivost serij: supplier → prevzem →
// batch → poraba/odpad (StockBatchAllocation). Podpira filtre:
//   ?inventoryItemId=   serije enega artikla
//   ?expiringWithinDays=N  serije, ki pretečejo v N dneh (vključno)
//   ?expired=1          samo pretečene serije
//   ?status=ACTIVE|EXHAUSTED
//   ?locationId=        izrecna lokacija (samo super-admin brez session scope)
// Odgovor vsebuje computed flags (daysToExpiry, isExpired) + summary
// (expired / expiringSoon / active / exhausted) za opozorila §4:
// expiry soon · expired · low stock · stockout risk (low stock/stockout
// ostajata item nivojski — /api/inventory + /api/inventory/menu-stock).
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { structuredErrorResponse } from '@/lib/structured-error'

export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000
/** Prag "uskoro preteče" (§4 expiry soon) — 7 dni. */
const EXPIRING_SOON_DAYS = 7

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error
    const session = authResult.session
    const sessionLocId = session?.locationId ?? null
    const isRoleAdmin = session?.role === 'admin' || session?.role === 'super_admin'
    // R81-F fail-closed: non-admin brez session lokacije ne more izpeljati scope-a
    if (!sessionLocId && !isRoleAdmin) {
      return NextResponse.json(
        { error: 'Vaš račun nima dodeljene lokacije. Kontaktirajte administratorja.' },
        { status: 403 },
      )
    }

    const { searchParams } = new URL(req.url)
    const inventoryItemId = searchParams.get('inventoryItemId') || undefined
    const statusFilter = searchParams.get('status') || undefined
    const expiredOnly = searchParams.get('expired') === '1'
    const expiringWithinDaysRaw = searchParams.get('expiringWithinDays')
    const expiringWithinDays =
      expiringWithinDaysRaw != null && expiringWithinDaysRaw !== '' && Number.isFinite(Number(expiringWithinDaysRaw))
        ? Math.min(Math.max(Math.trunc(Number(expiringWithinDaysRaw)), 1), 365)
        : null
    // Super-admin brez session lokacije lahko izrecno poševa (fail-closed za ostale)
    const explicitLocationId = searchParams.get('locationId') || undefined
    const effectiveLocationId = sessionLocId ?? explicitLocationId

    // R80/R81-F scope politika: lokacijsko vezana seja vidi serije svoje
    // lokacije + skupni vir (locationId NULL, enaka semantika kot zalogovni
    // scope kanon); super-admin vidi vse (ali izrecno lokacijo).
    const itemScopeFilter = effectiveLocationId
      ? { OR: [{ locationId: effectiveLocationId }, { locationId: null }] }
      : {}

    const now = new Date()
    const expiringBefore = expiringWithinDays != null ? new Date(now.getTime() + expiringWithinDays * DAY_MS) : null

    const batches = await db.inventoryBatch.findMany({
      where: {
        ...(inventoryItemId ? { inventoryItemId } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(expiredOnly ? { expiryDate: { lt: now } } : {}),
        ...(expiringBefore
          ? {
              status: 'ACTIVE',
              expiryDate: { not: null, lte: expiringBefore, gte: now },
            }
          : {}),
        ...(effectiveLocationId ? itemScopeFilter : {}),
      },
      include: {
        inventoryItem: { select: { id: true, name: true, unit: true, quantity: true, minQuantity: true, locationId: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: [{ expiryDate: 'asc' }, { receivedAt: 'asc' }],
      take: 500,
    })

    const rows = batches.map((b) => {
      const daysToExpiry =
        b.expiryDate != null ? Math.ceil((b.expiryDate.getTime() - now.getTime()) / DAY_MS) : null
      return {
        id: b.id,
        inventoryItemId: b.inventoryItemId,
        itemName: b.inventoryItem?.name ?? '',
        itemUnit: b.inventoryItem?.unit ?? b.unit,
        itemQuantity: b.inventoryItem?.quantity ?? null,
        itemMinQuantity: b.inventoryItem?.minQuantity ?? null,
        locationId: b.locationId,
        lotNumber: b.lotNumber,
        supplierId: b.supplierId,
        supplierName: b.supplierName || b.supplier?.name || '',
        receivedAt: b.receivedAt.toISOString(),
        expiryDate: b.expiryDate ? b.expiryDate.toISOString() : null,
        quantityInitial: b.quantityInitial,
        quantityRemaining: b.quantityRemaining,
        unitCost: b.unitCost,
        status: b.status,
        note: b.note,
        // §4 opozorila — computed flags
        daysToExpiry,
        isExpired: b.expiryDate != null && b.expiryDate.getTime() < now.getTime(),
        isExpiringSoon:
          b.expiryDate != null &&
          b.status === 'ACTIVE' &&
          daysToExpiry != null &&
          daysToExpiry >= 0 &&
          daysToExpiry <= EXPIRING_SOON_DAYS,
      }
    })

    const activeRows = rows.filter((r) => r.status === 'ACTIVE')
    const summary = {
      total: rows.length,
      active: activeRows.length,
      exhausted: rows.filter((r) => r.status === 'EXHAUSTED').length,
      expired: activeRows.filter((r) => r.isExpired).length,
      expiringSoon: activeRows.filter((r) => r.isExpiringSoon).length,
      expiringSoonDays: EXPIRING_SOON_DAYS,
    }

    return NextResponse.json(deepToNumbers({ batches: rows, summary }))
  } catch (error: unknown) {
    return structuredErrorResponse(error, 'GET /api/inventory/batches', 'Napaka pri branju serij zaloge')
  }
}
