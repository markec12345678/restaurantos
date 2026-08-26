// GET/POST /api/accounting/accounts-receivable — Terjatve strank (AR)
import { db } from '@/lib/db'
import { deepToNumbers, toNum } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { z } from 'zod'


const createArSchema = z.object({
  customerName: z.string().min(1, 'Ime stranke je obvezno'),
  customerTaxId: z.string().max(50).default(''),
  customerEmail: z.string().max(200).default(''),
  orderId: z.string().nullable().optional(),
  guestId: z.string().nullable().optional(),
  invoiceNumber: z.string().max(100).default(''),
  invoiceDate: z.string().optional(),
  dueDate: z.string().min(1, 'Datum zapadlosti je obvezen'),
  subtotal: z.number().min(0),
  vatAmount: z.number().min(0).default(0),
  totalAmount: z.number().min(0),
  notes: z.string().max(1000).default(''),
})

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const rawLimit = parseInt(searchParams.get('limit') || '100')
    const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 500)

    const [entries, total] = await Promise.all([
      db.accountsReceivable.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        take: limit,
      }),
      db.accountsReceivable.count({ where }),
    ])

    const now = new Date()
    const aging = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 }
    for (const ar of entries) {
      if (ar.status === 'paid') continue
      const daysOverdue = Math.floor((now.getTime() - new Date(ar.dueDate).getTime()) / (1000 * 60 * 60 * 24))
      const outstanding = toNum(ar.totalAmount) - toNum(ar.paidAmount)
      if (daysOverdue < 0) aging.current += outstanding
      else if (daysOverdue <= 30) aging.days30 += outstanding
      else if (daysOverdue <= 60) aging.days60 += outstanding
      else if (daysOverdue <= 90) aging.days90 += outstanding
      else aging.over90 += outstanding
    }

    return NextResponse.json({ entries: deepToNumbers(entries), total, limit, aging })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/accounting/accounts-receivable', 'Napaka pri pridobivanju terjatev')
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const { data, error: validationError } = await validateRequest(req, createArSchema)
    if (validationError) return validationError

    const year = new Date().getFullYear()
    const count = await db.accountsReceivable.count({ where: { arNumber: { startsWith: `AR-${year}-` } } })
    const arNumber = `AR-${year}-${String(count + 1).padStart(6, '0')}`

    const ar = await db.accountsReceivable.create({
      data: {
        arNumber,
        customerName: data.customerName,
        customerTaxId: data.customerTaxId,
        customerEmail: data.customerEmail,
        orderId: data.orderId || null,
        guestId: data.guestId || null,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
        dueDate: new Date(data.dueDate),
        subtotal: data.subtotal,
        vatAmount: data.vatAmount,
        totalAmount: data.totalAmount,
        notes: data.notes,
        status: 'open',
      },
    })

    return NextResponse.json(deepToNumbers(ar), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/accounting/accounts-receivable', 'Napaka pri ustvarjanju terjatve')
  }
}
