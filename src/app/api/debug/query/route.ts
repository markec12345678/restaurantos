import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'

export async function GET(req: Request) {
  // FIX Code Review: Dodan admin auth — prej je bil brez auth!
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  const results: Record<string, unknown> = {}
  
  // Test 1: Order findMany without include
  try {
    const orders = await db.order.findMany({ take: 1 })
    results.ordersSimple = orders.length
  } catch (e: unknown) {
    results.ordersSimpleError = e instanceof Error ? e.message.substring(0, 300) : 'Unknown'
  }
  
  // Test 2: Order with table include
  try {
    const orders = await db.order.findMany({ take: 1, include: { table: true } })
    results.ordersWithTable = orders.length
  } catch (e: unknown) {
    results.ordersWithTableError = e instanceof Error ? e.message.substring(0, 300) : 'Unknown'
  }
  
  // Test 3: Order with virtualBrand include
  try {
    const orders = await db.order.findMany({ take: 1, include: { virtualBrand: { select: { id: true, name: true, code: true, color: true } } } })
    results.ordersWithBrand = orders.length
  } catch (e: unknown) {
    results.ordersWithBrandError = e instanceof Error ? e.message.substring(0, 300) : 'Unknown'
  }
  
  // Test 4: Order with orderItems include
  try {
    const orders = await db.order.findMany({ take: 1, include: { orderItems: true } })
    results.ordersWithItems = orders.length
  } catch (e: unknown) {
    results.ordersWithItemsError = e instanceof Error ? e.message.substring(0, 300) : 'Unknown'
  }
  
  // Test 5: Order with full include (the one that fails)
  try {
    const orders = await db.order.findMany({
      take: 1,
      include: {
        table: true,
        virtualBrand: { select: { id: true, name: true, code: true, color: true } },
        orderItems: { include: { menuItem: { include: { prepStation: true, category: { include: { menu: true } } } } } },
      },
    })
    results.ordersFullInclude = orders.length
  } catch (e: unknown) {
    results.ordersFullIncludeError = e instanceof Error ? e.message.substring(0, 300) : 'Unknown'
  }
  
  return NextResponse.json(results)
}
