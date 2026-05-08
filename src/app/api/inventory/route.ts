import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const lowStock = searchParams.get('lowStock')

  const where: Record<string, unknown> = {}
  if (category) where.category = category

  const items = await db.inventoryItem.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      menuItem: { select: { id: true, name: true, price: true } },
    },
  })

  // Filter low stock items in memory (avoids complex SQL comparison)
  let result = items
  if (lowStock === 'true') {
    result = items.filter((item) => item.quantity <= item.minQuantity)
  }

  // Pridobi zadnje transakcije za vse artikle naenkrat (brez N+1)
  const itemIds = result.map((item) => item.id)

  const [txCounts, lastTransactions] = await Promise.all([
    db.stockTransaction.groupBy({
      by: ['inventoryItemId'],
      where: { inventoryItemId: { in: itemIds } },
      _count: true,
    }),
    db.stockTransaction.findMany({
      where: { inventoryItemId: { in: itemIds } },
      orderBy: { createdAt: 'desc' },
      distinct: ['inventoryItemId'],
      select: { inventoryItemId: true, createdAt: true, type: true },
    }),
  ])

  const countMap = new Map(txCounts.map((t) => [t.inventoryItemId, t._count]))
  const lastTxMap = new Map(lastTransactions.map((t) => [t.inventoryItemId, t]))

  const itemsWithMeta = result.map((item) => ({
    ...item,
    _txCount: countMap.get(item.id) || 0,
    _lastTransaction: lastTxMap.get(item.id) || null,
  }))

  return NextResponse.json(itemsWithMeta)
}

export async function POST(req: Request) {
  const body = await req.json()

  const costPerUnit = body.costPerUnit || 0
  const servingsPerUnit = body.servingsPerUnit || 1
  const costPerServing = servingsPerUnit > 0 ? Math.round((costPerUnit / servingsPerUnit) * 100) / 100 : 0

  const item = await db.inventoryItem.create({
    data: {
      name: body.name,
      unit: body.unit || 'pcs',
      quantity: body.quantity || 0,
      minQuantity: body.minQuantity || 10,
      costPerUnit,
      supplier: body.supplier || '',
      category: body.category || 'general',
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      servingsPerUnit,
      servingSize: body.servingSize || '',
      costPerServing,
      menuItemId: body.menuItemId || null,
      lastRestocked: new Date(),
    },
    include: { menuItem: true },
  })

  // Ustvari začetno transakcijo če je količina > 0
  if (item.quantity > 0) {
    await db.stockTransaction.create({
      data: {
        inventoryItemId: item.id,
        type: 'procurement',
        quantity: item.quantity,
        previousQty: 0,
        newQty: item.quantity,
        costPerUnit: item.costPerUnit,
        totalCost: item.quantity * item.costPerUnit,
        reason: 'Začetna zaloga',
      },
    })
  }

  return NextResponse.json(item)
}
