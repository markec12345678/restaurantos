// PUT handler za posodabljanje naročila

import { db, createAuditLog } from '@/lib/db'
import { toNum, deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { updateOrderSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { validateOrderTransitions } from './transitions'
import { broadcastWS, handleOrderCompletion, handleOrderCancellation } from './order-actions'
import { emitOrderWebhooks } from '../webhooks'

export async function handlePutOrder(req: Request, params: Promise<{ id: string }>) {
  try {
    const { id } = await params

    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(updateOrderSchema, bodyResult.data)
    if (validationError) return validationError

    const existingOrder = await db.order.findUnique({
      where: { id },
      include: { orderItems: true, deliveryInfo: true },
    })

    if (!existingOrder) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    }

    const transitionError = validateOrderTransitions(existingOrder, data)
    if (transitionError) return transitionError

    const updateData: Record<string, unknown> = {}
    if (data.status !== undefined) updateData.status = data.status
    if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.customerName !== undefined) updateData.customerName = data.customerName
    if (data.customerPhone !== undefined) updateData.customerPhone = data.customerPhone
    if (data.cancelReason !== undefined) updateData.cancelReason = data.cancelReason
    if (data.cancelledBy !== undefined) updateData.cancelledBy = data.cancelledBy
    if (data.tip !== undefined) updateData.tip = data.tip
    if (data.totalWithTip !== undefined) updateData.totalWithTip = data.totalWithTip

    if (data.status === 'cancelled') {
      updateData.cancelledAt = new Date()
      if (!data.cancelledBy && authResult.session) {
        updateData.cancelledBy = authResult.session.employeeId
      }
    }

    if (data.paymentStatus === 'paid') {
      updateData.paidAt = new Date()
    }

    // Webhooks
    await emitOrderWebhooks(id, {
      id,
      orderNumber: existingOrder.orderNumber,
      total: toNum(existingOrder.total),
      tip: toNum(existingOrder.tip),
      paymentMethod: existingOrder.paymentMethod,
      paymentStatus: existingOrder.paymentStatus,
      type: existingOrder.type,
      status: existingOrder.status,
      tableId: existingOrder.tableId,
      notes: existingOrder.notes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deliveryInfo: existingOrder.deliveryInfo ? { address: (existingOrder.deliveryInfo as any).address || '' } : null,
      employeeId: existingOrder.employeeId,
      customerName: existingOrder.customerName,
    }, data)

    // Optimistic locking
    const updateResult = await db.order.updateMany({
      where: { id, status: existingOrder.status },
      data: updateData,
    })

    if (updateResult.count === 0) {
      return NextResponse.json({
        error: 'Naročilo je bilo medtem spremenjeno. Osvežite stran in poskusite znova.',
      }, { status: 409 })
    }

    if (data.status === 'in-progress') {
      await db.orderItem.updateMany({
        where: { orderId: id, status: 'pending' },
        data: { status: 'preparing' },
      })
    }

    if (data.status === 'completed') {
      await handleOrderCompletion(id, existingOrder)
    }

    if (data.status === 'cancelled') {
      await handleOrderCancellation(id, existingOrder, data.cancelReason, authResult.session?.employeeId)
    } else if (data.status) {
      await createAuditLog({
        userId: authResult.session?.employeeId,
        action: 'UPDATE_ORDER_STATUS',
        entityType: 'Order',
        entityId: id,
        details: { orderNumber: existingOrder.orderNumber, newStatus: data.status },
      })
      broadcastWS('ORDER_UPDATED', {
        orderId: id, orderNumber: existingOrder.orderNumber, newStatus: data.status,
      })
    }

    const updatedOrder = await db.order.findUnique({
      where: { id },
      include: { table: true, orderItems: { include: { menuItem: true } } },
    })

    return NextResponse.json(deepToNumbers(updatedOrder || existingOrder))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/orders/[id]', 'Napaka pri posodobitvi naročila')
  }
}
