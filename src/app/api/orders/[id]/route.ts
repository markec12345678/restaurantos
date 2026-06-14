
// FIX BUG-01: Status transition state machine — prepreči nazadovanje statusa
import { db, createAuditLog } from '@/lib/db'
import { toNum, deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { updateOrderSchema, orderPatchActionSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { emitEvent } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import {
  VALID_STATUS_TRANSITIONS, VALID_PAYMENT_TRANSITIONS,
  broadcastWS, freeTableIfNoActiveOrders,
  handleOrderCompletion, handleOrderCancellation, handleItemStatusUpdate,
} from './_helpers'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(updateOrderSchema, bodyResult.data)
    if (validationError) return validationError

    // Pridobi trenutno stanje naročila
    const existingOrder = await db.order.findUnique({
      where: { id },
      include: { orderItems: true, deliveryInfo: true },
    })

    if (!existingOrder) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    }

    // FIX BUG-01: Preveri veljavnost prehoda statusa
    if (data.status && data.status !== existingOrder.status) {
      const allowedTransitions = VALID_STATUS_TRANSITIONS[existingOrder.status] || []
      if (!allowedTransitions.includes(data.status)) {
        return NextResponse.json(
          { error: `Prehod iz '${existingOrder.status}' v '${data.status}' ni dovoljen. Dovoljeni: [${allowedTransitions.join(', ')}]` },
          { status: 400 }
        )
      }
    }

    // FIX BUG-01: Prepreči nazadovanje plačilnega statusa
    if (data.paymentStatus && data.paymentStatus !== existingOrder.paymentStatus) {
      const allowed = VALID_PAYMENT_TRANSITIONS[existingOrder.paymentStatus] || []
      if (!allowed.includes(data.paymentStatus)) {
        return NextResponse.json(
          { error: `Plačilni prehod iz '${existingOrder.paymentStatus}' v '${data.paymentStatus}' ni dovoljen` },
          { status: 400 }
        )
      }
    }

    // FIX H-08: Zneski se izračunajo strežniško — klient NE sme nastavljati discount/tip/total
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

    // Preklic/storno metapodatki
    if (data.status === 'cancelled') {
      updateData.cancelledAt = new Date()
      if (!data.cancelledBy && authResult.session) {
        updateData.cancelledBy = authResult.session.employeeId
      }
    }

    // Ko je plačilo status 'paid', zabeleži paidAt
    if (data.paymentStatus === 'paid') {
      updateData.paidAt = new Date()
    }

    // Webhook: order.paid — ko postane plačano
    if (data.paymentStatus === 'paid' && existingOrder.paymentStatus !== 'paid') {
      emitEvent('order.paid', {
        orderId: id, orderNumber: existingOrder.orderNumber,
        total: toNum(existingOrder.total),
        paymentMethod: data.paymentMethod || existingOrder.paymentMethod,
        tip: toNum(existingOrder.tip),
      }).catch(err => logger.error('API', '[Webhook] order.paid napaka:', err))
    }

    // Webhook: order.ready — ko postane pripravljeno
    if (data.status === 'ready' && existingOrder.status !== 'ready') {
      emitEvent('order.ready', {
        orderId: id, orderNumber: existingOrder.orderNumber,
      }).catch(err => logger.error('API', '[Webhook] order.ready napaka:', err))
    }

    // Webhook: order.delivered — ko je dostavljeno
    if (data.status === 'completed' && existingOrder.type === 'delivery') {
      const deliveryAddress = existingOrder.deliveryInfo?.address || existingOrder.notes || ''
      emitEvent('order.delivered', {
        orderId: id, orderNumber: existingOrder.orderNumber, deliveryAddress,
      }).catch(err => logger.error('API', '[Webhook] order.delivered napaka:', err))
    }

    // Webhook: order.updated — splošna posodobitev
    if (data.status && data.status !== 'cancelled') {
      emitEvent('order.updated', {
        orderId: id, changes: Object.keys(data), status: data.status,
      }).catch(err => logger.error('API', '[Webhook] order.updated napaka:', err))
    }

    // FIX CRITICAL: Use optimistic locking — updateMany with WHERE clause checking status hasn't changed
    const updateResult = await db.order.updateMany({
      where: { id, status: existingOrder.status },
      data: updateData,
    })

    if (updateResult.count === 0) {
      return NextResponse.json({
        error: 'Naročilo je bilo medtem spremenjeno. Osvežite stran in poskusite znova.',
      }, { status: 409 })
    }

    // When order moves to in-progress, also mark pending items as preparing
    if (data.status === 'in-progress') {
      await db.orderItem.updateMany({
        where: { orderId: id, status: 'pending' },
        data: { status: 'preparing' },
      })
    }

    // When order is completed
    if (data.status === 'completed') {
      await handleOrderCompletion(id, existingOrder)
    }

    // When order is cancelled — VRNI ZALOGO
    if (data.status === 'cancelled') {
      await handleOrderCancellation(id, existingOrder, data.cancelReason, authResult.session?.employeeId)
    } else if (data.status) {
      // Revizijski dnevnik: sprememba statusa
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

    // Re-fetch to get updated items
    const updatedOrder = await db.order.findUnique({
      where: { id },
      include: { table: true, orderItems: { include: { menuItem: true } } },
    })

    return NextResponse.json(deepToNumbers(updatedOrder || existingOrder))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/orders/[id]', 'Napaka pri posodobitvi naročila')
  }
}

