// POST /api/orders/:id/transfer — Prenesi naročilo na drugo mizo
// Posodobi order.tableId, stari mizi nastavi status na 'available',
// novi mizi nastavi status na 'occupied'. Ustvari AuditLog.
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { parseJsonBody } from '@/lib/api-utils'
import { structuredErrorResponse } from '@/lib/structured-error'
import { transferOrderToTable } from '../_helpers/order-mutations'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

const transferSchema = z.object({
  newTableId: z.string().min(1, 'Ciljna miza je obvezna'),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const parseResult = transferSchema.safeParse(bodyResult.data)
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Ciljna miza je obvezna' }, { status: 400 })
    }
    const { newTableId } = parseResult.data

    // FIX P0-C1 (IDOR) + FIX R86-2a (M2 fail-open): centralni resolver
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'POST /api/orders/[id]/transfer',
    })
    if ('error' in scope) return scope.error

    // FIX R81-F (WRITE IDOR): fast-path scoped lookup — izven scope-a → 404
    // (zgodnja stopnica; R108 OR-2: dejanski pisalni tok je v kanonu
    // transferOrderToTable() s tx-fresh re-readom + CAS — ta read je SAMO
    // zgodnja 404 stopnica + vir številk miz za odgovor/audit).
    const order = await db.order.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
      include: { table: true },
    })
    if (!order) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    }

    // Preveri da ciljna miza obstaja (zgodnja stopnica — kanon re-checka fresh)
    // FIX P0-C1 (IDOR): Ciljna miza mora biti v isti lokaciji kot uporabnik
    const newTable = await db.table.findFirst({
      where: { id: newTableId, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
    })
    if (!newTable) {
      return NextResponse.json({ error: 'Ciljna miza ni najdena' }, { status: 404 })
    }

    // R108 OR-2 (HIGH, kanon R106/R107): prenos v ENEM kanonu —
    // $transaction(Serializable) + advisory lock naročila ('order-write:') +
    // ključavnici obeh miz ('table-ops:', order → table smer = deadlock-varen
    // lock graf) + tx-fresh scoped re-read + status CAS (prej: NEPOGOJEN
    // update brez preverbe — completed/cancelled naročilo je bilo možno
    // prenesti; sočasen merge/transfer je prepisoval mizna stanja) +
    // strukturirani { error, status } throw-i.
    const result = await transferOrderToTable({
      orderId: id,
      locationId: scope.locationId,
      newTableId,
    })

    // Audit log (številke miz iz fast-path reada — samo za sporočilo)
    try {
      await createAuditLog({
        userId: authResult.session?.employeeId,
        action: 'ORDER_TABLE_TRANSFER',
        entityType: 'Order',
        entityId: id,
        details: {
          orderNumber: order.orderNumber,
          fromTableId: result.fromTableId,
          fromTableNumber: order.table?.number,
          toTableId: result.toTableId,
          toTableNumber: newTable.number,
        },
      })
    } catch (auditErr) {
      // Audit log napaka ne blokira prenosa
      logger.warn('API', 'AuditLog napaka pri prenosu mize:', auditErr)
    }

    return NextResponse.json({
      success: true,
      message: `Naročilo #${order.orderNumber} preneseno na mizo ${newTable.number}`,
      order: { id: result.order.id as string, orderNumber: order.orderNumber, tableId: result.toTableId },
    })
  } catch (error: unknown) {
    // FIX: Boljše logiranje za debugiranje 500 napak
    logger.error('API', 'Transfer error:', error instanceof Error ? error.message : String(error))
    // R108 (error kontrakt): P2002/P2034 race-pathi → 409 (nikoli 500)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return NextResponse.json(
        { error: 'Prenos je v obdelavi (sočasen dostop) — poskusite znova' },
        { status: 409 }
      )
    }
    return structuredErrorResponse(error, 'POST /api/orders/[id]/transfer', 'Napaka pri prenosu naročila')
  }
}
