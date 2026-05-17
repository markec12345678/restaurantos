import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

export async function GET(req: Request) {
  try {
    // FIX CRITICAL: Zahtevaj avtentikacijo za dostop do prodajnih podatkov
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: Record<string, unknown> = { voided: false }
    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {}
      if (startDate) createdAt.gte = new Date(startDate)
      if (endDate) createdAt.lte = new Date(endDate)
      where.createdAt = createdAt
    }

    const orderItems = await db.orderItem.findMany({
      where,
      include: { menuItem: { include: { category: true } } },
    })

    const itemMap: Record<string, { name: string; category: string; quantity: number; revenue: number }> = {}
    orderItems.forEach(item => {
      if (!itemMap[item.menuItemId]) {
        itemMap[item.menuItemId] = {
          name: item.menuItem.name,
          category: item.menuItem.category?.name || 'Unknown',
          quantity: 0,
          revenue: 0,
        }
      }
      itemMap[item.menuItemId].quantity += item.quantity
      itemMap[item.menuItemId].revenue += item.price * item.quantity
    })

    const popularItems = Object.values(itemMap).sort((a, b) => b.quantity - a.quantity)

    const categoryMap: Record<string, { category: string; revenue: number; quantity: number }> = {}
    popularItems.forEach(item => {
      if (!categoryMap[item.category]) {
        categoryMap[item.category] = { category: item.category, revenue: 0, quantity: 0 }
      }
      categoryMap[item.category].revenue += item.revenue
      categoryMap[item.category].quantity += item.quantity
    })

    // FIX: Zaokroži zneske
    Object.values(categoryMap).forEach(c => {
      c.revenue = Math.round(c.revenue * 100) / 100
    })

    return NextResponse.json({
      popularItems: popularItems.slice(0, 20).map(i => ({
        ...i,
        revenue: Math.round(i.revenue * 100) / 100,
      })),
      categoryBreakdown: Object.values(categoryMap),
    })
  } catch (error) {
    console.error('Napaka pri pridobivanju poročila priljubljenih artiklov:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju poročila' }, { status: 500 })
  }
}
