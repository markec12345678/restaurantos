import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const results: Record<string, unknown> = {}
  
  try {
    const count = await db.table.count()
    results.tableCount = count
  } catch (e: unknown) {
    results.tableError = e instanceof Error ? e.message.substring(0, 300) : 'Unknown'
  }
  
  try {
    const count = await db.order.count()
    results.orderCount = count
  } catch (e: unknown) {
    results.orderError = e instanceof Error ? e.message.substring(0, 300) : 'Unknown'
  }
  
  return NextResponse.json(results)
}
