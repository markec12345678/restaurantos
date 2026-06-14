
// FIX BUG-01: Status transition state machine — prepreči nazadovanje statusa
import { db, createAuditLog } from '@/lib/db'
import { toNum, deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { updateOrderSchema, orderPatchActionSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { returnStockForOrder, broadcastLowStockAlert } from '@/lib/stock-deduction'
import { getAppUrl } from '@/lib/utils'
import { emitEvent } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  'pending': ['in-progress', 'cancelled'],
  'in-progress': ['ready', 'cancelled'],
  'ready': ['completed', 'cancelled'],
  'completed': [], // Completed orders CANNOT change status (one-way)
  'cancelled': [],  // Cancelled orders CANNOT be revived
}

// Helper za WebSocket broadcast
async function broadcastWS(type: string, payload: unknown) {
  try {
    await fetch(`${getAppUrl()}/api/ws-broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    })
  } catch {
    // WS strežnik ni na voljo
  }
}

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
      const validPaymentTransitions: Record<string, string[]> = {
        'unpaid': ['partial', 'paid'],
        'partial': ['paid'],
        'paid': ['storno'],
        'storno': [],
      }
      const allowed = validPaymentTransitions[existingOrder.paymentStatus] || []
      if (!allowed.includes(data.paymentStatus)) {
        return NextResponse.json(
          { error: `Plačilni prehod iz '${existingOrder.paymentStatus}' v '${data.paymentStatus}' ni dovoljen` },
          { status: 400 }
        )
      }
    }

    // FIX H-08: Zneski se izračunajo strežniško — klient NE sme nastavljati discount/tip/total
    // EXCEPTION: tip and totalWithTip are allowed from PaymentDialog during payment processing
    const updateData: Record<string, unknown> = {}
    if (data.status !== undefined) updateData.status = data.status
    if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.customerName !== undefined) updateData.customerName = data.customerName
    if (data.customerPhone !== undefined) updateData.customerPhone = data.customerPhone
    if (data.cancelReason !== undefined) updateData.cancelReason = data.cancelReason
    if (data.cancelledBy !== undefined) updateData.cancelledBy = data.cancelledBy
    // FIX: Allow tip and totalWithTip from payment dialog
    if (data.tip !== undefined) updateData.tip = data.tip
    if (data.totalWithTip !== undefined) updateData.totalWithTip = data.totalWithTip

    // Preklic/storno metapodatki
    if (data.status === 'cancelled') {
      updateData.cancelledAt = new Date()
      // Avtomatsko zabeleži kdo je preklical
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
        orderId: id,
        orderNumber: existingOrder.orderNumber,
        total: toNum(existingOrder.total),
        paymentMethod: data.paymentMethod || existingOrder.paymentMethod,
        tip: toNum(existingOrder.tip),
      }).catch(err => logger.error('API', '[Webhook] order.paid napaka:', err))
    }

    // Webhook: order.ready — ko postane pripravljeno
    if (data.status === 'ready' && existingOrder.status !== 'ready') {
      emitEvent('order.ready', {
        orderId: id,
        orderNumber: existingOrder.orderNumber,
      }).catch(err => logger.error('API', '[Webhook] order.ready napaka:', err))
    }

    // Webhook: order.delivered — ko je dostavljeno
    if (data.status === 'completed' && existingOrder.type === 'delivery') {
      // FIX: Use deliveryInfo address, NOT customerPhone — deliveryInfo is included in the query above
      const deliveryAddress = existingOrder.deliveryInfo?.address || existingOrder.notes || ''
      emitEvent('order.delivered', {
        orderId: id,
        orderNumber: existingOrder.orderNumber,
        deliveryAddress,
      }).catch(err => logger.error('API', '[Webhook] order.delivered napaka:', err))
    }

    // Webhook: order.updated — splošna posodobitev
    if (data.status && data.status !== 'cancelled') {
      emitEvent('order.updated', {
        orderId: id,
        changes: Object.keys(data),
        status: data.status,
      }).catch(err => logger.error('API', '[Webhook] order.updated napaka:', err))
    }

    // FIX CRITICAL: Use optimistic locking — updateMany with WHERE clause checking status hasn't changed
    // This prevents race conditions where two concurrent requests both validate against the same state
    // and both succeed, causing invalid state transitions
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

    // When order is completed, free the table ONLY if no other active orders remain
    // ZALOGA JE ŽE ODBITA ob ustvarjanju naročila — tu samo sprostimo mizo
    if (data.status === 'completed') {
      if (existingOrder.tableId) {
        // FIX: Check for remaining active orders on this table before freeing
        const remainingActive = await db.order.count({
          where: {
            tableId: existingOrder.tableId,
            status: { in: ['pending', 'in-progress', 'ready'] },
            id: { not: id }, // Exclude this order (already completed)
          },
        })
        if (remainingActive === 0) {
          await db.table.update({ where: { id: existingOrder.tableId }, data: { status: 'available' } })
        }
      }
      // Mark all items as served
      await db.orderItem.updateMany({
        where: { orderId: id, status: { in: ['pending', 'preparing', 'ready'] } },
        data: { status: 'served' },
      })

      // FIX MEDIUM: Posodobi statistiko gosta ob zaključku naročila
      // Denormalizirani podatki (totalVisits, totalSpent, itd.) se posodobijo avtomatsko
      if (existingOrder.guestId) {
        try {
          const completedOrders = await db.order.findMany({
            where: { guestId: existingOrder.guestId, status: 'completed', paymentStatus: 'paid' },
            select: { total: true, tip: true, createdAt: true },
          })
          const totalVisits = completedOrders.length
          const totalSpent = completedOrders.reduce((s, o) => s + toNum(o.total), 0)  // FIX: Decimal→number
          const avgCheckAmount = totalVisits > 0 ? totalSpent / totalVisits : 0
          const lastVisitAt = completedOrders.length > 0
            ? completedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt
            : null
          const firstVisitAt = completedOrders.length > 0
            ? completedOrders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0].createdAt
            : null

          await db.guest.update({
            where: { id: existingOrder.guestId },
            data: {
              totalVisits,
              totalSpent: Math.round(totalSpent * 100) / 100,
              avgCheckAmount: Math.round(avgCheckAmount * 100) / 100,
              lastVisitAt,
              firstVisitAt,
            },
          })
        } catch (guestErr: unknown) {
          logger.error('API', 'Napaka pri posodabljanju statistike gosta:', guestErr)
          // Ne prekini glavnega toka
        }
      }

      // Opomba: inventoryDeducted je že true od ustvarjanja naročila
      // Ne razknjižujemo znova!
    }

    // When order is cancelled — VRNI ZALOGO
    if (data.status === 'cancelled') {
      // Webhook: order.cancelled
      emitEvent('order.cancelled', {
        orderId: id,
        orderNumber: existingOrder.orderNumber,
        reason: data.cancelReason || 'Ni razloga',
      }).catch(err => logger.error('API', '[Webhook] order.cancelled napaka:', err))
      // FIX: Race condition — sprosti mizo atomarno
      // After this order is cancelled, count remaining active orders
      // count === 0 means no more active orders → free the table
      if (existingOrder.tableId) {
        await db.$transaction(async (tx) => {
          const count = await tx.order.count({
            where: { tableId: existingOrder.tableId, status: { in: ['pending', 'in-progress', 'ready'] } },
          })
          // This order is already cancelled (updated above), so count excludes it
          // count === 0 means no active orders remain → free table
          if (count === 0) {
            await tx.table.update({ where: { id: existingOrder.tableId! }, data: { status: 'available' } })
          }
        })
      }
      await db.orderItem.updateMany({
        where: { orderId: id, status: { in: ['pending', 'preparing', 'ready'] } },
        data: { status: 'cancelled' },
      })

      // VRNI ZALOGO če je bila razknjižena
      if (existingOrder.inventoryDeducted) {
        const returnResult = await returnStockForOrder(
          id,
          existingOrder.orderNumber,
          data.cancelReason ? `PREKLIČENO: ${data.cancelReason}` : 'PREKLIČENO'
        )

        // Pošlji low-stock opozorila po vračanju (morda je katera sestavina spet pod mejo)
        if (returnResult.lowStockAlerts.length > 0) {
          broadcastLowStockAlert(returnResult.lowStockAlerts)
        }
      }

      // Revizijski dnevnik: preklic naročila
      await createAuditLog({
        userId: authResult.session?.employeeId,
        action: 'CANCEL_ORDER',
        entityType: 'Order',
        entityId: id,
        details: { orderNumber: existingOrder.orderNumber, cancelReason: data.cancelReason, stockReturned: existingOrder.inventoryDeducted },
      })

      broadcastWS('ORDER_CANCELLED', {
        orderId: id,
        orderNumber: existingOrder.orderNumber,
        cancelReason: data.cancelReason || '',
      })
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
        orderId: id,
        orderNumber: existingOrder.orderNumber,
        newStatus: data.status,
      })
    }

    // Re-fetch to get updated items
    const updatedOrder = await db.order.findUnique({
      where: { id },
      include: {
        table: true,
        orderItems: { include: { menuItem: true } },
      },
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

    // FIX: Zahtevaj avtentikacijo tudi za PATCH akcije
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX: Zod validacija za PATCH akcije
    const { data: patchData, error: patchError } = validateBody(orderPatchActionSchema, bodyResult.data)
    if (patchError) return patchError

    // Item status posodobitev — iz KDS zaslona ali natakarjeve tablice
    if (patchData.action === 'item_status') {
      const { itemId, status } = patchData

      const order = await db.order.findUnique({ where: { id } })
      if (!order) return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
      if (order.status === 'cancelled') return NextResponse.json({ error: 'Preklicano naročilo ni mogoče spreminjati' }, { status: 400 })

      // FIX HIGH: Preveri, da OrderItem pripada temu naročilu — prepreči cross-order manipulacijo
      const orderItem = await db.orderItem.findUnique({ where: { id: itemId } })
      if (!orderItem || orderItem.orderId !== id) {
        return NextResponse.json({ error: 'Artikel ne pripada temu naročilu' }, { status: 400 })
      }

      await db.orderItem.update({ where: { id: itemId }, data: { status } })

      const updatedItem = await db.orderItem.findUnique({ where: { id: itemId }, include: { menuItem: { select: { name: true } } } })

      // Preveri ali so vsi itemi ready/served/cancelled
      const allItems = await db.orderItem.findMany({ where: { orderId: id } })
      const allReady = allItems.every(i => ['ready', 'served', 'cancelled'].includes(i.status))
      const allServed = allItems.every(i => ['served', 'cancelled'].includes(i.status))

      // Auto-promote: ko so vsi itemi READY, naročilo postane READY
      if (allReady && order.status !== 'ready' && order.status !== 'completed') {
        await db.order.update({ where: { id }, data: { status: 'ready' } })
      }

      // Auto-promote: ko so vsi itemi SERVED, naročilo je pripravljeno za plačilo
      if (allServed && order.status !== 'completed') {
        await db.order.update({ where: { id }, data: { status: 'ready' } })
      }

      // ─── Broadcast za KDS ───
      broadcastWS('ITEM_STATUS_UPDATE', {
        orderId: id,
        orderNumber: order.orderNumber,
        itemId, status,
      })

      // ─── Obvestilo za natakarja ko je artikel PRIPRAVLJEN ───
      if (status === 'ready' && updatedItem) {
        try {
          const fullOrder = await db.order.findUnique({
            where: { id },
            include: {
              table: true,
              orderItems: { where: { status: 'ready' }, include: { menuItem: { select: { name: true } } } },
            },
          })

          const readyItems = (fullOrder?.orderItems || []).map(i => ({
            name: i.menuItem?.name || 'Artikel',
            quantity: i.quantity,
          }))
          const totalItems = allItems.filter(i => i.status !== 'cancelled').length
          const readyCount = allItems.filter(i => ['ready', 'served'].includes(i.status)).length

          // Pošlji na POS WebSocket kanal
          await fetch(`${getAppUrl()}/api/ws-broadcast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'order_ready',
              channel: 'pos',
              data: {
                orderId: id,
                orderNumber: order.orderNumber,
                tableName: fullOrder?.table?.number?.toString() || null,
                tableNumber: fullOrder?.table?.number || null,
                waiterName: fullOrder?.customerName || null,
                waiterId: fullOrder?.employeeId || null,
                itemName: updatedItem?.menuItem?.name || 'Neznan artikel',
                itemQuantity: updatedItem.quantity,
                allReady,
                readyCount,
                totalItems,
                readyItems,
              },
            }),
          })
        } catch { /* broadcast ni kritičen */ }
      }

      return NextResponse.json({ success: true, allReady, allServed })
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

    // Should not reach here — discriminatedUnion handles all cases
    return NextResponse.json({ error: 'Neznana akcija' }, { status: 400 })
  } catch (error: unknown) {
    return handleApiError(error, 'PATCH /api/orders/[id]', 'Napaka pri posodobitvi')
  }
}

