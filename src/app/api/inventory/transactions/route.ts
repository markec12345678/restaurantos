
// GET /api/inventory/transactions — Zgodovina založnih transakcij
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toNum, deepToNumbers } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'


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
