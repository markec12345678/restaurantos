
// =====================================================================
// SUBSCRIPTION INVOICES API — Računi za SaaS naročnino
// =====================================================================

// Shema za ustvarjanje računa
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getNextCounter } from '@/lib/counters'
import { toNum, round2, multiply, add, deepToNumbers } from '@/lib/decimal'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'

const createInvoiceSchema = z.object({
  subscriptionId: z.string().min(1, 'ID naročnine je obvezen').max(100, 'ID naročnine je predolg'),
  periodStart: z.string().min(1, 'Začetek obdobja je obvezen').max(30, 'Neveljaven format datuma'),
  periodEnd: z.string().min(1, 'Konec obdobja je obvezen').max(30, 'Neveljaven format datuma'),
})

// Shema za posodobitev statusa računa
const updateInvoiceSchema = z.object({
  id: z.string().min(1, 'ID računa je obvezen').max(100, 'ID računa je predolg'),
  status: z.enum(['paid', 'overdue', 'cancelled'], { message: 'Neveljaven status računa' }),
})

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

    return NextResponse.json({ invoices: deepToNumbers(invoices) })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/subscription/invoices', 'Napaka pri pridobivanju računov')
  }
}

// POST /api/subscription/invoices — Generiraj nov račun
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const result = await validateRequest(req, createInvoiceSchema)
    if (result.error) return result.error

    const data = result.data
    const subscription = await db.subscription.findUnique({
      where: { id: data.subscriptionId },
    })

    if (!subscription) {
      return NextResponse.json({ error: 'Naročnina ni najdena' }, { status: 404 })
    }

    // FIX CRITICAL: Uporabi atomski counter namesto count+1 — race condition
    // Prej: dve hkratni ustvarjanji računa sta dobili isto številko
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    const seq = await getNextCounter('invoiceNumber')
    const invoiceNumber = `NAR-${year}${month}-${String(seq).padStart(4, '0')}`

    const amount = toNum(subscription.monthlyPrice)
    const vatRate = 22
    const vatAmount = round2(multiply(amount, vatRate / 100))
    const totalAmount = round2(add(amount, vatAmount))

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

    return NextResponse.json(deepToNumbers(invoice), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/subscription/invoices', 'Napaka pri ustvarjanju računa')
  }
}

// PATCH /api/subscription/invoices — Označi račun kot plačan
export async function PATCH(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const result = await validateRequest(req, updateInvoiceSchema)
    if (result.error) return result.error

    const data = result.data
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

    return NextResponse.json(deepToNumbers(invoice))
  } catch (error: unknown) {
    return handleApiError(error, 'PATCH /api/subscription/invoices', 'Napaka pri posodabljanju računa')
  }
}
