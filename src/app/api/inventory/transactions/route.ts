import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/inventory/transactions — Zgodovina založnih transakcij
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const inventoryItemId = searchParams.get('inventoryItemId')
    const type = searchParams.get('type')
    const fromDate = searchParams.get('from')
    const toDate = searchParams.get('to')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
    const offset = parseInt(searchParams.get('offset') || '0')

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

    return NextResponse.json({
      transactions,
      total,
      summary: summary.map((s) => ({
        type: s.type,
        count: s._count,
        totalQuantity: s._sum.quantity || 0,
        totalCost: s._sum.totalCost || 0,
      })),
    })
  } catch (error) {
    console.error('Transactions error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju transakcij' }, { status: 500 })
  }
}
