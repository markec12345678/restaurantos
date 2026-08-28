// GET/POST /api/accounting/accounts-receivable — Terjatve strank (AR)
import { db } from '@/lib/db'
import { deepToNumbers, toNum } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
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
  // ISSUE #31: multi-tenant AR — opcijsko poveži z lokacijo
  locationId: z.string().nullable().optional(),
})

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    // ISSUE #31: opcijsko filtriranje po lokaciji za multi-tenant accounting
    const locationId = searchParams.get('locationId')
    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (locationId) where.locationId = locationId

    const rawLimit = parseInt(searchParams.get('limit') || '100')
    const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 500)

    const [entries, total] = await Promise.all([
      db.accountsReceivable.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        take: limit,
        // ISSUE #31: vključi lokacijo v odgovor
        include: { location: { select: { id: true, name: true, code: true } } },
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
    // FIX CRITICAL (race): Atomsko generiraj arNumber z db.counter.upsert.
    const counterName = `arNumber-${year}`
    let arNumber: string
    try {
      const counter = await db.counter.upsert({
        where: { name: counterName },
        update: { value: { increment: 1 } },
        create: { name: counterName, value: 1 },
      })
      arNumber = `AR-${year}-${String(counter.value).padStart(6, '0')}`
    } catch (counterErr: unknown) {
      logger.error('API', '[AR] Counter upsert failed:', counterErr)
      return NextResponse.json({ error: 'Napaka pri generiranju številke terjatve. Poskusite znova.' }, { status: 503 })
    }

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
        // ISSUE #31: shrani locationId če je podan
        locationId: data.locationId || null,
      },
      include: { location: { select: { id: true, name: true, code: true } } },
    })

    return NextResponse.json(deepToNumbers(ar), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/accounting/accounts-receivable', 'Napaka pri ustvarjanju terjatve')
  }
}
