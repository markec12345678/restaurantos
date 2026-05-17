import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getNextCounter } from '@/lib/counters'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createCheckSchema } from '@/lib/validations'

export async function GET(req: Request) {
  try {
    // FIX: Zahtevaj avtentikacijo za branje čekov
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    const paymentStatus = searchParams.get('paymentStatus')

    const where: Record<string, unknown> = {}
    if (orderId) where.orderId = orderId
    if (paymentStatus) where.paymentStatus = paymentStatus

    // FIX HIGH: Paginacija za čeke — prepreči nalaganje tisočih zapisov
    const rawLimit = parseInt(searchParams.get('limit') || '100')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 500)
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset

    const [checks, total] = await Promise.all([
      db.check.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          order: { select: { id: true, orderNumber: true, customerName: true } },
          orderItems: { include: { menuItem: { select: { id: true, name: true } } } },
          payments: true,
          appliedDiscount: true,
        },
      }),
      db.check.count({ where }),
    ])

    return NextResponse.json({ checks, total, limit, offset })
  } catch (error) {
    console.error('Napaka pri pridobivanju čekov:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju čekov' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(createCheckSchema, body)
    if (validationError) return validationError

    // Preveri, da order obstaja
    const order = await db.order.findUnique({
      where: { id: data.orderId },
      include: { orderItems: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    }

    // FIX H-02: Poveži OrderItems s Check-om in izračunaj zneske strežniško
    const checkNumber = await getNextCounter('checkNumber')

    // Določi katere OrderItem-e vključimo v ta ček
    let checkOrderItems = order.orderItems
    if (data.orderItemIds && data.orderItemIds.length > 0) {
      checkOrderItems = order.orderItems.filter(oi => data.orderItemIds!.includes(oi.id))
    }

    // FIX MEDIUM: Izključi voidane artikle iz izračuna čeka
    checkOrderItems = checkOrderItems.filter(oi => !oi.voided)

    if (checkOrderItems.length === 0) {
      return NextResponse.json({ error: 'Ček mora vsebovati vsaj en artikel' }, { status: 400 })
    }

    // FIX H-08: Strežniški izračun zneskov iz dejanskih OrderItem-ov
    let subtotal = 0
    let tax = 0
    for (const oi of checkOrderItems) {
      const itemBase = oi.price * oi.quantity
      const itemVat = oi.vatAmount || (itemBase * (oi.vatRate / 100))
      subtotal += itemBase
      tax += itemVat
    }

    // FIX H-03: Popust ne more preseči vmesne vsote
    // FIX BUG: Preveri veljavnost popusta OUTSIDE tx (za hitro zavrnitev),
    // vendar NE povečuj currentUses tukaj — to naredi SAMO znotraj $transaction!
    let discount = 0
    let discountIdForTx: string | null = null
    if (data.appliedDiscountId) {
      const discountObj = await db.discount.findUnique({ where: { id: data.appliedDiscountId } })
      if (discountObj) {
        // FIX MEDIUM: Preveri, da je popust aktiven in v veljavnem obdobju
        if (!discountObj.isActive) {
          return NextResponse.json({ error: 'Popust ni aktiven' }, { status: 400 })
        }
        const now = new Date()
        if (discountObj.validFrom && now < discountObj.validFrom) {
          return NextResponse.json({ error: 'Popust še ni veljaven' }, { status: 400 })
        }
        if (discountObj.validTo && now > discountObj.validTo) {
          return NextResponse.json({ error: 'Popust je potekel' }, { status: 400 })
        }
        if (discountObj.maxUses !== null && discountObj.currentUses >= discountObj.maxUses) {
          return NextResponse.json({ error: 'Popust je že bil uporabljen največkrat' }, { status: 400 })
        }

        if (discountObj.type === 'percentage') {
          discount = subtotal * (discountObj.amount / 100)
        } else if (discountObj.type === 'fixed_amount') {
          discount = discountObj.amount
        }
        discount = Math.min(discount, subtotal)
        discountIdForTx = discountObj.id

        // Popust currentUses se posodobi SAMO znotraj $transaction spodaj — prepreči double increment
      }
    }

    const total = subtotal + tax - discount

    // FIX: Ustvari ček IN poveži OrderItem-e v eni transakciji — prepreči delno stanje
    const check = await db.$transaction(async (tx) => {
      // Atomarna posodobitev popusta: prepreči race condition na maxUses
      // FIX BUG: Uporabi discountIdForTx (nastavljen zunaj tx) namesto data.appliedDiscountId
      // da se izognemo double increment — preverjanje je bilo že narejeno zunaj tx
      if (discountIdForTx) {
        const discountObj = await tx.discount.findUnique({ where: { id: discountIdForTx } })
        if (discountObj) {
          if (discountObj.maxUses !== null) {
            const updated = await tx.discount.updateMany({
              where: { id: discountObj.id, currentUses: { lt: discountObj.maxUses } },
              data: { currentUses: { increment: 1 } },
            })
            if (updated.count === 0) {
              throw new Error('Popust je že bil uporabljen največkrat')
            }
          } else {
            await tx.discount.update({
              where: { id: discountObj.id },
              data: { currentUses: { increment: 1 } },
            })
          }
        }
      }

      const newCheck = await tx.check.create({
        data: {
          checkNumber,
          orderId: data.orderId,
          subtotal,
          tax,
          discount,
          serviceCharge: 0,
          total,
          tip: 0,
          totalWithTip: total,
          paymentStatus: 'unpaid',
          paymentMethod: '',
          appliedDiscountId: data.appliedDiscountId || null,
        },
      })

      // Poveži OrderItem-e s tem Check-om
      if (data.orderItemIds && data.orderItemIds.length > 0) {
        await tx.orderItem.updateMany({
          where: { id: { in: data.orderItemIds } },
          data: { checkId: newCheck.id },
        })
      } else {
        // Poveži vse nepovezane OrderItem-e tega naročila
        const unassignedItems = order.orderItems.filter(oi => !oi.checkId)
        if (unassignedItems.length > 0) {
          await tx.orderItem.updateMany({
            where: { id: { in: unassignedItems.map(oi => oi.id) } },
            data: { checkId: newCheck.id },
          })
        }
      }

      return newCheck
    })

    // Re-fetch z posodobljenimi relacijami
    const checkWithItems = await db.check.findUnique({
      where: { id: check.id },
      include: {
        order: true,
        orderItems: true,
        payments: true,
        appliedDiscount: true,
      },
    })

    return NextResponse.json(checkWithItems, { status: 201 })
  } catch (error) {
    console.error('Napaka pri ustvarjanju čeka:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju čeka' }, { status: 500 })
  }
}