// ─── PATCH — Item status posodobitve (KDS + Natakar) ───────────
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data: patchData, error: patchError } = validateBody(orderPatchActionSchema, bodyResult.data)
    if (patchError) return patchError

    // Item status posodobitev — iz KDS zaslona ali natakarjeve tablice
    if (patchData.action === 'item_status') {
      const { itemId, status } = patchData
      const order = await db.order.findUnique({ where: { id } })
      if (!order) return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })

      const result = await handleItemStatusUpdate(id, itemId, status, order)
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
      return NextResponse.json(result)
    }

    // Fire action — pošlji naročilo v kuhinjo
    if (patchData.action === 'fire') {
      await db.order.update({ where: { id }, data: { status: 'in-progress' } })
      await db.orderItem.updateMany({ where: { orderId: id, status: 'pending' }, data: { status: 'fired' } })

      broadcastWS('ORDER_FIRED', {
        orderId: id,
        orderNumber: (await db.order.findUnique({ where: { id } }))?.orderNumber,
      })

      const updated = await db.order.findUnique({
        where: { id },
        include: { table: true, orderItems: { include: { menuItem: true } } },
      })
      return NextResponse.json(deepToNumbers(updated))
    }

    return NextResponse.json({ error: 'Neznana akcija' }, { status: 400 })
  } catch (error: unknown) {
    return handleApiError(error, 'PATCH /api/orders/[id]', 'Napaka pri posodobitvi')
  }
}

// DELETE — Soft delete: označi naročilo kot preklicano (ne izbriše iz baze!)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const order = await db.order.findUnique({
      where: { id },
      include: { receipt: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    }

    // FIX: Prevent deleting completed orders — they must be stornoed via proper flow
    if (order.status === 'completed') {
      return NextResponse.json({ error: 'Zaključenega naročila ni mogoče izbrisati. Uporabite storno postopek.' }, { status: 400 })
    }

    if (order.status === 'cancelled') {
      return NextResponse.json({ error: 'Naročilo je že preklicano' }, { status: 400 })
    }

    // Če ima naročilo račun (FURS obveznost), NE smemo izbrisati — samo prekličemo
    if (order.receipt.length > 0) {
      await db.order.update({
        where: { id },
        data: {
          status: 'cancelled', cancelReason: 'Izbrisano iz seznama',
          cancelledAt: new Date(), cancelledBy: authResult.session?.employeeId || '',
        },
      })
      if (order.tableId) await freeTableIfNoActiveOrders(order.tableId)
      broadcastWS('ORDER_CANCELLED', { orderId: id, orderNumber: order.orderNumber, cancelReason: 'Izbrisano iz seznama (z računom)' })
      return NextResponse.json({ success: true, action: 'soft-delete', message: 'Naročilo preklicano' })
    }

    // Naročilo brez računa — prekliči in vrni zalogo
    await db.order.update({
      where: { id },
      data: {
        status: 'cancelled', cancelReason: 'Izbrisano iz seznama',
        cancelledAt: new Date(), cancelledBy: authResult.session?.employeeId || '',
      },
    })

    if (order.tableId) await freeTableIfNoActiveOrders(order.tableId)

    // VRNI ZALOGO
    if (order.inventoryDeducted) {
      const { returnStockForOrder } = await import('@/lib/stock-deduction')
      await returnStockForOrder(id, order.orderNumber, 'IZBRISANO IZ SEZNAMA (BREZ RAČUNA)')
    }

    broadcastWS('ORDER_CANCELLED', { orderId: id, orderNumber: order.orderNumber, cancelReason: 'Izbrisano iz seznama (brez računa)' })

    return NextResponse.json({ success: true, action: 'soft-delete', message: 'Naročilo preklicano' })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/orders/[id]', 'Napaka pri brisanju naročila')
  }
}
