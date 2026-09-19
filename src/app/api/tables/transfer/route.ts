// POST /api/tables/transfer — Prenesi naročilo z ene mize na drugo
// Body: { sourceTableId, targetTableId, orderId? }
// - Če orderId podan: prenese samo to naročilo
// - Če brez orderId: prenese vsa aktivna naročila s source na target
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { notInScopeResponse } from '@/lib/tenant-scope'
import { z } from 'zod'
import { createAuditLog } from '@/lib/db'


const transferSchema = z.object({
  sourceTableId: z.string().min(1, 'Izvorna miza je obvezna'),
  targetTableId: z.string().min(1, 'Ciljna miza je obvezna'),
  orderId: z.string().nullable().optional(),
})

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(transferSchema, bodyResult.data)
    if (validationError) return validationError

    if (data.sourceTableId === data.targetTableId) {
      return NextResponse.json({ error: 'Izvorna in ciljna miza sta isti' }, { status: 400 })
    }

    // FIX R80 (HIGH, WRITE IDOR): prej `db.table.findUnique({ where: { id } })` ×2
    // BREZ lokacijskega checka — take_orders staff je lahko prenesel naročila
    // med mizami TUJIH tenantov (inner order.findMany/count je dedoval
    // nescopecan parent). P0-C1 vzorec iz orders/[id]/transfer: findFirst z
    // lokacijskim filtrom iz seje; izven scope-a → 404 (ne razkrivamo obstoja).
    // Super-admin brez lokacije (scope null) = globalni nadzor (kot P0-C1).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, null, {
      endpoint: 'POST /api/tables/transfer',
    })
    if ('error' in scope) return scope.error
    const tableScope = scope.locationId ? { locationId: scope.locationId } : {}

    // Preveri obe mizi (scoped — findFirst namesto findUnique)
    const [sourceTable, targetTable] = await Promise.all([
      db.table.findFirst({ where: { id: data.sourceTableId, ...tableScope } }),
      db.table.findFirst({ where: { id: data.targetTableId, ...tableScope } }),
    ])
    if (!sourceTable) return notInScopeResponse('Miza')
    if (!targetTable) return notInScopeResponse('Miza')

    // Pridobi aktivna naročila na izvorni mizi (defense-in-depth: tudi naročila
    // so locationId-filtrirana, da agregat ne more dedovati nescopecanega konteksta)
    const activeOrdersWhere = {
      tableId: data.sourceTableId,
      status: { in: ['pending', 'in-progress', 'ready'] },
      paymentStatus: { in: ['unpaid', 'partial'] },
      ...tableScope,
      ...(data.orderId ? { id: data.orderId } : {}),
    }
    const ordersToTransfer = await db.order.findMany({ where: activeOrdersWhere })

    if (ordersToTransfer.length === 0) {
      return NextResponse.json({ error: 'Ni aktivnih naročil za prenos' }, { status: 400 })
    }

    // Transakcija: prenesi naročila + posodobi statusa miz
    const result = await db.$transaction(async (tx) => {
      // Prenesi vsa naročila na ciljno mizo
      const updatedOrders = await Promise.all(
        ordersToTransfer.map(order =>
          tx.order.update({ where: { id: order.id }, data: { tableId: data.targetTableId } })
        )
      )

      // Preveri, ali ima izvorna miza še vedno odprta naročila
      const remainingOrders = await tx.order.count({
        where: {
          tableId: data.sourceTableId,
          status: { in: ['pending', 'in-progress', 'ready'] },
          paymentStatus: { in: ['unpaid', 'partial'] },
        },
      })

      // Če izvorna miza nima več odprtih naročil, jo označi kot prosto
      if (remainingOrders === 0) {
        await tx.table.update({ where: { id: data.sourceTableId }, data: { status: 'available' } })
      }

      // Ciljna miza je sedaj zasedena
      await tx.table.update({ where: { id: data.targetTableId }, data: { status: 'occupied' } })

      return { updatedOrders, sourceFreed: remainingOrders === 0 }
    })

    // Audit log
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'TABLE_TRANSFER',
      entityType: 'Table',
      entityId: data.sourceTableId,
      details: {
        sourceTableNumber: sourceTable.number,
        targetTableNumber: targetTable.number,
        targetTableId: data.targetTableId,
        ordersTransferred: result.updatedOrders.map(o => o.orderNumber),
        sourceFreed: result.sourceFreed,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Preneseno ${result.updatedOrders.length} naročil z mize ${sourceTable.number} na mizo ${targetTable.number}`,
      transferredOrders: result.updatedOrders.length,
      sourceTableStatus: result.sourceFreed ? 'available' : 'occupied',
      targetTableStatus: 'occupied',
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/tables/transfer', 'Napaka pri prenosu naročila')
  }
}
