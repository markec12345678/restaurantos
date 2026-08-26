import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'

// ============================================
// Inventory API helpers — get items with metadata
// ============================================

/** Pridobi artikle s transakcijskimi metapodatki */
export async function getItemsWithMeta(
  where: Record<string, unknown>,
  fetchAll: boolean,
  limit: number,
  offset: number,
  lowStock: string | null
) {
  const items = await db.inventoryItem.findMany({
    where,
    orderBy: { name: 'asc' },
    take: fetchAll ? 5000 : limit,
    skip: fetchAll ? undefined : offset,
    include: {
      menuItem: { select: { id: true, name: true, price: true } },
    },
  })

  let result = items
  let totalForPagination: number | undefined = undefined
  if (lowStock === 'true') {
    const { greaterThan } = await import('@/lib/decimal')
    const filtered = items.filter((item) => !greaterThan(item.quantity, item.minQuantity))
    totalForPagination = filtered.length
    result = filtered.slice(offset, offset + limit)
  }

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

  const response: Record<string, unknown> = { items: itemsWithMeta }
  if (totalForPagination !== undefined) {
    response.total = totalForPagination
    response.limit = limit
    response.offset = offset
  }

  return deepToNumbers(response)
}
