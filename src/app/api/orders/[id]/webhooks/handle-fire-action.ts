// Fire akcija — pošlji naročilo v kuhinjo

import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { broadcastWSEvent } from '@/lib/websocket-client'

export async function handleFireAction(id: string) {
  const now = new Date()

  // FIX WORKFLOW-9: Zapiši firedAt na Order (KDS timer + waiter elapsed display)
  await db.order.update({
    where: { id },
    data: { status: 'in-progress', firedAt: now },
  })

  // Vsi pending items preidejo v 'preparing' in dobijo firedAt
  await db.orderItem.updateMany({
    where: { orderId: id, status: 'pending' },
    data: { status: 'preparing', firedAt: now },
  })

  const order = await db.order.findUnique({ where: { id } })
  broadcastWSEvent('ORDER_FIRED', {
    orderId: id,
    orderNumber: order?.orderNumber,
    firedAt: now.toISOString(),
  })

  const updated = await db.order.findUnique({
    where: { id },
    include: {
      table: true,
      employee: { select: { id: true, name: true } },
      orderItems: {
        include: {
          menuItem: {
            include: {
              prepStation: true,
              category: { include: { menu: true } },
            },
          },
        },
      },
    },
  })
  return NextResponse.json(deepToNumbers(updated))
}
