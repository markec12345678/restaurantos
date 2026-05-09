import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, updateOrderSchema } from '@/lib/validations'

// Helper za WebSocket broadcast
async function broadcastWS(type: string, payload: unknown) {
  try {
    await fetch('http://localhost:3000/api/ws-broadcast', {
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

    // When order is completed, free the table & auto-deduct inventory
    if (data.status === 'completed') {
      if (order.tableId) {
        await db.table.update({ where: { id: order.tableId }, data: { status: 'available' } })
      }
      // Mark all items as served
      await db.orderItem.updateMany({
        where: { orderId: id, status: { in: ['pending', 'preparing', 'ready'] } },
        data: { status: 'served' },
      })

      // FIX C-03: Preveri inventoryDeducted flag — prepreči dvojno razknjiževanje
      const freshOrder = await db.order.findUnique({ where: { id } })
      if (freshOrder && !freshOrder.inventoryDeducted) {
        // Avtomatsko razknjiževanje zalog glede na normative
        const orderItems = await db.orderItem.findMany({ where: { orderId: id } })
        for (const oi of orderItems) {
          const invItem = await db.inventoryItem.findFirst({
            where: { menuItemId: oi.menuItemId },
          })
          if (invItem && invItem.servingsPerUnit > 0) {
            const unitsPerServing = 1 / invItem.servingsPerUnit
            const totalUnitsToDeduct = Math.round(oi.quantity * unitsPerServing * 10000) / 10000
            const previousQty = invItem.quantity
            const newQty = Math.max(0, Math.round((previousQty - totalUnitsToDeduct) * 10000) / 10000)

            await db.$transaction(async (tx) => {
              await tx.inventoryItem.update({
                where: { id: invItem.id },
                data: { quantity: newQty },
              })
              await tx.stockTransaction.create({
                data: {
                  inventoryItemId: invItem.id,
                  type: 'sale',
                  quantity: -totalUnitsToDeduct,
                  previousQty,
                  newQty,
                  costPerUnit: invItem.costPerUnit,
                  totalCost: totalUnitsToDeduct * invItem.costPerUnit,
                  reason: `Prodaja - naročilo #${order.orderNumber}`,
                  orderId: id,
                },
              })
            })
          }
        }

        await db.order.update({
          where: { id },
          data: { inventoryDeducted: true },
        })
      }
    }

    // When order is cancelled
    if (data.status === 'cancelled') {
      if (order.tableId) {
        const activeOrders = await db.order.count({
          where: { tableId: order.tableId, status: { in: ['pending', 'in-progress', 'ready'] } },
        })
        if (activeOrders <= 1) {
          await db.table.update({ where: { id: order.tableId }, data: { status: 'available' } })
        }
      }
      await db.orderItem.updateMany({
        where: { orderId: id, status: { in: ['pending', 'preparing', 'ready'] } },
        data: { status: 'cancelled' },
      })

      // Revizijski dnevnik: preklic naročila
      await createAuditLog({
        userId: authResult.session?.employeeId,
        action: 'CANCEL_ORDER',
        entityType: 'Order',
        entityId: id,
        details: { orderNumber: order.orderNumber, cancelReason: data.cancelReason },
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
      if (order.tableId) {
        const activeOrders = await db.order.count({
          where: { tableId: order.tableId, status: { in: ['pending', 'in-progress', 'ready'] } },
        })
        if (activeOrders <= 1) {
          await db.table.update({ where: { id: order.tableId }, data: { status: 'available' } })
        }
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
    if (order.tableId) {
      const activeOrders = await db.order.count({
        where: { tableId: order.tableId, status: { in: ['pending', 'in-progress', 'ready'] } },
      })
      if (activeOrders <= 1) {
        await db.table.update({ where: { id: order.tableId }, data: { status: 'available' } })
      }
    }
    broadcastWS('ORDER_CANCELLED', { orderId: id, orderNumber: order.orderNumber, cancelReason: 'Izbrisano iz seznama (brez računa)' })

    return NextResponse.json({ success: true, action: 'soft-delete', message: 'Naročilo preklicano' })
  } catch (error) {
    console.error('Napaka pri brisanju naročila:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju naročila' }, { status: 500 })
  }
}
