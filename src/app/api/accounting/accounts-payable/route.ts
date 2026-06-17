// GET/POST /api/accounting/accounts-payable — Obveznosti dobaviteljem (AP)
import { db } from '@/lib/db'
import { deepToNumbers, toNum } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { z } from 'zod'

const createApSchema = z.object({
  supplierId: z.string().min(1),
  purchaseOrderId: z.string().nullable().optional(),
  invoiceNumber: z.string().max(100).default(''),
  invoiceDate: z.string().optional(),
  dueDate: z.string().min(1, 'Datum zapadlosti je obvezen'),
  subtotal: z.number().min(0),
  vatAmount: z.number().min(0).default(0),
  totalAmount: z.number().min(0),
  notes: z.string().max(1000).default(''),
})

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const supplierId = searchParams.get('supplierId')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (supplierId) where.supplierId = supplierId
    if (status) where.status = status

    const rawLimit = parseInt(searchParams.get('limit') || '100')
    const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 500)

    const [entries, total] = await Promise.all([
      db.accountsPayable.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        take: limit,
        include: { supplier: { select: { id: true, name: true, code: true } } },
      }),
      db.accountsPayable.count({ where }),
    ])

    // Aging buckets: 0-30, 31-60, 61-90, 90+ days
    const now = new Date()
    const aging = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 }
    for (const ap of entries) {
      if (ap.status === 'paid') continue
      const daysOverdue = Math.floor((now.getTime() - new Date(ap.dueDate).getTime()) / (1000 * 60 * 60 * 24))
      const outstanding = toNum(ap.totalAmount) - toNum(ap.paidAmount)
      if (daysOverdue < 0) aging.current += outstanding
      else if (daysOverdue <= 30) aging.days30 += outstanding
      else if (daysOverdue <= 60) aging.days60 += outstanding
      else if (daysOverdue <= 90) aging.days90 += outstanding
      else aging.over90 += outstanding
    }

    return NextResponse.json({ entries: deepToNumbers(entries), total, limit, aging })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/accounting/accounts-payable', 'Napaka pri pridobivanju obveznosti')
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const { data, error: validationError } = await validateRequest(req, createApSchema)
    if (validationError) return validationError

    const year = new Date().getFullYear()
    const count = await db.accountsPayable.count({ where: { apNumber: { startsWith: `AP-${year}-` } } })
    const apNumber = `AP-${year}-${String(count + 1).padStart(6, '0')}`

    const ap = await db.accountsPayable.create({
      data: {
        apNumber,
        supplierId: data.supplierId,
        purchaseOrderId: data.purchaseOrderId || null,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
        dueDate: new Date(data.dueDate),
        subtotal: data.subtotal,
        vatAmount: data.vatAmount,
        totalAmount: data.totalAmount,
        notes: data.notes,
        status: 'open',
      },
      include: { supplier: { select: { name: true } } },
    })

    return NextResponse.json(deepToNumbers(ap), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/accounting/accounts-payable', 'Napaka pri ustvarjanju obveznosti')
  }
}
