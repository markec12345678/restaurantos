// Fire akcija — pošlji naročilo v kuhinjo

import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { broadcastWS } from '../_helpers'

export async function handleFireAction(id: string) {
  await db.order.update({ where: { id }, data: { status: 'in-progress' } })
  await db.orderItem.updateMany({ where: { orderId: id, status: 'pending' }, data: { status: 'fired' } })

  const order = await db.order.findUnique({ where: { id } })
  broadcastWS('ORDER_FIRED', {
    orderId: id,
    orderNumber: order?.orderNumber,
  })

  const updated = await db.order.findUnique({
    where: { id },
    include: { table: true, orderItems: { include: { menuItem: true } } },
  })
  return NextResponse.json(deepToNumbers(updated))
}
