import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readFileSync } from 'fs'
import path from 'path'
import { checkRateLimitAsync, getClientIp, SEED_LIMIT } from '@/lib/rate-limit'

/**
 * Runda 30 (varnost): endpoint je bil do zdaj odprt (samo rate-limit) —
 * vsakdo je lahko sprožil DDL nad produkcijsko bazo. Zdaj: CRON_SECRET
 * Bearer (deploy runbook — `curl -H "Authorization: Bearer $CRON_SECRET"`)
 * ALI admin seja. Zrcali /api/cron/* vzorec: brez nastavljenega CRON_SECRET-a
 * gre zahteva vedno skozi admin auth.
 */
async function isAuthorized(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true
  const { requireAuth } = await import('@/lib/auth-middleware')
  const authResult = await requireAuth(req, { permission: 'admin' })
  // BUG-HUNT FIX 2026-09-19 (CRITICAL): `session: null, error: null` je JAVNA pot
  // (npr. first-run izjema), NE avtorizacija. Prej je `!authResult.error` sprejel
  // tudi neavtentificirane zahteve → anonimna DDL. Zahtevamo DEJANSKO sejo.
  return !authResult.error && authResult.session !== null
}

export async function GET(req: Request) {
  try {
    // FIX Code Review: Rate limiting — prepreči zlorabo
    const ip = getClientIp(req)
    const rl = await checkRateLimitAsync('setup-db', ip, SEED_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Preveč zahtevkov. Poskusite znova kasneje.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 3600000) / 1000)) } }
      )
    }

    // Runda 30: auth gate — CRON_SECRET bearer ALI admin seja
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await db.$queryRaw`SELECT 1`
    
    // Create missing tables
    // FIX R76 (error reporting): prej so bile vse napake tiho požrte (catch {}) —
    // operater ni videl, KATERI stavki so padli in ZAKAJ (npr. permission denied,
    // sintaksna napaka v schema.sql). Zdaj: sledimo uspešnim + neuspelim stavkom.
    const failedStatements: Array<{ statement: string; error: string }> = []
    let appliedSchemaStatements = 0
    const sqlPath = path.join(process.cwd(), 'prisma', 'schema.sql')
    let sql = ''
    try { sql = readFileSync(sqlPath, 'utf8') } catch {}
    if (sql) {
      const statements = sql.split(';').filter(s => s.trim().length > 0)
      for (const stmt of statements) {
        try {
          await db.$executeRawUnsafe(stmt + ';')
          appliedSchemaStatements++
        } catch (err: unknown) {
          failedStatements.push({
            statement: stmt.trim().substring(0, 120),
            error: err instanceof Error ? err.message.substring(0, 200) : 'Unknown',
          })
        }
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
      // FIX Test 7.2: Multi-tenant isolation — locationId za Receipt, LoyaltyAccount, GiftCard
      'ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "locationId" TEXT',
      'ALTER TABLE "LoyaltyAccount" ADD COLUMN IF NOT EXISTS "locationId" TEXT',
      'ALTER TABLE "GiftCard" ADD COLUMN IF NOT EXISTS "locationId" TEXT',
      // FIX IDOR-AUDIT (runda 12): WaitlistEntry tenant scope + OutboxEvent.response
      'ALTER TABLE "WaitlistEntry" ADD COLUMN IF NOT EXISTS "locationId" TEXT',
      'CREATE INDEX IF NOT EXISTS "WaitlistEntry_locationId_idx" ON "WaitlistEntry"("locationId")',
      'ALTER TABLE "OutboxEvent" ADD COLUMN IF NOT EXISTS "response" JSONB',
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WaitlistEntry_locationId_fkey') THEN ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL; END IF; END $$;`,
      // Runda 29 (CIS HR fiskalizacija): Receipt + ZKI/JIR polja — idempotentno,
      // MORA biti aplikirano PRED deployom novega Prisma clienta (SELECT cisStatus).
      // Glej prisma/migrations/0005_cis_receipt_fields/migration.sql.
      'ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "cisStatus" TEXT NOT NULL DEFAULT \'none\'',
      'ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "cisZki" TEXT NOT NULL DEFAULT \'\'',
      'ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "cisJir" TEXT NOT NULL DEFAULT \'\'',
      'ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "cisSubmittedAt" TIMESTAMP(3)',
      'CREATE INDEX IF NOT EXISTS "Receipt_cisStatus_idx" ON "Receipt"("cisStatus")',
      // ─── Runda 31 (FIX prod 500 na /api/menus + /api/modifier-groups) ───
      // MODEL A audit (v1.3.2) je dodal lokacijske kolone na Menu/ModifierGroup,
      // ampak NIKOLI v ta ALTER seznam → stara prod baza (drugi Neon account,
      // brez DATABASE_URL secret-a) jih nima → Prisma client (full-scalar SELECT
      // pri include) pada z "column does not exist". public/menu je delal, ker
      // selecta eksplicitno podmnozico brez locationId na skupini.
      // Idempotentno + backfill (prva obstojeca lokacija) + varovalka pred NOT NULL.
      'ALTER TABLE "ModifierGroup" ADD COLUMN IF NOT EXISTS "locationId" TEXT',
      `UPDATE "ModifierGroup" SET "locationId" = (SELECT "id" FROM "Location" ORDER BY "createdAt" ASC LIMIT 1) WHERE "locationId" IS NULL`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM "ModifierGroup" WHERE "locationId" IS NULL) THEN ALTER TABLE "ModifierGroup" ALTER COLUMN "locationId" SET NOT NULL; END IF; END $$;`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ModifierGroup_locationId_fkey') THEN ALTER TABLE "ModifierGroup" ADD CONSTRAINT "ModifierGroup_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`,
      'CREATE INDEX IF NOT EXISTS "ModifierGroup_locationId_idx" ON "ModifierGroup"("locationId")',
      // Defenzivno: ostali skalarji, ki jih full-scalar SELECT pričakuje
      'ALTER TABLE "ModifierGroup" ADD COLUMN IF NOT EXISTS "required" BOOLEAN NOT NULL DEFAULT false',
      'ALTER TABLE "ModifierGroup" ADD COLUMN IF NOT EXISTS "minSelect" INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE "ModifierGroup" ADD COLUMN IF NOT EXISTS "maxSelect" INTEGER',
      'ALTER TABLE "ModifierGroup" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE "Modifier" ADD COLUMN IF NOT EXISTS "price" DECIMAL(12,2) NOT NULL DEFAULT 0',
      'ALTER TABLE "Modifier" ADD COLUMN IF NOT EXISTS "isAvailable" BOOLEAN NOT NULL DEFAULT true',
      'ALTER TABLE "Modifier" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE "Modifier" ADD COLUMN IF NOT EXISTS "allergens" TEXT NOT NULL DEFAULT \'\'',
      'ALTER TABLE "Modifier" ADD COLUMN IF NOT EXISTS "modifierGroupId" TEXT',
      'CREATE INDEX IF NOT EXISTS "Modifier_modifierGroupId_idx" ON "Modifier"("modifierGroupId")',
      'CREATE INDEX IF NOT EXISTS "Modifier_isAvailable_idx" ON "Modifier"("isAvailable")',
      'ALTER TABLE "MenuItemModifierGroup" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE "MenuItemModifierGroup" ADD COLUMN IF NOT EXISTS "menuItemId" TEXT',
      'ALTER TABLE "MenuItemModifierGroup" ADD COLUMN IF NOT EXISTS "modifierGroupId" TEXT',
      'CREATE INDEX IF NOT EXISTS "MenuItemModifierGroup_modifierGroupId_idx" ON "MenuItemModifierGroup"("modifierGroupId")',
      'ALTER TABLE "Menu" ADD COLUMN IF NOT EXISTS "icon" TEXT NOT NULL DEFAULT \'📋\'',
      'ALTER TABLE "Menu" ADD COLUMN IF NOT EXISTS "color" TEXT NOT NULL DEFAULT \'#f59e0b\'',
      'ALTER TABLE "Menu" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE "Menu" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true',
      'ALTER TABLE "Menu" ADD COLUMN IF NOT EXISTS "locationId" TEXT',
      'CREATE INDEX IF NOT EXISTS "Menu_locationId_idx" ON "Menu"("locationId")',
      'ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT \'\'',
      'ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "icon" TEXT NOT NULL DEFAULT \'📁\'',
      'ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "color" TEXT NOT NULL DEFAULT \'#94a3b8\'',
      'ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true',
    ]
    
    let added = 0
    let alterFailed = 0
    for (const stmt of alterStatements) {
      try {
        await db.$executeRawUnsafe(stmt)
        added++
      } catch (err: unknown) {
        alterFailed++
        if (failedStatements.length < 50) {
          failedStatements.push({
            statement: stmt.trim().substring(0, 120),
            error: err instanceof Error ? err.message.substring(0, 200) : 'Unknown',
          })
        }
      }
    }
    
    const afterTables = await db.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    ` as Array<{ tablename: string }>

    // Runda 29 verifikacija — poročaj o CIS kolonah, da lahko deploy sinkronizacija
    // ZUNAJ preveri, da shema vsebuje rundo 29 PRED aktivacijo novega clienta.
    let cisReady = false
    let cisColumns: string[] = []
    let cisIndexPresent = false
    try {
      const cols = await db.$queryRaw`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'Receipt'
          AND column_name IN ('cisStatus','cisZki','cisJir','cisSubmittedAt')
        ORDER BY column_name
      ` as Array<{ column_name: string }>
      const idx = await db.$queryRaw`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'Receipt' AND indexname = 'Receipt_cisStatus_idx'
      ` as Array<{ indexname: string }>
      cisColumns = cols.map((c) => c.column_name)
      cisIndexPresent = idx.length > 0
      cisReady = cisColumns.length === 4 && cisIndexPresent
    } catch {
      // Receipt tabela morda ne obstaja (sveža baza) — report ostane false
    }

    // ─── Runda 31: GENERIC column-drift report ───
    // Sistemski fix za razred napak "prod 500 na manjkajoči koloni": za jedrne
    // tabele menijske verige + Receipt poročaj, katere kolone shema pričakuje,
    // jih pa baza NIMA. Ops dobi na enem mestu celoten manjkajoči seznam.
    const expectedColumns: Record<string, string[]> = {
      Menu: ['id', 'name', 'icon', 'color', 'sortOrder', 'isActive', 'locationId'],
      Category: ['id', 'menuId', 'name', 'description', 'icon', 'color', 'sortOrder', 'isActive'],
      MenuItem: ['id', 'categoryId', 'name', 'description', 'price', 'image', 'isAvailable', 'sortOrder', 'vatRate', 'allergens'],
      ModifierGroup: ['id', 'name', 'required', 'minSelect', 'maxSelect', 'sortOrder', 'locationId'],
      Modifier: ['id', 'name', 'price', 'isAvailable', 'sortOrder', 'allergens', 'modifierGroupId'],
      MenuItemModifierGroup: ['id', 'menuItemId', 'modifierGroupId', 'sortOrder'],
      Receipt: ['cisStatus', 'cisZki', 'cisJir', 'cisSubmittedAt', 'vatBreakdown', 'locationId'],
    }
    let missingColumns: Record<string, string[]> = {}
    let driftChecked = false
    try {
      const allCols = await db.$queryRaw`
        SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public'
      ` as Array<{ table_name: string; column_name: string }>
      const byTable: Record<string, Set<string>> = {}
      for (const r of allCols) {
        (byTable[r.table_name] ??= new Set()).add(r.column_name)
      }
      missingColumns = Object.fromEntries(
        Object.entries(expectedColumns)
          .map(([t, cols]) => [t, cols.filter((c) => !byTable[t]?.has(c))] as const)
          .filter(([, miss]) => miss.length > 0)
      )
      driftChecked = true
    } catch {
      // sveža baza / napaka — report ostane prazen
    }
    const modifierReady = !missingColumns.ModifierGroup && !missingColumns.Modifier && !missingColumns.MenuItemModifierGroup

    return NextResponse.json({
      success: true,
      tableCount: afterTables.length,
      columnsAdded: added,
      migrationSet: 'r31',
      // R76: error reporting — operater vidi, kaj je USPELO in kaj NE
      schemaStatementsApplied: appliedSchemaStatements,
      alterStatementsFailed: alterFailed,
      failedStatementsCount: failedStatements.length,
      // Prvih 25 neuspelih (idempotentni ponovni run-i lahko poročajo benign
      // "already exists" napake — zato je to diagnostika, ne alarm)
      failedStatements: failedStatements.slice(0, 25),
      cisReady,
      cisColumns,
      cisIndexPresent,
      modifierReady,
      driftChecked,
      missingColumns,
      message: `${afterTables.length} tables, ${added} columns added${failedStatements.length > 0 ? `, ${failedStatements.length} statements failed (see failedStatements)` : ''}`,
    })
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message.substring(0, 500) : 'Unknown',
    }, { status: 500 })
  }
}
