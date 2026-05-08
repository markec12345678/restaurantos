import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  // Build update data — only include fields that are present
  const updateData: Record<string, unknown> = {}
  if (body.status !== undefined) updateData.status = body.status
  if (body.paymentStatus !== undefined) updateData.paymentStatus = body.paymentStatus
  if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod
  if (body.notes !== undefined) updateData.notes = body.notes
  if (body.customerName !== undefined) updateData.customerName = body.customerName
  if (body.customerPhone !== undefined) updateData.customerPhone = body.customerPhone
  if (body.discount !== undefined) updateData.discount = body.discount
  if (body.total !== undefined) updateData.total = body.total
  if (body.tip !== undefined) updateData.tip = body.tip
  if (body.totalWithTip !== undefined) updateData.totalWithTip = body.totalWithTip
  if (body.splitCount !== undefined) updateData.splitCount = body.splitCount
  // Preklic/storno metapodatki
  if (body.cancelReason !== undefined) updateData.cancelReason = body.cancelReason
  if (body.cancelledBy !== undefined) updateData.cancelledBy = body.cancelledBy

  // Ko se naročilo prekliče/stornira, zabeleži čas
  if (body.status === 'cancelled') {
    updateData.cancelledAt = new Date()
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
  if (body.status === 'in-progress') {
    await db.orderItem.updateMany({
      where: { orderId: id, status: 'pending' },
      data: { status: 'preparing' },
    })
  }

  // When order is completed, free the table & auto-deduct inventory
  if (body.status === 'completed') {
    if (order.tableId) {
      await db.table.update({ where: { id: order.tableId }, data: { status: 'available' } })
    }
    // Mark all items as served
    await db.orderItem.updateMany({
      where: { orderId: id, status: { in: ['pending', 'preparing', 'ready'] } },
      data: { status: 'served' },
    })

    // Avtomatsko razknjiževanje zalog glede na normativi
    const orderItems = await db.orderItem.findMany({ where: { orderId: id } })
    for (const oi of orderItems) {
      // Poišči inventorizacijski artikel povezan s tem menijem
      const invItem = await db.inventoryItem.findFirst({
        where: { menuItemId: oi.menuItemId },
      })
      if (invItem && invItem.servingsPerUnit > 0) {
        // Izračunaj porabo: količina naročenih × (1 / servingsPerUnit) enot zaloge
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
  }

  // When order is cancelled, free the table if no other active orders
  // Označi tudi vse artikle kot cancelled
  if (body.status === 'cancelled') {
    if (order.tableId) {
      const activeOrders = await db.order.count({
        where: { tableId: order.tableId, status: { in: ['pending', 'in-progress', 'ready'] } },
      })
      if (activeOrders <= 1) {
        await db.table.update({ where: { id: order.tableId }, data: { status: 'available' } })
      }
    }
    // Označi vse artikle kot cancelled
    await db.orderItem.updateMany({
      where: { orderId: id, status: { in: ['pending', 'preparing', 'ready'] } },
      data: { status: 'cancelled' },
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
}

// DELETE — Soft delete: označi naročilo kot preklicano (ne izbriše iz baze!)
// Hard delete je prepovedan za audit sled (FURS zahteva).
// Če naročilo ni bilo plačano in nima računa, ga lahko izbrišemo.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const order = await db.order.findUnique({
    where: { id },
    include: { receipt: true },
  })

  if (!order) {
    return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
  }

  // Če ima naročilo račun (FURS obveznost), NE smemo izbrisati — samo prekličemo
  if (order.receipt.length > 0) {
    // Označi kot preklicano (soft delete)
    await db.order.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelReason: 'Izbrisano iz seznama',
        cancelledAt: new Date(),
      },
    })
    // Sprosti mizo
    if (order.tableId) {
      const activeOrders = await db.order.count({
        where: { tableId: order.tableId, status: { in: ['pending', 'in-progress', 'ready'] } },
      })
      if (activeOrders <= 1) {
        await db.table.update({ where: { id: order.tableId }, data: { status: 'available' } })
      }
    }
    return NextResponse.json({ success: true, action: 'soft-delete', message: 'Naročilo označeno kot preklicano (ima račun)' })
  }

  // Če naročilo nima računa in ni plačano, lahko naredimo hard delete
  // ampak vseeno raje naredimo soft delete za audit sled
  await db.order.update({
    where: { id },
    data: {
      status: 'cancelled',
      cancelReason: 'Izbrisano iz seznama (brez računa)',
      cancelledAt: new Date(),
    },
  })
  // Sprosti mizo
  if (order.tableId) {
    const activeOrders = await db.order.count({
      where: { tableId: order.tableId, status: { in: ['pending', 'in-progress', 'ready'] } },
    })
    if (activeOrders <= 1) {
      await db.table.update({ where: { id: order.tableId }, data: { status: 'available' } })
    }
  }

  return NextResponse.json({ success: true, action: 'soft-delete', message: 'Naročilo preklicano' })
}
