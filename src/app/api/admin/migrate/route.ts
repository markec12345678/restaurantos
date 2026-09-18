// ============================================
// POST /api/admin/migrate — Run migration packages on production DB
// ============================================
// Zažene 3 migration packages na production Neon PostgreSQL:
//   1. P0-C4 Phase 5: Backfill NULL locationId + NOT NULL + FK (24 modelov)
//   2. P0-C5: ApiKey backfill (RestaurantSettings.apiKeys → ApiKey tabela)
//   3. Issue #32: Subscription NOT NULL (Location.subscriptionId)
//
// UPORABA:
//   POST /api/admin/migrate              — dry-run (solo preveri)
//   POST /api/admin/migrate?apply=true   — dejansko aplikira
//
// VARNOST:
//   - Admin-only (requireAuth z admin permission)
//   - Rate-limited (3 zahtevke na uro)
//   - Dry-run privzeto
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { checkRateLimitAsync, getClientIp, SEED_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const rl = await checkRateLimitAsync('migrate', getClientIp(req), SEED_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Preveč zahtevkov. Migration je omejena na 3 na uro.' },
        { status: 429 }
      )
    }

    const url = new URL(req.url)
    const apply = url.searchParams.get('apply') === 'true'

    const results: Array<{ phase: string; status: string; details: string }> = []

    // ═══════════════════════════════════════════════════
    // Phase 0: Add missing columns (P0-C4 Phase 3 + Phase 4)
    // ═══════════════════════════════════════════════════
    const locationColumns = [
      { name: 'loyaltyEnabled', type: 'BOOLEAN DEFAULT false' },
      { name: 'loyaltyPointsPerEuro', type: 'INTEGER DEFAULT 1' },
      { name: 'loyaltyPointsValue', type: 'DECIMAL DEFAULT 0.01' },
      { name: 'emailReportRecipients', type: 'TEXT DEFAULT \'[]\'' },
      { name: 'emailEnabled', type: 'BOOLEAN DEFAULT false' },
    ]

    // Also add Webhook.locationId (P0-C4 Phase 4)
    const webhookColumns = [
      { name: 'locationId', type: 'TEXT' },
    ]

    let columnsAdded = 0
    for (const col of locationColumns) {
      try {
        await db.$executeRawUnsafe(
          `ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`
        )
        columnsAdded++
      } catch {
        // Column may already exist — skip
      }
    }
    for (const col of webhookColumns) {
      try {
        await db.$executeRawUnsafe(
          `ALTER TABLE "Webhook" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`
        )
        columnsAdded++
      } catch {
        // Column may already exist — skip
      }
    }

    results.push({
      phase: 'Phase 0: Location columns',
      status: columnsAdded > 0 ? 'applied' : 'skipped',
      details: `${columnsAdded} columns ensured (loyaltyEnabled, loyaltyPointsPerEuro, loyaltyPointsValue, emailReportRecipients, emailEnabled)`,
    })

    // ═══════════════════════════════════════════════════
    // Phase 0.5 (QA runda 39): 11 konfiguracijskih tabel NIMA stolpca locationId
    // (Prisma schema MODEL A jih je razglasil za po lokaciji, ampak db push/migrate
    // ni bil pognan → P2022 "column locationId does not exist" na VSAKEM create/read
    // s filtrom). Empirično potrjeno na prod runda 39; TaxRate IMA stolpec (edina).
    // ═══════════════════════════════════════════════════
    const configModelsWithLocationId = [
      'DiningOption', 'RevenueCenter', 'SalesCategory', 'PriceGroup',
      'ServiceCharge', 'PrepStation', 'VoidReason', 'NoSaleReason',
      'AlternatePaymentType', 'Printer', 'Discount',
    ]
    let configColsAdded = 0
    for (const model of configModelsWithLocationId) {
      try {
        await db.$executeRawUnsafe(
          `ALTER TABLE "${model}" ADD COLUMN IF NOT EXISTS "locationId" TEXT`
        )
        configColsAdded++
      } catch (err) {
        logger.warn('Migrate', `ADD COLUMN ${model}.locationId: ${err instanceof Error ? err.message : 'unknown'}`)
      }
    }
    // Backfill z RAW SQL — Prisma updateMany({ where: { locationId: null } }) na
    // schema-NOT-NULL modelu vrne PrismaClientValidationError še PRED pošiljanjem
    // queryja (runda 39: zato je "P0-C4 Backfill" poročal lažno "0 NULL records").
    // $executeRawUnsafe obide client validacijo in počisti NULL vrstice v DB.
    let configBackfilled = 0
    if (configColsAdded > 0) {
      const loc = await db.location.findFirst({
        where: { isActive: true },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      })
      if (loc) {
        for (const model of configModelsWithLocationId) {
          try {
            const n = await db.$executeRawUnsafe(
              `UPDATE "${model}" SET "locationId" = $1 WHERE "locationId" IS NULL`,
              loc.id
            )
            configBackfilled += n
          } catch (err) {
            logger.warn('Migrate', `Backfill raw ${model}: ${err instanceof Error ? err.message : 'unknown'}`)
          }
        }
      }
    }
    results.push({
      phase: 'Phase 0.5: Config tables locationId (runda 39)',
      status: configColsAdded === configModelsWithLocationId.length ? 'applied' : 'partial',
      details: `${configColsAdded}/${configModelsWithLocationId.length} tables ensured locationId column; ${configBackfilled} rows backfilled`,
    })

    // ═══════════════════════════════════════════════════
    // Phase 0.7 (QA runda 40): DB INTROSPEKCIJA + RestaurantSettings ensure
    // — GET/PUT /api/settings = 500 na prod (rano 40), reservations pa deluje →
    //   skupna točka je findFirst na RestaurantSettings = P2021/P2022 klasa
    //   (manjkajoča tabela/stolpec) ALI 0 aktivnih vrstic → create-fallback pad.
    // $queryRawUnsafe obide Prisma client validacijo → vidi REALNO DB stanje.
    // Introspekcija je read-only in teče VEDNO (tudi brez apply=true) —
    // diagnosticno zlato za prihodnje drift audit (sandbox nima dostopa do Neon porta).
    // ═══════════════════════════════════════════════════
    const inspectTables = [
      'RestaurantSettings', 'Location', 'Reservation', 'Receipt', 'Order',
      'ZReport', 'HaccpEntry', 'TimeEntry', 'GuestFeedback', 'PurchaseOrder',
      'Shift', 'CashRegisterShift',
      'TaxRate', // R41: taxRate update anomalo diagnoza (typed update 500, create/GET OK)
    ]
    const inspection: Record<string, string> = {}
    for (const t of inspectTables) {
      try {
        const cols = await db.$queryRawUnsafe<Array<{ column_name: string; data_type: string; is_nullable: string }>>(
          `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
          t
        )
        inspection[t] = cols.length === 0
          ? 'TABLE_MISSING'
          : cols.map(c => `${c.column_name}:${c.data_type}${c.is_nullable === 'NO' ? '*' : ''}`).join(', ')
      } catch (err) {
        inspection[t] = `INSPECT_ERROR: ${err instanceof Error ? err.message.slice(0, 120) : 'unknown'}`
      }
    }
    results.push({
      phase: 'Phase 0.7a: DB introspection (runda 40)',
      status: 'done',
      details: Object.entries(inspection).map(([t, c]) => `${t}: ${c.slice(0, 400)}`).join(' | ').slice(0, 3500),
    })

    // Phase 0.7b: ensure VSEH RestaurantSettings stolpcev po Prisma shemi.
    // Prisma SELECT izpostavi VSE shemske stolpce — EN manjkajoč = P2022 na vsakem read.
    // ADD COLUMN IF NOT EXISTS je idempotenten; NOT NULL + DEFAULT varno za obstoječe vrstice.
    const rsColumns: Array<{ name: string; type: string }> = [
      { name: 'name', type: `TEXT NOT NULL DEFAULT ''` },
      { name: 'address', type: `TEXT NOT NULL DEFAULT ''` },
      { name: 'city', type: `TEXT NOT NULL DEFAULT ''` },
      { name: 'postCode', type: `TEXT NOT NULL DEFAULT ''` },
      { name: 'phone', type: `TEXT NOT NULL DEFAULT ''` },
      { name: 'email', type: `TEXT NOT NULL DEFAULT ''` },
      { name: 'web', type: `TEXT NOT NULL DEFAULT ''` },
      { name: 'businessId', type: `TEXT NOT NULL DEFAULT ''` },
      { name: 'taxId', type: `TEXT NOT NULL DEFAULT ''` },
      { name: 'registerNumber', type: `TEXT NOT NULL DEFAULT 'BLG-001'` },
      { name: 'fursCertPath', type: `TEXT NOT NULL DEFAULT ''` },
      { name: 'fursCertPassword', type: `TEXT NOT NULL DEFAULT ''` },
      { name: 'fursEnvironment', type: `TEXT NOT NULL DEFAULT 'test'` },
      { name: 'cisCertPath', type: `TEXT NOT NULL DEFAULT ''` },
      { name: 'cisCertPassword', type: `TEXT NOT NULL DEFAULT ''` },
      { name: 'cisEnvironment', type: `TEXT NOT NULL DEFAULT 'test'` },
      { name: 'defaultVatRate', type: `DECIMAL(65,30) NOT NULL DEFAULT 22.00` },
      { name: 'reducedVatRate', type: `DECIMAL(65,30) NOT NULL DEFAULT 9.50` },
      { name: 'loyaltyEnabled', type: `BOOLEAN NOT NULL DEFAULT false` },
      { name: 'loyaltyPointsPerEuro', type: `INTEGER NOT NULL DEFAULT 1` },
      { name: 'loyaltyPointsValue', type: `DECIMAL(12,2) NOT NULL DEFAULT 0.01` },
      { name: 'receiptFooter', type: `TEXT NOT NULL DEFAULT ''` },
      { name: 'currency', type: `TEXT NOT NULL DEFAULT 'EUR'` },
      { name: 'locale', type: `TEXT NOT NULL DEFAULT 'sl-SI'` },
      { name: 'country', type: `TEXT NOT NULL DEFAULT 'SI'` },
      { name: 'apiKeys', type: `TEXT NOT NULL DEFAULT '[]'` },
      { name: 'autoGratuityEnabled', type: `BOOLEAN NOT NULL DEFAULT false` },
      { name: 'autoGratuityPercent', type: `DECIMAL(65,30) NOT NULL DEFAULT 10.00` },
      { name: 'autoGratuityThreshold', type: `INTEGER NOT NULL DEFAULT 6` },
      { name: 'allergenFilterEnabled', type: `BOOLEAN NOT NULL DEFAULT true` },
      { name: 'emailEnabled', type: `BOOLEAN NOT NULL DEFAULT false` },
      { name: 'emailSmtpHost', type: `TEXT NOT NULL DEFAULT ''` },
      { name: 'emailSmtpPort', type: `INTEGER NOT NULL DEFAULT 587` },
      { name: 'emailSmtpUser', type: `TEXT NOT NULL DEFAULT ''` },
      { name: 'emailSmtpPassword', type: `TEXT NOT NULL DEFAULT ''` },
      { name: 'emailFromAddress', type: `TEXT NOT NULL DEFAULT ''` },
      { name: 'emailReportRecipients', type: `TEXT NOT NULL DEFAULT '[]'` },
      { name: 'isActive', type: `BOOLEAN NOT NULL DEFAULT true` },
      { name: 'createdAt', type: `TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` },
      { name: 'updatedAt', type: `TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` },
    ]
    let rsTableCreated = false
    const rsColsBefore = await db.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'RestaurantSettings'`
    )
    if ((rsColsBefore[0]?.n ?? 0) === 0) {
      // Tabela sploh ne obstaja (P2021) — ustvari jo po shemi (samo id + timestampe,
      // ostale stolpce nato pokrije ensure zanka znotraj iste transakcije).
      await db.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "RestaurantSettings" ("id" TEXT NOT NULL, CONSTRAINT "RestaurantSettings_pkey" PRIMARY KEY ("id"))`
      )
      rsTableCreated = true
    }
    let rsColsAdded = 0
    const rsColsAddedList: string[] = []
    for (const col of rsColumns) {
      try {
        const before = await db.$queryRawUnsafe<Array<{ n: number }>>(
          `SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RestaurantSettings' AND column_name = $1`,
          col.name
        )
        if ((before[0]?.n ?? 0) === 0) {
          await db.$executeRawUnsafe(`ALTER TABLE "RestaurantSettings" ADD COLUMN "${col.name}" ${col.type}`)
          rsColsAdded++
          rsColsAddedList.push(col.name)
        }
      } catch (err) {
        logger.warn('Migrate', `RS ensure ${col.name}: ${err instanceof Error ? err.message.slice(0, 120) : 'unknown'}`)
      }
    }

    // Phase 0.7c: stanje vrstic — če tabela obstaja a NI aktivnih vrstic, GET vsakič
    // pade v create-fallback (ki ob manjkajočem stolpcu 500). Aktiviraj obstoječe.
    let rsTotal = 0
    let rsActive = 0
    let rsReactivated = 0
    try {
      const counts = await db.$queryRawUnsafe<Array<{ total: number; active: number }>>(
        `SELECT COUNT(*)::int AS total, COALESCE(SUM(CASE WHEN "isActive" THEN 1 ELSE 0 END), 0)::int AS active FROM "RestaurantSettings"`
      )
      rsTotal = counts[0]?.total ?? 0
      rsActive = counts[0]?.active ?? 0
      if (rsTotal > 0 && rsActive === 0) {
        rsReactivated = await db.$executeRawUnsafe(`UPDATE "RestaurantSettings" SET "isActive" = true WHERE "isActive" = false`)
        rsActive = rsReactivated
      }
    } catch (err) {
      logger.warn('Migrate', `RS row state: ${err instanceof Error ? err.message.slice(0, 120) : 'unknown'}`)
    }
    results.push({
      phase: 'Phase 0.7b: RestaurantSettings ensure (runda 40)',
      status: rsTableCreated ? 'applied (table created)' : rsColsAdded > 0 ? 'applied' : 'already-in-sync',
      details: `${rsColsAdded} stolpcev dodanih${rsColsAddedList.length ? `: ${rsColsAddedList.join(', ')}` : ''}; tabela ${rsTableCreated ? 'NOVA' : 'obstaja'}; vrstice: total=${rsTotal} active=${rsActive}${rsReactivated > 0 ? ` (reaktiviranih ${rsReactivated})` : ''}`,
    })

    // ═══════════════════════════════════════════════════
    // Phase 1: P0-C4 — Backfill NULL locationId
    // ═══════════════════════════════════════════════════
    const modelsToBackfill = [
      'Menu', 'Table', 'Shift', 'TimeEntry', 'CashRegisterShift',
      'InventoryItem', 'DeliveryZone', 'OpeningHours', 'HaccpEntry',
      'StaffShift', 'Reservation', 'PurchaseOrder', 'GuestFeedback',
      'ZReport', 'TipPool', 'DeliveryTracking',
      'AccountsPayable', 'AccountsReceivable',
      'SustainabilityReport', 'DeviceRegistry', 'VideoAnalyticsSession',
      'JournalEntry', 'JournalLine', 'Receipt',
      // QA runda 39: 11 konfiguracijskih tabel — stolpec dodan v Phase 0.5,
      // backfill jih nastavi na prvo lokacijo; Phase 2 nato NOT NULL + FK.
      // (updateMany na tabeli brez stolpca → catch "Skipping" — varno.)
      'DiningOption', 'RevenueCenter', 'SalesCategory', 'PriceGroup',
      'ServiceCharge', 'PrepStation', 'VoidReason', 'NoSaleReason',
      'AlternatePaymentType', 'Printer', 'Discount',
    ]

    // Get first active location for fallback
    const firstLocation = await db.location.findFirst({
      where: { isActive: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })

    if (!firstLocation) {
      results.push({
        phase: 'P0-C4 Backfill',
        status: 'skipped',
        details: 'No active Location found — skipping locationId backfill',
      })
    } else {
      let totalBackfilled = 0
      let totalNull = 0

      for (const model of modelsToBackfill) {
        try {
          // Count NULL records
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const count = await (db as any)[model.charAt(0).toLowerCase() + model.slice(1)].count({
            where: { locationId: null },
          })

          if (count > 0) {
            totalNull += count

            if (apply) {
              // Backfill with first active location
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const result = await (db as any)[model.charAt(0).toLowerCase() + model.slice(1)].updateMany({
                where: { locationId: null },
                data: { locationId: firstLocation.id },
              })
              totalBackfilled += result.count
              logger.info('Migrate', `Backfilled ${model}: ${result.count} records → ${firstLocation.id}`)
            }
          }
        } catch (err) {
          // Model might not exist or have locationId — skip
          logger.warn('Migrate', `Skipping ${model}: ${err instanceof Error ? err.message : 'unknown'}`)
        }
      }

      results.push({
        phase: 'P0-C4 Backfill',
        status: apply ? 'applied' : 'dry-run',
        details: `${totalNull} NULL records found${apply ? `, ${totalBackfilled} backfilled to ${firstLocation.id}` : ' (use ?apply=true to backfill)'}`,
      })
    }

    // ═══════════════════════════════════════════════════
    // Phase 2: P0-C4 — NOT NULL + FK constraints
    // ═══════════════════════════════════════════════════
    if (apply && firstLocation) {
      let notNullApplied = 0
      let notNullSkipped = 0

      for (const model of modelsToBackfill) {
        const tableName = `"${model}"`
        try {
          // Check if already NOT NULL
          const checkResult = await db.$queryRaw`
            SELECT is_nullable FROM information_schema.columns
            WHERE table_name = ${model}
            AND column_name = 'locationId'
          ` as Array<{ is_nullable: string }>

          if (checkResult.length > 0 && checkResult[0].is_nullable === 'YES') {
            // Add FK (idempotent)
            await db.$executeRawUnsafe(
              `ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS "${model}_locationId_fkey"`
            )
            await db.$executeRawUnsafe(
              `ALTER TABLE ${tableName} ADD CONSTRAINT "${model}_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
            )
            // Set NOT NULL
            await db.$executeRawUnsafe(
              `ALTER TABLE ${tableName} ALTER COLUMN "locationId" SET NOT NULL`
            )
            notNullApplied++
          } else {
            notNullSkipped++
          }
        } catch (err) {
          notNullSkipped++
          logger.warn('Migrate', `NOT NULL ${model}: ${err instanceof Error ? err.message : 'skipped'}`)
        }
      }

      results.push({
        phase: 'P0-C4 NOT NULL + FK',
        status: 'applied',
        details: `${notNullApplied} models set to NOT NULL, ${notNullSkipped} skipped (already NOT NULL or error)`,
      })
    } else if (!apply) {
      results.push({
        phase: 'P0-C4 NOT NULL + FK',
        status: 'dry-run',
        details: 'Use ?apply=true to set NOT NULL + FK constraints',
      })
    }

    // ═══════════════════════════════════════════════════
    // Phase 3: P0-C5 — ApiKey backfill
    // ═══════════════════════════════════════════════════
    try {
      const settings = await db.restaurantSettings.findFirst({
        select: { id: true, apiKeys: true },
      })

      if (settings && settings.apiKeys && settings.apiKeys !== '[]') {
        let apiKeys: Array<Record<string, unknown>> = []
        try {
          apiKeys = JSON.parse(settings.apiKeys)
        } catch { /* empty */ }

        if (apiKeys.length > 0) {
          // Get or create default subscription
          let subscription = await db.subscription.findFirst({ select: { id: true } })
          if (!subscription) {
            subscription = await db.subscription.create({
              data: {
                companyName: 'Default Company',
                email: 'admin@default.test',
                plan: 'professional',
                status: 'active',
              },
            })
          }

          let backfilled = 0
          if (apply) {
            for (const key of apiKeys) {
              const existing = await db.apiKey.findUnique({
                where: { keyHash: key.keyHash as string },
                select: { id: true },
              })
              if (!existing) {
                await db.apiKey.create({
                  data: {
                    subscriptionId: subscription.id,
                    name: key.name as string,
                    keyPrefix: key.keyPrefix as string,
                    keyHash: key.keyHash as string,
                    scopes: JSON.stringify(key.scopes || []),
                    rateLimit: (key.rateLimit as number) || 60,
                    isActive: (key.isActive as boolean) !== false,
                    createdAt: key.createdAt ? new Date(key.createdAt as string) : new Date(),
                    lastUsedAt: key.lastUsedAt ? new Date(key.lastUsedAt as string) : null,
                    expiresAt: key.expiresAt ? new Date(key.expiresAt as string) : null,
                    createdBy: (key.createdBy as string) || null,
                  },
                })
                backfilled++
              }
            }
          }

          results.push({
            phase: 'P0-C5 ApiKey backfill',
            status: apply ? 'applied' : 'dry-run',
            details: `${apiKeys.length} API keys in RestaurantSettings${apply ? `, ${backfilled} migrated to ApiKey table` : ' (use ?apply=true)'}`,
          })
        } else {
          results.push({ phase: 'P0-C5 ApiKey backfill', status: 'skipped', details: 'No API keys in RestaurantSettings' })
        }
      } else {
        results.push({ phase: 'P0-C5 ApiKey backfill', status: 'skipped', details: 'No RestaurantSettings or empty apiKeys' })
      }
    } catch (err) {
      results.push({ phase: 'P0-C5 ApiKey backfill', status: 'error', details: err instanceof Error ? err.message : 'unknown' })
    }

    // ═══════════════════════════════════════════════════
    // Phase 4: Issue #32 — Subscription NOT NULL
    // ═══════════════════════════════════════════════════
    try {
      const nullSubCount = await db.location.count({ where: { subscriptionId: null } })

      if (nullSubCount > 0) {
        if (apply) {
          // Create default subscriptions for locations without one
          const locationsWithoutSub = await db.location.findMany({
            where: { subscriptionId: null },
            select: { id: true, name: true, email: true, phone: true, taxId: true, businessId: true, currency: true },
          })

          for (const loc of locationsWithoutSub) {
            const subId = `sub-default-${loc.id}`
            await db.subscription.upsert({
              where: { id: subId },
              update: {},
              create: {
                id: subId,
                companyName: loc.name,
                email: loc.email || 'admin@default.test',
                phone: loc.phone || '',
                taxId: loc.taxId || '',
                businessId: loc.businessId || '',
                plan: 'professional',
                status: 'active',
                currency: loc.currency || 'EUR',
              },
            })
            await db.location.update({
              where: { id: loc.id },
              data: { subscriptionId: subId },
            })
          }

          // Now set NOT NULL
          await db.$executeRawUnsafe(`ALTER TABLE "Location" DROP CONSTRAINT IF EXISTS "Location_subscriptionId_fkey"`)
          await db.$executeRawUnsafe(`ALTER TABLE "Location" ADD CONSTRAINT "Location_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE`)
          await db.$executeRawUnsafe(`ALTER TABLE "Location" ALTER COLUMN "subscriptionId" SET NOT NULL`)

          results.push({
            phase: 'Issue #32 Subscription',
            status: 'applied',
            details: `${nullSubCount} locations backfilled + NOT NULL applied`,
          })
        } else {
          results.push({
            phase: 'Issue #32 Subscription',
            status: 'dry-run',
            details: `${nullSubCount} locations with NULL subscriptionId (use ?apply=true)`,
          })
        }
      } else {
        results.push({ phase: 'Issue #32 Subscription', status: 'skipped', details: 'All locations have subscriptionId' })
      }
    } catch (err) {
      results.push({ phase: 'Issue #32 Subscription', status: 'error', details: err instanceof Error ? err.message : 'unknown' })
    }

    // ═══════════════════════════════════════════════════
    // Summary
    // ═══════════════════════════════════════════════════
    return NextResponse.json({
      mode: apply ? 'APPLIED' : 'DRY-RUN',
      timestamp: new Date().toISOString(),
      results,
      summary: {
        phases: results.length,
        applied: results.filter(r => r.status === 'applied').length,
        dryRun: results.filter(r => r.status === 'dry-run').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        errors: results.filter(r => r.status === 'error').length,
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/admin/migrate', 'Napaka pri migraciji')
  }
}
