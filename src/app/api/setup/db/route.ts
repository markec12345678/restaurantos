import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readFileSync } from 'fs'
import path from 'path'

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    
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
    
    // Add ALL missing columns
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
      'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "virtualBrandId" TEXT',
      'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "diningOptionId" TEXT',
      'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "appliedDiscountId" TEXT',
      'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "revenueCenterId" TEXT',
      // FIX CRITICAL (Test 3.2): Idempotency key za preprečevanje duplikatov
      'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT',
      'ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "chartOfAccountCode" TEXT',
      'ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "courseId" TEXT',
      'ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "appliedDiscountId" TEXT',
      'ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "voidReasonId" TEXT',
      'ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "firedAt" TIMESTAMP(3)',
      'ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT \'pending\'',
      'ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "menuItemName" TEXT NOT NULL DEFAULT \'\'',
      'ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "vatRate" DECIMAL NOT NULL DEFAULT 22',
      'ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "vatAmount" DECIMAL NOT NULL DEFAULT 0',
      'ALTER TABLE "JournalLine" ADD COLUMN IF NOT EXISTS "chartOfAccountCode" TEXT',
      'ALTER TABLE "JournalLine" ADD COLUMN IF NOT EXISTS "locationId" TEXT',
      'ALTER TABLE "AccountsPayable" ADD COLUMN IF NOT EXISTS "locationId" TEXT',
      'ALTER TABLE "AccountsReceivable" ADD COLUMN IF NOT EXISTS "locationId" TEXT',
      'ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT',
      'ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "locationId" TEXT',
      'ALTER TABLE "StaffShift" ADD COLUMN IF NOT EXISTS "createdById" TEXT',
      'ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "requestedById" TEXT',
      'ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "approvedById" TEXT',
      'ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "locationId" TEXT',
      'ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "postedById" TEXT',
      'ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "absoluteExpiry" TIMESTAMP(3)',
      'ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "menuId" TEXT',
      'ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "prepStationId" TEXT',
      'ALTER TABLE "Table" ADD COLUMN IF NOT EXISTS "revenueCenterId" TEXT',
      'ALTER TABLE "Table" ADD COLUMN IF NOT EXISTS "locationId" TEXT',
      'ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "menuId" TEXT',
      // Course/Pacing related
      'ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "orderId" TEXT',
      'ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT \'pending\'',
      'ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "firedAt" TIMESTAMP(3)',
      // FIX Test 3.3: RestaurantSettings manjkajoči stolpci
      'ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "apiKeys" TEXT NOT NULL DEFAULT \'[]\'',
      'ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "fursCertPath" TEXT',
      'ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "fursCertPassword" TEXT',
      'ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "fursEnvironment" TEXT NOT NULL DEFAULT \'test\'',
      'ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "premisesId" TEXT',
      'ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "registerNumber" TEXT NOT NULL DEFAULT \'BLG-001\'',
      // Receipt manjkajoči stolpci (FURS fiscal verification)
      'ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "fiscalStatus" TEXT NOT NULL DEFAULT \'pending\'',
      'ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "fiscalVerified" BOOLEAN NOT NULL DEFAULT false',
      'ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "verificationDate" TIMESTAMP(3)',
      'ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "zoi" TEXT',
      'ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "eor" TEXT',
      // FIX Test 4.3: Receipt.vatBreakdown — JSON string z DDV razčlenitvijo
      'ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "vatBreakdown" TEXT NOT NULL DEFAULT \'{}\'',
      'ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL NOT NULL DEFAULT 0',
      'ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "totalVat" DECIMAL NOT NULL DEFAULT 0',
      'ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "total" DECIMAL NOT NULL DEFAULT 0',
      'ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "tip" DECIMAL NOT NULL DEFAULT 0',
      'ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "receiptNumber" INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "isStorno" BOOLEAN NOT NULL DEFAULT false',
      'ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "isCopy" BOOLEAN NOT NULL DEFAULT false',
      'ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT NOT NULL DEFAULT \'\'',
      // FIX Test 4.2: CashRegisterShift.totalRefunds — vsota vračil v Z-report
      'ALTER TABLE "CashRegisterShift" ADD COLUMN IF NOT EXISTS "totalRefunds" DECIMAL NOT NULL DEFAULT 0',
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
      message: `${afterTables.length} tables, ${added} columns added`,
    })
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message.substring(0, 500) : 'Unknown',
    }, { status: 500 })
  }
}
