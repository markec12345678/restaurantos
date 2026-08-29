import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const results: Record<string, unknown> = {}
  
  // Test 1: Simple count (works)
  try {
    results.tableCount = await db.table.count()
  } catch (e: unknown) {
    results.tableCountError = e instanceof Error ? e.message.substring(0, 300) : 'Unknown'
  }
  
  // Test 2: findMany without include
  try {
    const tables = await db.table.findMany({ take: 3 })
    results.tablesSimple = tables.length
    if (tables.length > 0) results.firstTable = tables[0]
  } catch (e: unknown) {
    results.tablesSimpleError = e instanceof Error ? e.message.substring(0, 300) : 'Unknown'
  }
  
  // Test 3: findMany WITH include (the one that fails)
  try {
    const tables = await db.table.findMany({
      take: 3,
      include: { orders: { where: { status: { in: ['pending', 'in-progress', 'ready'] } }, take: 1 } },
    })
    results.tablesWithInclude = tables.length
  } catch (e: unknown) {
    results.tablesWithIncludeError = e instanceof Error ? e.message.substring(0, 300) : 'Unknown'
  }
  
  // Test 4: Order findMany
  try {
    const orders = await db.order.findMany({ take: 3 })
    results.ordersSimple = orders.length
    if (orders.length > 0) results.firstOrder = orders[0]
  } catch (e: unknown) {
    results.ordersSimpleError = e instanceof Error ? e.message.substring(0, 300) : 'Unknown'
  }
  
  return NextResponse.json(results)
}
