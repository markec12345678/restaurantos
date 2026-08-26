import { db } from '@/lib/db'

// ============================================
// Inventory API helpers — filter conditions
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
