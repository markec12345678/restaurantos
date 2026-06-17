// POST /api/tables/transfer — Prenesi naročilo z ene mize na drugo
// Body: { sourceTableId, targetTableId, orderId? }
// - Če orderId podan: prenese samo to naročilo
// - Če brez orderId: prenese vsa aktivna naročila s source na target
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { z } from 'zod'
import { createAuditLog } from '@/lib/db'


const transferSchema = z.object({
  sourceTableId: z.string().min(1, 'Izvorna miza je obvezna'),
  targetTableId: z.string().min(1, 'Ciljna miza je obvezna'),
  orderId: z.string().nullable().optional(),
})

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

    // Preveri obe mizi
    const [sourceTable, targetTable] = await Promise.all([
      db.table.findUnique({ where: { id: data.sourceTableId } }),
      db.table.findUnique({ where: { id: data.targetTableId } }),
    ])
    if (!sourceTable) return NextResponse.json({ error: 'Izvorna miza ni najdena' }, { status: 404 })
    if (!targetTable) return NextResponse.json({ error: 'Ciljna miza ni najdena' }, { status: 404 })

    // Pridobi aktivna naročila na izvorni mizi
    const activeOrdersWhere = {
      tableId: data.sourceTableId,
      status: { in: ['pending', 'in-progress', 'ready'] },
      paymentStatus: { in: ['unpaid', 'partial'] },
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
