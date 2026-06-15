import { db } from '@/lib/db'
import { toNum, round2, isPositive, multiply, deepToNumbers } from '@/lib/decimal'

// ============================================
// Inventory API helpers — extracted from route.ts
// ============================================

/** Zgradi filter pogoje iz query parametrov */
export function buildFilterConditions(searchParams: URLSearchParams): {
  where: Record<string, unknown>
  fetchAll: boolean
  limit: number
  offset: number
} {
  const category = searchParams.get('category')
  const location = searchParams.get('location')
  const lowStock = searchParams.get('lowStock')
  const search = searchParams.get('search')

  const rawLimit = parseInt(searchParams.get('limit') || '500')
  const rawOffset = parseInt(searchParams.get('offset') || '0')
  const limit = Math.min(Number.isNaN(rawLimit) ? 500 : rawLimit, 2000)
  const offset = Number.isNaN(rawOffset) ? 0 : rawOffset

  const andConditions: Record<string, unknown>[] = []

  if (category) {
    const categories = category.split(',').map(c => c.trim()).filter(Boolean)
    if (categories.length === 1) {
      andConditions.push({ category: { equals: categories[0] } })
    } else if (categories.length > 1) {
      andConditions.push({ OR: categories.map(c => ({ category: { equals: c } })) })
    }
  }

  if (location) {
    const locations = location.split(',').map(l => l.trim()).filter(Boolean)
    if (locations.length === 1) {
      andConditions.push({ location: { equals: locations[0] } })
    } else if (locations.length > 1) {
      andConditions.push({ OR: locations.map(l => ({ location: { equals: l } })) })
    }
  }

  if (search) {
    andConditions.push({
      OR: [
        { name: { contains: search } },
        { supplier: { contains: search } },
      ]
    })
  }

  const fetchAll = lowStock === 'true'
  const where: Record<string, unknown> = andConditions.length > 1
    ? { AND: andConditions }
    : andConditions.length === 1
      ? andConditions[0]
      : {}

  return { where, fetchAll, limit, offset }
}

/** Pridobi distinktne kategorije ali lokacije */
export async function getDistinctValues(field: 'category' | 'location') {
  const results = await db.inventoryItem.findMany({
    select: { [field]: true },
    distinct: [field],
    orderBy: { [field]: 'asc' },
  })
  return results.map(r => r[field])
}

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

/** Ustvari nov inventarni artikel s transakcijo v $transaction */
export async function createInventoryItem(
  data: {
    name: string; description?: string; unit: string; quantity: number;
    minQuantity: number; costPerUnit: number; supplier?: string;
    category?: string; location?: string; servingsPerUnit: number;
    servingSize?: string; menuItemId?: string;
  },
  employeeId?: string
) {
  const costPerServing = data.servingsPerUnit > 0
    ? Math.round((data.costPerUnit / data.servingsPerUnit) * 100) / 100
    : 0

  const item = await db.$transaction(async (tx) => {
    const created = await tx.inventoryItem.create({
      data: {
        name: data.name,
        description: data.description,
        image: '',
        unit: data.unit,
        quantity: data.quantity,
        minQuantity: data.minQuantity,
        costPerUnit: data.costPerUnit,
        supplier: data.supplier,
        category: data.category,
        location: data.location,
        expiryDate: null,
        servingsPerUnit: data.servingsPerUnit,
        servingSize: data.servingSize,
        costPerServing,
        menuItemId: data.menuItemId || null,
        lastRestocked: new Date(),
      },
      include: { menuItem: true },
    })

    if (isPositive(created.quantity)) {
      await tx.stockTransaction.create({
        data: {
          inventoryItemId: created.id,
          type: 'procurement',
          quantity: toNum(created.quantity),
          previousQty: 0,
          newQty: toNum(created.quantity),
          costPerUnit: created.costPerUnit,
          totalCost: round2(multiply(created.quantity, created.costPerUnit)),
          reason: 'Začetna zaloga',
          employeeName: employeeId || '',
        },
      })
    }

    return created
  })

  return deepToNumbers(item)
}
