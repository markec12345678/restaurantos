// Sekundarne poizvedbe za kategorije in zaposlene

import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import type { CategoryItemGroup } from './data-fetch'

// ─── Izračunaj kategorije s sekundarno poizvedbo ───
export async function computeCategoryBreakdown(
  categoryItemGroups: CategoryItemGroup[],
  menuItemIds: string[]
) {
  const categoryBreakdown: Record<string, { category: string; quantity: number; revenue: number; menu: string }> = {}
  if (menuItemIds.length > 0) {
    const menuItemsWithCategories = await db.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, category: { select: { name: true, menu: { select: { name: true } } } } },
    })
    const menuItemMap = new Map(menuItemsWithCategories.map(m => [m.id, m]))
    for (const g of categoryItemGroups) {
      const catInfo = menuItemMap.get(g.menuItemId)
      const cat = catInfo?.category?.name || 'Ostalo'
      const menu = catInfo?.category?.menu?.name || ''
      const key = `${menu}::${cat}`
      const revenue = toNum(g.price) * (g._sum.quantity || 0)
      if (!categoryBreakdown[key]) categoryBreakdown[key] = { category: cat, quantity: 0, revenue: 0, menu }
      categoryBreakdown[key].quantity += g._sum.quantity || 0
      categoryBreakdown[key].revenue += revenue
    }
  }
  return Object.values(categoryBreakdown).sort((a, b) => b.revenue - a.revenue)
}

// ─── Izračunaj imena zaposlenih ───
export async function enrichEmployeeNames(
  employeeBreakdown: Record<string, { employeeId: string; orderCount: number; revenue: number; tips: number; employeeName?: string }>,
  empIds: string[]
) {
  if (empIds.length > 0) {
    const employees = await db.employee.findMany({
      where: { id: { in: empIds } }, select: { id: true, name: true },
    })
    for (const emp of employees) {
      if (employeeBreakdown[emp.id]) {
        (employeeBreakdown[emp.id] as Record<string, unknown>).employeeName = emp.name
      }
    }
  }
  return Object.values(employeeBreakdown).sort((a, b) => b.revenue - a.revenue)
}
