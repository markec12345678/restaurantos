import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readFileSync } from 'fs'
import path from 'path'

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    
    // Get existing tables
    const existing = await db.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    ` as Array<{ tablename: string }>
    
    if (existing.length < 90) {
      // Create missing tables
      const sqlPath = path.join(process.cwd(), 'prisma', 'schema.sql')
      let sql = ''
      try { sql = readFileSync(sqlPath, 'utf8') } catch {}
      
      if (sql) {
        const statements = sql.split(';').filter(s => s.trim().length > 0)
        for (const stmt of statements) {
          try { await db.$executeRawUnsafe(stmt + ';') } catch {}
        }
      }
    }
    
    // FIX: Add missing columns that were added after initial schema
    const alterStatements = [
      'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "firedAt" TIMESTAMP(3)',
      'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT NOT NULL DEFAULT \'\'',
      'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3)',
      'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT NOT NULL DEFAULT \'\'',
      'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancelledById" TEXT',
      'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "inventoryDeducted" BOOLEAN NOT NULL DEFAULT false',
      'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3)',
      'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryInfoId" TEXT',
      'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT \'unpaid\'',
      'ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "chartOfAccountCode" TEXT',
      'ALTER TABLE "JournalLine" ADD COLUMN IF NOT EXISTS "chartOfAccountCode" TEXT',
      'ALTER TABLE "JournalLine" ADD COLUMN IF NOT EXISTS "locationId" TEXT',
      'ALTER TABLE "AccountsPayable" ADD COLUMN IF NOT EXISTS "locationId" TEXT',
      'ALTER TABLE "AccountsReceivable" ADD COLUMN IF NOT EXISTS "locationId" TEXT',
      'ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT',
      'ALTER TABLE "BiometricCredential" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL',
      'ALTER TABLE "StaffShift" ADD COLUMN IF NOT EXISTS "createdById" TEXT',
      'ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "requestedById" TEXT',
      'ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "approvedById" TEXT',
    ]
    
    let added = 0
    for (const stmt of alterStatements) {
      try {
        await db.$executeRawUnsafe(stmt)
        added++
      } catch {}
    }
    
    const afterTables = await db.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    ` as Array<{ tablename: string }>
    
    return NextResponse.json({
      success: true,
      tableCount: afterTables.length,
      columnsAdded: added,
      message: `${afterTables.length} tables, ${added} columns added (including firedAt)`,
    })
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message.substring(0, 500) : 'Unknown',
    }, { status: 500 })
  }
}