// DELETE — Soft delete: označi naročilo kot preklicano (ne izbriše iz baze!)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // FIX C-05: Zahtevaj avtentikacijo
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

    // Already cancelled orders can't be cancelled again
    if (order.status === 'cancelled') {
      return NextResponse.json({ error: 'Naročilo je že preklicano' }, { status: 400 })
    }

    // Če ima naročilo račun (FURS obveznost), NE smemo izbrisati — samo prekličemo
    if (order.receipt.length > 0) {
      await db.order.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancelReason: 'Izbrisano iz seznama',
          cancelledAt: new Date(),
          cancelledBy: authResult.session?.employeeId || '',
        },
      })
      // FIX: After soft-delete, check remaining active orders before freeing table
      if (order.tableId) {
        await db.$transaction(async (tx) => {
          const activeOrders = await tx.order.count({
            where: { tableId: order.tableId, status: { in: ['pending', 'in-progress', 'ready'] } },
          })
          if (activeOrders === 0) {
            await tx.table.update({ where: { id: order.tableId! }, data: { status: 'available' } })
          }
        })
      }
      broadcastWS('ORDER_CANCELLED', { orderId: id, orderNumber: order.orderNumber, cancelReason: 'Izbrisano iz seznama (z računom)' })
      return NextResponse.json({ success: true, action: 'soft-delete', message: 'Naročilo preklicano' })
    }

    // Naročilo brez računa — prekliči in vrni zalogo
    await db.order.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelReason: 'Izbrisano iz seznama',
        cancelledAt: new Date(),
        cancelledBy: authResult.session?.employeeId || '',
      },
    })

    if (order.tableId) {
      await db.$transaction(async (tx) => {
        const activeOrders = await tx.order.count({
          where: { tableId: order.tableId, status: { in: ['pending', 'in-progress', 'ready'] } },
        })
        if (activeOrders === 0) {
          await tx.table.update({ where: { id: order.tableId! }, data: { status: 'available' } })
        }
      })
    }

    // VRNI ZALOGO
    if (order.inventoryDeducted) {
      await returnStockForOrder(id, order.orderNumber, 'IZBRISANO IZ SEZNAMA (BREZ RAČUNA)')
    }

    broadcastWS('ORDER_CANCELLED', { orderId: id, orderNumber: order.orderNumber, cancelReason: 'Izbrisano iz seznama (brez računa)' })

    return NextResponse.json({ success: true, action: 'soft-delete', message: 'Naročilo preklicano' })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/orders/[id]', 'Napaka pri brisanju naročila')
  }
}
