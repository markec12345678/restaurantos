// POST /api/tables/merge — Združi dve mizi v eno
// Body: { sourceTableId, targetTableId }
// Vsa aktivna naročila s source mize se prenesejo na target mizo.
// Če ima target miza že odprto naročilo, se artikli združijo v obstoječe naročilo.
// Source miza se sprosti (status=available).
import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { createAuditLog } from '@/lib/db'
import { z } from 'zod'


const mergeSchema = z.object({
  sourceTableId: z.string().min(1, 'Izvorna miza je obvezna'),
  targetTableId: z.string().min(1, 'Ciljna miza je obvezna'),
})

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(mergeSchema, bodyResult.data)
    if (validationError) return validationError

    if (data.sourceTableId === data.targetTableId) {
      return NextResponse.json({ error: 'Izvorna in ciljna miza sta isti' }, { status: 400 })
    }

    const [sourceTable, targetTable] = await Promise.all([
      db.table.findUnique({ where: { id: data.sourceTableId } }),
      db.table.findUnique({ where: { id: data.targetTableId } }),
    ])
    if (!sourceTable) return NextResponse.json({ error: 'Izvorna miza ni najdena' }, { status: 404 })
    if (!targetTable) return NextResponse.json({ error: 'Ciljna miza ni najdena' }, { status: 404 })

    // Pridobi aktivna naročila na obeh mizah
    const [sourceOrders, targetOrders] = await Promise.all([
      db.order.findMany({
        where: {
          tableId: data.sourceTableId,
          status: { in: ['pending', 'in-progress', 'ready'] },
          paymentStatus: { in: ['unpaid', 'partial'] },
        },
        include: { orderItems: true },
      }),
      db.order.findMany({
        where: {
          tableId: data.targetTableId,
          status: { in: ['pending', 'in-progress', 'ready'] },
          paymentStatus: { in: ['unpaid', 'partial'] },
        },
        include: { orderItems: true },
      }),
    ])

    if (sourceOrders.length === 0) {
      return NextResponse.json({ error: 'Izvorna miza nima aktivnih naročil za združitev' }, { status: 400 })
    }

    const result = await db.$transaction(async (tx) => {
      // Če target nima odprtega naročila, prenesi vsa source naročila
      // Če target ima odprto naročilo, združi artikle source naročil v target naročilo
      const targetOrder = targetOrders[0] // uporabi prvo target naročilo kot primary
      let mergedOrderIds: string[] = []
      let totalItemsMerged = 0

      if (!targetOrder) {
        // Preprost prenos — premakni vsa source naročila na target mizo
        for (const order of sourceOrders) {
          await tx.order.update({ where: { id: order.id }, data: { tableId: data.targetTableId } })
          mergedOrderIds.push(order.id)
          totalItemsMerged += order.orderItems.length
        }
      } else {
        // Združi artikle — premakni OrderItems iz source naročil v target naročilo
        for (const sourceOrder of sourceOrders) {
          for (const item of sourceOrder.orderItems) {
            await tx.orderItem.update({
              where: { id: item.id },
              data: { orderId: targetOrder.id },
            })
            totalItemsMerged++
          }
          // Source naročilo označi kot cancelled (združeno)
          await tx.order.update({
            where: { id: sourceOrder.id },
            data: {
              status: 'cancelled',
              paymentStatus: 'cancelled',
              cancelReason: `Združeno z mizo ${targetTable.number}`,
              tableId: null,
            },
          })
        }
        mergedOrderIds = [targetOrder.id]

        // Preračunaj totale target naročila po združitvi
        const updatedItems = await tx.orderItem.findMany({
          where: { orderId: targetOrder.id, voided: false },
          select: { price: true, quantity: true, vatAmount: true },
        })
        const subtotal = updatedItems.reduce((s, oi) => s + toNum(oi.price) * oi.quantity, 0)
        const tax = updatedItems.reduce((s, oi) => s + toNum(oi.vatAmount), 0)
        const total = subtotal + tax
        await tx.order.update({
          where: { id: targetOrder.id },
          data: { subtotal, tax, total, totalWithTip: total },
        })
      }

      // Source miza → prosto
      await tx.table.update({ where: { id: data.sourceTableId }, data: { status: 'available' } })
      // Target miza → zasedeno
      await tx.table.update({ where: { id: data.targetTableId }, data: { status: 'occupied' } })

      return { mergedOrderIds, totalItemsMerged }
    })

    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'TABLE_MERGE',
      entityType: 'Table',
      entityId: data.sourceTableId,
      details: {
        sourceTableNumber: sourceTable.number,
        targetTableNumber: targetTable.number,
        sourceOrdersCount: sourceOrders.length,
        targetOrdersCount: targetOrders.length,
        itemsMerged: result.totalItemsMerged,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Miza ${sourceTable.number} združena z mizo ${targetTable.number}`,
      itemsMerged: result.totalItemsMerged,
      sourceTableStatus: 'available',
      targetTableStatus: 'occupied',
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/tables/merge', 'Napaka pri združevanju miz')
  }
}
