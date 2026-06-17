// Pomožne funkcije za Location Sync API — Menu primerjava med lokacijami

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// ─── GET: Menu primerjava med lokacijami ────────────────────

export async function fetchMenuComparison(locationIds: string[]) {
  // OPTIMIZACIJA N+1: Ena sama poizvedba za štetje menijev, kategorij in artiklov
  const menuCountsByLocation = locationIds.length > 0
    ? await db.$queryRaw<
        Array<{
          locationId: string
          menuCount: bigint
          categoryCount: bigint
          itemCount: bigint
        }>
      >`
        SELECT
          m.locationId,
          COUNT(DISTINCT m.id) as menuCount,
          COUNT(DISTINCT c.id) as categoryCount,
          COUNT(DISTINCT CASE WHEN mi.isAvailable = true THEN mi.id END) as itemCount
        FROM "Menu" m
        LEFT JOIN "Category" c ON c.menuId = m.id
        LEFT JOIN "MenuItem" mi ON mi.categoryId = c.id
        WHERE m.locationId IN (${Prisma.join(locationIds)})
        GROUP BY m.locationId
      `
    : []

  // Pretvori rezultate v Map za O(1) dostop po locationId
  const countMap = new Map<string, { menuCount: number; categoryCount: number; itemCount: number }>()
  for (const row of menuCountsByLocation) {
    countMap.set(row.locationId, {
      menuCount: Number(row.menuCount),
      categoryCount: Number(row.categoryCount),
      itemCount: Number(row.itemCount),
    })
  }

  return countMap
}

export function buildMenuComparison(
  locations: ReadonlyArray<{ id: string; name: string; code: string | null }>,
  countMap: Map<string, { menuCount: number; categoryCount: number; itemCount: number }>,
) {
  return locations.map(loc => {
    const counts = countMap.get(loc.id) ?? { menuCount: 0, categoryCount: 0, itemCount: 0 }
    return {
      locationId: loc.id,
      locationName: loc.name,
      locationCode: loc.code,
      menuCount: counts.menuCount,
      categoryCount: counts.categoryCount,
      itemCount: counts.itemCount,
    }
  })
}
