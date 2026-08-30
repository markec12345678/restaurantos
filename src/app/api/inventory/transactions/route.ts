
// GET /api/inventory/transactions — Zgodovina založnih transakcij
// POST /api/inventory/transactions — Ročna transakcija (adjustment/write-off/restock)
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toNum, deepToNumbers, round2, multiply } from '@/lib/decimal'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { z } from 'zod'


export const dynamic = 'force-dynamic'

const createTransactionSchema = z.object({
  inventoryItemId: z.string().min(1, 'ID zaloge je obvezen'),
  type: z.enum(['adjustment', 'write-off', 'restock', 'return'], {
    message: 'Neveljaven tip transakcije',
  }),
  quantity: z.number().refine(v => v !== 0, 'Količina ne sme biti 0'),
  reason: z.string().max(500).default(''),
  note: z.string().max(500).default(''),
})

export async function GET(req: Request) {
  try {
    // Auth check — FIX MEDIUM: Zahtevaj manage_inventory dovoljenje (vsebuje cene in stroške)
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const inventoryItemId = searchParams.get('inventoryItemId')
    const type = searchParams.get('type')
    const fromDate = searchParams.get('from')
    const toDate = searchParams.get('to')
    // FIX: Varno parsanje z NaN fallback
    const rawLimit = parseInt(searchParams.get('limit') || '100')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 500)
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset

    const where: Record<string, unknown> = {}
    if (inventoryItemId) where.inventoryItemId = inventoryItemId
    if (type) where.type = type
    if (fromDate || toDate) {
      const dateFilter: Record<string, unknown> = {}
      if (fromDate) dateFilter.gte = new Date(fromDate)
      if (toDate) dateFilter.lte = new Date(toDate + 'T23:59:59')
      where.createdAt = dateFilter
    }

    const [transactions, total] = await Promise.all([
      db.stockTransaction.findMany({
        where,
        include: {
          inventoryItem: {
            select: { name: true, unit: true, category: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.stockTransaction.count({ where }),
    ])

    // Povzetek po tipih (samo če ni filtrirano po inventoryItemId za boljšo zmogljivost)
    const summary = await db.stockTransaction.groupBy({
      by: ['type'],
      where,
      _sum: { quantity: true, totalCost: true },
      _count: true,
    })

    return NextResponse.json(deepToNumbers({
      transactions,
      total,
      summary: summary.map((s) => ({
        type: s.type,
        count: s._count,
        totalQuantity: toNum(s._sum.quantity),
        totalCost: toNum(s._sum.totalCost),
      })),
    }))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/inventory/transactions', 'Napaka pri pridobivanju transakcij')
  }
}

// POST — Ročna transakcija zaloge (adjustment / write-off / restock / return)
// FIX: Prej ni obstajal (405 Method Not Allowed). Sedaj omogoča ročno
// prilagoditev zaloge z avtomatskim StockTransaction zapisom.
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(createTransactionSchema, bodyResult.data)
    if (validationError) return validationError

    const { inventoryItemId, type, quantity, reason, note } = data

    // Preveri da inventory item obstaja
    const invItem = await db.inventoryItem.findUnique({
      where: { id: inventoryItemId },
    })
    if (!invItem) {
      return NextResponse.json({ error: 'Artikel zaloge ni najden' }, { status: 404 })
    }

    const previousQty = toNum(invItem.quantity)
    const costPerUnit = toNum(invItem.costPerUnit)
    // Za write-off je količina negativna (odštejemo), za restock/return pozitivna
    const signedQty = type === 'write-off' ? -Math.abs(quantity) : Math.abs(quantity)
    const newQty = round2(previousQty + signedQty)

    // Atomna transakcija: posodobi količino + zabeleži transakcijo
    const result = await db.$transaction(async (tx) => {
      const updated = await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: {
          quantity: newQty < 0 ? 0 : newQty,
          ...(signedQty > 0 ? { lastRestocked: new Date() } : {}),
        },
        include: { menuItem: true },
      })

      const transaction = await tx.stockTransaction.create({
        data: {
          inventoryItemId,
          type,
          quantity: signedQty,
          previousQty,
          newQty: newQty < 0 ? 0 : newQty,
          costPerUnit,
          totalCost: round2(multiply(Math.abs(signedQty), costPerUnit)),
          reason: reason || `Ročna transakcija: ${type}`,
          note,
          employeeName: authResult.session?.employeeId || '',
        },
      })

      return { item: updated, transaction }
    })

    return NextResponse.json(deepToNumbers(result), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/inventory/transactions', 'Napaka pri ustvarjanju transakcije')
  }
}
