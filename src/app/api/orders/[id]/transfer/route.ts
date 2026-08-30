// POST /api/orders/:id/transfer — Prenesi naročilo na drugo mizo
// Posodobi order.tableId, stari mizi nastavi status na 'available',
// novi mizi nastavi status na 'occupied'. Ustvari AuditLog.
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { z } from 'zod'

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

    const { newTableId } = transferSchema.parse(bodyResult.data)

    // Pridobi naročilo
    const order = await db.order.findUnique({
      where: { id },
      include: { table: true },
    })
    if (!order) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    }

    // Preveri da novo mizo obstaja
    const newTable = await db.table.findUnique({ where: { id: newTableId } })
    if (!newTable) {
      return NextResponse.json({ error: 'Ciljna miza ni najdena' }, { status: 404 })
    }

    // Preveri da ni ista miza
    if (order.tableId === newTableId) {
      return NextResponse.json({ error: 'Naročilo je že na tej mizi' }, { status: 400 })
    }

    // Preveri da novo mizo ni zasedena (razen če je 'available')
    if (newTable.status === 'occupied') {
      return NextResponse.json({ error: `Miza ${newTable.number} je zasedena` }, { status: 400 })
    }

    const oldTableId = order.tableId

    // Atomna transakcija: posodobi naročilo + stari mizi + novi mizi
    const result = await db.$transaction(async (tx) => {
      // Posodobi naročilo
      const updatedOrder = await tx.order.update({
        where: { id },
        data: { tableId: newTableId },
        include: { table: true },
      })

      // Stara miza → available (če ni več drugih naročil na njej)
      if (oldTableId) {
        const activeOrdersOnOldTable = await tx.order.count({
          where: {
            tableId: oldTableId,
            id: { not: id },
            status: { in: ['pending', 'in-progress', 'ready'] },
          },
        })
        if (activeOrdersOnOldTable === 0) {
          await tx.table.update({
            where: { id: oldTableId },
            data: { status: 'available' },
          })
        }
      }

      // Nova miza → occupied
      await tx.table.update({
        where: { id: newTableId },
        data: { status: 'occupied' },
      })

      return updatedOrder
    })

    // Audit log
    try {
      await createAuditLog({
        userId: authResult.session?.employeeId,
        action: 'ORDER_TABLE_TRANSFER',
        entityType: 'Order',
        entityId: id,
        details: {
          orderNumber: order.orderNumber,
          fromTableId: oldTableId,
          fromTableNumber: order.table?.number,
          toTableId: newTableId,
          toTableNumber: newTable.number,
        },
      })
    } catch {
      // Audit log napaka ne blokira prenosa
    }

    return NextResponse.json({
      success: true,
      message: `Naročilo #${order.orderNumber} preneseno na mizo ${newTable.number}`,
      order: { id: result.id, orderNumber: result.orderNumber, tableId: result.tableId },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Napaka'
    if (message.includes('required') || message.includes('obvezna')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    return handleApiError(error, 'POST /api/orders/[id]/transfer', 'Napaka pri prenosu naročila')
  }
}
