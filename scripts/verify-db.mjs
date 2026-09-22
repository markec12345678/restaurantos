#!/usr/bin/env node
/**
 * verify-db.mjs — FAIL-CLOSED preverba podatkovne baze po migraciji.
 *
 * Namen: zadnja vrata pred zagonom aplikacije (deployment vrstni red:
 *   bun install --frozen-lockfile
 *   bun run db:generate
 *   bun run db:migrate:deploy   ← prava migracija (transakcijska)
 *   bun run db:verify           ← TA SKRIPTA — izhod 1 = STOP deploy
 *   bun run build
 *   bun run start
 * )
 *
 * Preverja INVARIANTE (ne drift — drift preverja CI z `migrate diff`):
 *   1.  Povezljivost baze
 *   2.  Prazna tabela _prisma_migrations obstaja + NI neuspelih migracij
 *       (dokaz, da je `migrate deploy` DEJANSKO tekel)
 *   3.  Order: NI vrstic z NULL locationId ("unresolved orders")
 *   4.  Receipt: NI vrstic z NULL locationId
 *   5.  Order.locationId / Receipt.locationId sta NOT NULL (trdno)
 *   6.  Per-lokacijski unique: Order(locationId, orderNumber),
 *       Receipt(locationId, receiptNumber)
 *   7.  Delni unique indeksi (P1-7): TaxRate per-lokacija,
 *       InventoryItem, LoyaltyAccount
 *   8.  sessionVersion stolpca (P1-11) obstajata
 *   9.  MODEL A (tenant scope audit 2026-09-09, migracija 0003): vsa
 *       konfiguracija/katalog PO LOKACIJI — 15 tabel ima locationId
 *       NOT NULL + 0 NULL vrstic + DiningOption unique(type, locationId)
 *
 * Vsaka preverba se izpiše (OK/FAIL) — izhod 1 ob KATERIKOLI napaki.
 * Deployment se MORA ustaviti (docker compose run --rm migrate že
 * vključuje to skripto; samostojni deploy jo pokliče posebej).
 */
import { PrismaClient } from '@prisma/client'

const dbUrl = process.env.DATABASE_URL || ''
const isExternalPostgres =
  dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')

if (!isExternalPostgres) {
  console.error(
    '[db-verify] NAPAKA: DATABASE_URL ni nastavljen ali ni zunanji PostgreSQL.\n' +
      '            db:verify je namenjen DEPLOYMENT preverbi (staging/produkcija).\n' +
      '            V razvoju (PGlite) preverbe poganjajo integracijski testi.'
  )
  // FAIL-CLOSED: preverba brez ciljne baze NI "uspeh"
  process.exit(1)
}

const prisma = new PrismaClient({
  log: ['error'],
})

const results = []
async function check(name, fn) {
  try {
    const detail = await fn()
    results.push({ name, ok: true, detail: detail ?? '' })
    console.log(`[db-verify] OK: ${name}${detail ? ` — ${detail}` : ''}`)
  } catch (err) {
    const msg = (err && err.message ? err.message : String(err)).split('\n')[0].slice(0, 200)
    results.push({ name, ok: false, detail: msg })
    console.error(`[db-verify] FAIL: ${name} — ${msg}`)
  }
}

