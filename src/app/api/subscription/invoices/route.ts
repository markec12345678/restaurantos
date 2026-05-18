import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

// =====================================================================
// SUBSCRIPTION INVOICES API — Računi za SaaS naročnino
// =====================================================================

// GET /api/subscription/invoices — Seznam računov
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const subscriptionId = searchParams.get('subscriptionId')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (subscriptionId) where.subscriptionId = subscriptionId
    if (status) where.status = status

    const invoices = await db.subscriptionInvoice.findMany({
      where,
      include: { subscription: { select: { companyName: true, email: true, plan: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ invoices })
  } catch (error) {
    console.error('Invoices GET error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju računov' }, { status: 500 })
  }
}

// POST /api/subscription/invoices — Generiraj nov račun
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json()
    const schema = z.object({
      subscriptionId: z.string().min(1),
      periodStart: z.string(),
      periodEnd: z.string(),
    })

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })
    }

    const data = parsed.data
    const subscription = await db.subscription.findUnique({
      where: { id: data.subscriptionId },
    })

    if (!subscription) {
      return NextResponse.json({ error: 'Naročnina ni najdena' }, { status: 404 })
    }

    // Generiraj številko računa
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    const count = await db.subscriptionInvoice.count()
    const invoiceNumber = `NAR-${year}${month}-${String(count + 1).padStart(4, '0')}`

    const amount = subscription.monthlyPrice
    const vatRate = 22
    const vatAmount = Math.round(amount * vatRate / 100 * 100) / 100
    const totalAmount = Math.round((amount + vatAmount) * 100) / 100

    const periodStart = new Date(data.periodStart)
    const periodEnd = new Date(data.periodEnd)
    const dueDate = new Date(periodStart)
    dueDate.setDate(dueDate.getDate() + 15) // 15 dni plačilna roka

    const invoice = await db.subscriptionInvoice.create({
      data: {
        subscriptionId: subscription.id,
        invoiceNumber,
        amount,
        vatRate,
        vatAmount,
        totalAmount,
        currency: subscription.currency,
        periodStart,
        periodEnd,
        dueDate,
      },
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error('Invoice POST error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju računa' }, { status: 500 })
  }
}

// PATCH /api/subscription/invoices — Označi račun kot plačan
export async function PATCH(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json()
    const schema = z.object({
      id: z.string().min(1),
      status: z.enum(['paid', 'overdue', 'cancelled']),
    })

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })
    }

    const data = parsed.data
    const updateData: Record<string, unknown> = { status: data.status }
    if (data.status === 'paid') updateData.paidAt = new Date()

    const invoice = await db.subscriptionInvoice.update({
      where: { id: data.id },
      data: updateData,
    })

    // Če je plačan, aktiviraj naročnino
    if (data.status === 'paid') {
      const sub = await db.subscription.findUnique({ where: { id: invoice.subscriptionId } })
      if (sub && sub.status === 'trial') {
        await db.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'active',
            currentPeriodStart: invoice.periodStart,
            currentPeriodEnd: invoice.periodEnd,
          },
        })
      }
    }

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Invoice PATCH error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju računa' }, { status: 500 })
  }
}
