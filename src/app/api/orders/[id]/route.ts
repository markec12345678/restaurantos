import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, updateOrderSchema, orderPatchActionSchema } from '@/lib/validations'
import { returnStockForOrder, broadcastLowStockAlert, deductStockForOrder } from '@/lib/stock-deduction'
import { getAppUrl } from '@/lib/utils'

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

    const body = await req.json()

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(updateOrderSchema, body)
    if (validationError) return validationError

    // Pridobi trenutno stanje naročila
    const existingOrder = await db.order.findUnique({
      where: { id },
      include: { orderItems: true },
    })

    if (!existingOrder) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
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

    const order = await db.order.update({
      where: { id },
      data: updateData,
      include: {
        table: true,
        orderItems: { include: { menuItem: true } },
      },
    })

    // When order moves to in-progress, also mark pending items as preparing
    if (data.status === 'in-progress') {
      await db.orderItem.updateMany({
        where: { orderId: id, status: 'pending' },
        data: { status: 'preparing' },
      })
    }

    // When order is completed, free the table
    // ZALOGA JE ŽE ODBITA ob ustvarjanju naročila — tu samo sprostimo mizo
    if (data.status === 'completed') {
      if (order.tableId) {
        await db.table.update({ where: { id: order.tableId }, data: { status: 'available' } })
      }
      // Mark all items as served
      await db.orderItem.updateMany({
        where: { orderId: id, status: { in: ['pending', 'preparing', 'ready'] } },
        data: { status: 'served' },
      })

      // Opomba: inventoryDeducted je že true od ustvarjanja naročila
      // Ne razknjižujemo znova!
    }

    // When order is cancelled — VRNI ZALOGO
    if (data.status === 'cancelled') {
      // FIX HIGH: Race condition — sprosti mizo in vrni zalogo v eni transakciji
      if (order.tableId) {
        const activeOrders = await db.$transaction(async (tx) => {
          const count = await tx.order.count({
            where: { tableId: order.tableId, status: { in: ['pending', 'in-progress', 'ready'] } },
          })
          if (count <= 1) {
            await tx.table.update({ where: { id: order.tableId! }, data: { status: 'available' } })
          }
          return count
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
          order.orderNumber,
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
        details: { orderNumber: order.orderNumber, cancelReason: data.cancelReason, stockReturned: existingOrder.inventoryDeducted },
      })

      broadcastWS('ORDER_CANCELLED', {
        orderId: id,
        orderNumber: order.orderNumber,
        cancelReason: data.cancelReason || '',
      })
    } else if (data.status) {
      // Revizijski dnevnik: sprememba statusa
      await createAuditLog({
        userId: authResult.session?.employeeId,
        action: 'UPDATE_ORDER_STATUS',
        entityType: 'Order',
        entityId: id,
        details: { orderNumber: order.orderNumber, newStatus: data.status },
      })

      broadcastWS('ORDER_UPDATED', {
        orderId: id,
        orderNumber: order.orderNumber,
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

    return NextResponse.json(updatedOrder || order)
  } catch (error) {
    console.error('Napaka pri posodobitvi naročila:', error)
    return NextResponse.json({ error: 'Napaka pri posodobitvi naročila' }, { status: 500 })
  }
}

// ─── PATCH — Item status posodobitve (KDS + Natakar) ───────────
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // FIX: Zahtevaj avtentikacijo tudi za PATCH akcije
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX: Zod validacija za PATCH akcije
    const { data: patchData, error: patchError } = validateBody(orderPatchActionSchema, body)
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
              orderItems: { where: { status: 'ready' } },
            },
          })

          const readyItems = (fullOrder?.orderItems || []).map(i => ({
            name: (i as any).menuItem?.name || 'Artikel',
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
        } catch (e) { /* broadcast ni kritičen */ }
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
      return NextResponse.json(updated)
    }

    // Should not reach here — discriminatedUnion handles all cases
    return NextResponse.json({ error: 'Neznana akcija' }, { status: 400 })
  } catch (error) {
    console.error('PATCH order error:', error)
    return NextResponse.json({ error: 'Napaka pri posodobitvi' }, { status: 500 })
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
      // FIX HIGH: Race condition — sprosti mizo atomarno
      if (order.tableId) {
        await db.$transaction(async (tx) => {
          const activeOrders = await tx.order.count({
            where: { tableId: order.tableId, status: { in: ['pending', 'in-progress', 'ready'] } },
          })
          if (activeOrders <= 1) {
            await tx.table.update({ where: { id: order.tableId! }, data: { status: 'available' } })
          }
        })
      }

      // VRNI ZALOGO
      if (order.inventoryDeducted) {
        await returnStockForOrder(id, order.orderNumber, 'IZBRISANO IZ SEZNAMA')
      }

      broadcastWS('ORDER_CANCELLED', { orderId: id, orderNumber: order.orderNumber, cancelReason: 'Izbrisano iz seznama' })
      return NextResponse.json({ success: true, action: 'soft-delete', message: 'Naročilo označeno kot preklicano (ima račun)' })
    }

    // Soft delete za audit sled
    await db.order.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelReason: 'Izbrisano iz seznama (brez računa)',
        cancelledAt: new Date(),
        cancelledBy: authResult.session?.employeeId || '',
      },
    })
    // FIX HIGH: Race condition — sprosti mizo atomarno
    if (order.tableId) {
      await db.$transaction(async (tx) => {
        const activeOrders = await tx.order.count({
          where: { tableId: order.tableId, status: { in: ['pending', 'in-progress', 'ready'] } },
        })
        if (activeOrders <= 1) {
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
  } catch (error) {
    console.error('Napaka pri brisanju naročila:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju naročila' }, { status: 500 })
  }
}