async function main() {
  console.log('[db-verify] Preverjam invariante baze …\n')

  // 1. Povezljivost
  await check('Povezljivost baze', async () => {
    await prisma.$queryRaw`SELECT 1`
    return 'povezava vzpostavljena'
  })

  // 2. _prisma_migrations: tabela obstaja, migracije aplicirane, NI failed
  await check('Prisma migracije aplicirane (migrate deploy je tekel)', async () => {
    const rows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE finished_at IS NULL)::int AS unfinished
      FROM "_prisma_migrations"`
    const r = rows[0]
    if (r.total === 0) {
      throw new Error('_prisma_migrations je PRAZNA — prisma migrate deploy se ni izvedel! Zaženi: bun run db:migrate:deploy')
    }
    if (r.unfinished > 0) {
      throw new Error(`${r.unfinished} nedokončanih migracij — migrate deploy ni uspel`)
    }
    return `${r.total} migracij, 0 nedokončanih`
  })

  // 3/4. Nerazrešene vrstice brez lokacije (uporabniška zahteva P1-6)
  await check('Order: 0 vrstic z NULL locationId', async () => {
    const rows = await prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM "Order" WHERE "locationId" IS NULL`
    if (rows[0].n > 0) {
      throw new Error(`Cannot apply NOT NULL migration: unresolved orders without locationId (${rows[0].n}) — razreši ROČNO (klasifikacija / uvoz iz starega vira / MIGRATION_REVIEW); NIKOLI samodejna dodelitev prvi lokaciji`)
    }
    return '0 nerazrešenih'
  })
  await check('Receipt: 0 vrstic z NULL locationId', async () => {
    const rows = await prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM "Receipt" WHERE "locationId" IS NULL`
    if (rows[0].n > 0) {
      throw new Error(`Cannot apply NOT NULL migration: unresolved receipts without locationId (${rows[0].n}) — razreši ROČNO`)
    }
    return '0 nerazrešenih'
  })

  // 5. NOT NULL trditve — Order/Receipt (0002) + MODEL A tabele (0003)
  const MODEL_A_TABLES = [
    'Menu', 'Table', 'TaxRate', 'DiningOption', 'RevenueCenter', 'SalesCategory',
    'PriceGroup', 'ServiceCharge', 'PrepStation', 'VoidReason', 'NoSaleReason',
    'Printer', 'PackagingConfig', 'AlternatePaymentType', 'Discount',
  ]
  for (const table of ['Order', 'Receipt', ...MODEL_A_TABLES]) {
    await check(`${table}.locationId NOT NULL`, async () => {
      const rows = await prisma.$queryRaw`
        SELECT is_nullable FROM information_schema.columns
        WHERE table_name = ${table} AND column_name = 'locationId'`
      if (rows.length === 0) throw new Error(`stolpec ${table}.locationId NE OBSTAJA`)
      if (rows[0].is_nullable !== 'NO') {
        throw new Error(`${table}.locationId je še NULLABLE — ${table === 'Order' || table === 'Receipt' ? '0002_p1_hardening' : '0003_tenant_model_a'} ni aplicirana`)
      }
      return 'trdno (NOT NULL)'
    })
  }

  // 6. Per-lokacijski unique (constraint ALI indeks z istim imenom)
  const indexExists = async (indexName) => {
    const rows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS n FROM pg_indexes WHERE indexname = ${indexName}`
    return rows[0].n > 0
  }
  for (const idx of [
    'Order_locationId_orderNumber_key',
    'Receipt_locationId_receiptNumber_key',
    // MODEL A: DiningOption type je unikaten ZNOTRAJ lokacije (prej GLOBALNI
    // unique — en "dine-in" za vse najemnike!)
    'DiningOption_type_locationId_key',
  ]) {
    await check(`Unique ${idx}`, async () => {
      if (!(await indexExists(idx))) throw new Error('indeks/constraint manjka — migracija ni popolna')
      return 'obstaja'
    })
  }

  // 6b. MODEL A: globalni DiningOption unique (pred 0003) NE sme obstajati več
  await check('Globalni DiningOption_type_key ODSTRANJEN (0003)', async () => {
    if (await indexExists('DiningOption_type_key')) {
      throw new Error('DiningOption_type_key še obstaja — 0003_tenant_model_a ni aplicirana')
    }
    return 'odstranjen'
  })

  // 6c. MODEL A: NI vrstic z NULL locationId v katalogu/konfiguraciji
  // (queryRawUnsafe ker je ime tabele identifikator — vrednosti iz kodiranega
  // MODEL_A_TABLES seznama, NI vhod od uporabnika → brez injekcije)
  for (const table of MODEL_A_TABLES) {
    await check(`${table}: 0 vrstic z NULL locationId`, async () => {
      const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "${table}" WHERE "locationId" IS NULL`)
      if (rows[0].n > 0) {
        throw new Error(`unresolved ${table} rows without locationId (${rows[0].n}) — razreši ROČNO, NIKOLI samodejno`)
      }
      return '0 nerazrešenih'
    })
  }

  // 7. Delni unique indeksi (P1-7 — semantika, ki je ni v shemi)
  // MODEL A: TaxRate_code_global_key je 0003 ODSTRANIL (globalne stopnje ne
  // obstajajo več) — preverjamo samo preostale.
  for (const idx of [
    'TaxRate_location_code_key',
    'InventoryItem_menuItem_location_key',
    'LoyaltyAccount_phone_location_key',
  ]) {
    await check(`Delni unique ${idx}`, async () => {
      if (!(await indexExists(idx))) throw new Error('delni unique indeks manjka — 0002_p1_hardening ni aplicirana')
      return 'obstaja'
    })
  }

  // 8. sessionVersion (P1-11 revokacija sej)
  for (const [table, col] of [
    ['Employee', 'sessionVersion'],
    ['Session', 'sessionVersion'],
  ]) {
    await check(`${table}.${col} obstaja`, async () => {
      const rows = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS n FROM information_schema.columns
        WHERE table_name = ${table} AND column_name = ${col}`
      if (rows[0].n === 0) throw new Error(`stolpec ${table}.${col} manjka`)
      return 'obstaja'
    })
  }

  const failed = results.filter((r) => !r.ok)
  console.log(`\n[db-verify] Rezultat: uspešnih preverb ${results.length - failed.length}/${results.length}.`)
  if (failed.length > 0) {
    console.error('[db-verify] DEPLOYMENT ZAVRNJEN — popravi bazo/migracije in ponovi.')
    process.exitCode = 1
  } else {
    console.log('[db-verify] Baza pripravljena za zagon aplikacije.')
  }
}

main()
  .catch((err) => {
    console.error('[db-verify] Nepričakovana napaka:', err && err.message ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await prisma.$disconnect()
    } catch {}
  })
