// GET /api/purchase-orders/[id]/receipts — Prevzemi naročilnice (GRN dokumenti)
//
// R132 (epic #115 P1-12, §2b): vsak prevzem blaga (receivePurchaseOrderItems
// kanon) ustvari GoodsReceipt dokument + linije v istem tx. Ta ruta vrne GRN
// dokumente naročilnice z linijami (sprejeto / zavrnjeno / razlog / pack
// snapshot) za UI sekcijo "Prevzemi (dobavnice)".
//
// Kanon:
//   - Auth: requireAuth manage_inventory (pariteta receive ruta).
//   - Scope: resolveTenantLocationIdOrThrow (fail-closed, no ?locationId bypass)
//     — cross-tenant naročilnica → 404 (scoped where na PO, ne na GRN).
//   - deepToNumbers() čez API mejo (Decimal → number; kanon #7).

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { deepToNumbers } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { id } = await params

    // R86-2b kanon: centralni tenant scope resolver takoj za requireAuth
    // (fail-closed ordering — prej raw spread session?.locationId).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'GET /api/purchase-orders/[id]/receipts',
    })
    if ('error' in scope) return scope.error

    // Cross-tenant → 404: PO se išče SCOPED (GRN.locationId je tenant metadata,
    // pariteta PO.locationId — scoping gre prek naročilnice).
    const po = await db.purchaseOrder.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
      select: { id: true },
    })
    if (!po) return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })

    const receipts = await db.goodsReceipt.findMany({
      where: { purchaseOrderId: id },
      orderBy: { receivedAt: 'desc' },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    return NextResponse.json({
      receipts: deepToNumbers(receipts).map((grn: Record<string, unknown>) => ({
        id: grn.id,
        grnNumber: grn.grnNumber,
        status: grn.status,
        supplierDocNumber: grn.supplierDocNumber,
        receivedByName: grn.receivedByName,
        receivedAt: grn.receivedAt,
        notes: grn.notes,
        items: (grn.items as Array<Record<string, unknown>>).map((item: Record<string, unknown>) => ({
          id: item.id,
          description: item.description,
          unit: item.unit,
          quantityAccepted: item.quantityAccepted,
          quantityRejected: item.quantityRejected,
          rejectReason: item.rejectReason,
          packQty: item.packQty,
          packUnit: item.packUnit,
          unitPriceOrdered: item.unitPriceOrdered,
        })),
      })),
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/purchase-orders/[id]/receipts', 'Napaka pri pridobivanju prevzemov')
  }
}
