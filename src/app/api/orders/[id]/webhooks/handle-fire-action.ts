// Fire akcija — pošlji naročilo v kuhinjo

import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { broadcastWSEvent } from '@/lib/websocket-client'
import { getNextCounter } from '@/lib/counters'
import { logger } from '@/lib/logger'

export async function handleFireAction(id: string) {
  const now = new Date()

  // FIX WORKFLOW-9: Zapiši firedAt na Order (KDS timer + waiter elapsed display)
  await db.order.update({
    where: { id },
    data: { status: 'in-progress', firedAt: now },
  })

  // Vsi pending items preidejo v 'preparing' in dobijo firedAt
  const updatedItems = await db.orderItem.updateMany({
    where: { orderId: id, status: 'pending' },
    data: { status: 'preparing', firedAt: now },
  })

  // FIX AUD-11: Avtomatsko ustvari KOT dokument ob fire (URY Mosaic-style)
  try {
    const order = await db.order.findUnique({
      where: { id },
      include: {
        table: { select: { number: true } },
        orderItems: { include: { menuItem: { select: { name: true, prepStation: { select: { name: true, type: true } } } } } },
      },
    })
    if (order) {
      const kotNumber = await getNextCounter('kotNumber')
      const itemsJson = JSON.stringify(
        order.orderItems
          .filter(i => !i.voided)
          .map(i => ({
            name: i.menuItem?.name || i.menuItemName || 'Neznan artikel',
            qty: i.quantity,
            notes: i.notes || '',
            station: i.menuItem?.prepStation?.name || 'kuhinja',
          }))
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db.kotDocument as any).create({
        data: {
          kotNumber,
          orderId: id,
          type: 'original',
          itemsJson,
          orderNotes: order.notes || '',
          tableNumber: order.table?.number || null,
          orderType: order.type,
          status: 'pending',
          firedAt: now,
          employeeId: order.employeeId,
        },
      })
      logger.info('KOT', `Avtomatsko ustvarjen KOT #${kotNumber} za naročilo #${order.orderNumber}`)
    }
  } catch (err: unknown) {
    logger.warn('KOT', 'Napaka pri avtomatskem KOT kreiranju:', err instanceof Error ? err.message : err)
  }

  const orderForBroadcast = await db.order.findUnique({ where: { id } })
  broadcastWSEvent('ORDER_FIRED', {
    orderId: id,
    orderNumber: orderForBroadcast?.orderNumber,
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
