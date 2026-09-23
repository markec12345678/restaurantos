// Fire akcija — pošlji naročilo v kuhinjo

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { broadcastWSEvent } from '@/lib/websocket-client'
import { getNextCounter } from '@/lib/counters'
import { logger } from '@/lib/logger'

// FIX R112-A (ORD-1, HIGH — TOCTOU razred iz R100–R111): fire je bil
// NEPOGOJEN update — klic na 'cancelled' ALI 'completed' (plačano,
// fiskalizirano) naročilo ga je OŽIVIL v KDS ('in-progress') in premaknil
// artikle nazaj v 'preparing' (kuhinja kuha jed, ki ne obstaja več).
// Sedaj CAS žig: dovoljeni izvorni statusi so 'pending' (prvi fire),
// 'in-progress' / 'ready' (re-fire po add-items); plačano naročilo
// (paymentStatus 'paid') je VEDNO zavrnjeno.
const FIRE_ALLOWED_STATUSES = ['pending', 'in-progress', 'ready']

export async function handleFireAction(id: string) {
  const now = new Date()

  // FIX WORKFLOW-9 + R112: CAS žig — count 0 → naročilo je v medčasom
  // preklicano / zaključeno / plačano → strukturiran 409 (NI oživljanja).
  const fireClaim = await db.order.updateMany({
    where: { id, status: { in: FIRE_ALLOWED_STATUSES }, paymentStatus: { not: 'paid' } },
    data: { status: 'in-progress', firedAt: now },
  })
  if (fireClaim.count === 0) {
    return NextResponse.json(
      { error: 'Fire ni mogoč — naročilo je preklicano, zaključeno ali plačano' },
      { status: 409 },
    )
  }

  // Vsi pending items preidejo v 'preparing' in dobijo firedAt
  // (R112: voided izrecno izključen — obramba v globino ob kondicionalu)
  await db.orderItem.updateMany({
    where: { orderId: id, status: 'pending', voided: false },
    data: { status: 'preparing', firedAt: now },
  })

  // FIX AUD-11 + R112-A (ORD-2, MEDIUM): avtomatski KOT ob fire je bil
  // check-then-act IZVEN transakcije (read → counter → create) — dva
  // vzporedna fire-a (ali fire ∥ POST /api/kot) sta ustvarila DVA
  // 'original' KOT-a za isti order. Sedaj: advisory lock 'kot-fire:{orderId}'
  // + tx-fresh dedup (obstoječ original → preskoči kreacijo). KOT ostane
  // best-effort: napaka ne odpoveduje fire-a (isti kontrakt kot prej).
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`kot-fire:${id}`}))`

      const existingOriginal = await tx.kotDocument.findFirst({
        where: { orderId: id, type: 'original' },
        select: { id: true },
      })
      if (existingOriginal) return

      const order = await tx.order.findUnique({
        where: { id },
        include: {
          table: { select: { number: true } },
          orderItems: { include: { menuItem: { select: { name: true, prepStation: { select: { name: true, type: true } } } } } },
        },
      })
      if (!order) return

      const kotNumber = await getNextCounter('kotNumber', tx)
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
      await (tx.kotDocument as any).create({
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
    })
  } catch (err: unknown) {
    // R112: P2034 (Serializable konflikt)/P2002 = izgubljena KOT dedup tekma
    // → tiho preskoči (duplicate KOT NE sme biti ustvarjen); ostalo = isto
    // kot prej (warn, fire ostane uspešen).
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === 'P2034' || err.code === 'P2002')) {
      logger.warn('KOT', `KOT dedup konflikt ob fire naročila ${id} — kreacija preskočena`)
    } else {
      logger.warn('KOT', 'Napaka pri avtomatskem KOT kreiranju:', err instanceof Error ? err.message : err)
    }
  }

  const orderForBroadcast = await db.order.findUnique({ where: { id } })
  broadcastWSEvent('ORDER_FIRED', {
    orderId: id,
    orderNumber: orderForBroadcast?.orderNumber,
    // FIX MULTI-TENANT: locationId za per-location WS filtriranje (KDS ne vidi tujih lokacij)
    locationId: orderForBroadcast?.locationId ?? null,
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
