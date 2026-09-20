/**
 * R85 — DeliveryTracking.locationId: CENSUS + BACKFILL
 *
 * Uporaba:
 *   bun scripts/backfill-delivery-tracking-location.ts                    → census (read-only poročilo)
 *   bun scripts/backfill-delivery-tracking-location.ts --backfill         → backfill DRY-RUN (pokaže načrt)
 *   bun scripts/backfill-delivery-tracking-location.ts --backfill --apply → backfill ZAPIŠE (idempotentno)
 *
 * Context (R85-H2 fix):
 *   - DeliveryTracking IMA locationId stolpec (@@index([locationId])), ampak
 *     ga pisalne poti NIKOLI niso žigosale → vsi zapisi so NULL.
 *   - R85-H2 fix: GET skopira po locationId (legacy NULL = samo super-admin,
 *     fail-closed); GPS/status/assign pisalne poti žigosajo locationId
 *     (self-heal). Ta skripta enkratno zapolni zgodovinske vrstice.
 *
 * Backfill derivacija (deliveryInfoId → DeliveryInfo → Order → locationId):
 *   1. deliveryInfo.order.locationId podan → žigosi
 *   2. deliveryInfo brez ordera (standalone POST /api/delivery) ali order brez
 *      lokacije → OSTANE NULL (global-only, vidi samo super-admin; ni vira za
 *      varno derivacijo)
 *
 * IDEMPOTENTNO: ponovni zagon po uspešnem backfill-u → 0 sprememb.
 * FAIL-CLOSED: ničesar ne ugibamo — če lokacije ni mogoče varno izpeljati,
 * vrstica ostane NULL in je za lokacijske uporabnike nevidna (ni leak-a).
 * NIMA schema spremembe → NE potrebuje `prisma db push`.
 */
import { PrismaClient } from '@prisma/client'

// --- Klient: zunanji Postgres (DATABASE_URL) ali PGlite (lokalno) ---
async function makeClient(): Promise<PrismaClient> {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    return new PrismaClient({ datasources: { db: { url: dbUrl } }, log: ['error'] })
  }
  const { PGlite } = await import('@electric-sql/pglite')
  const { PrismaPGlite } = await import('pglite-prisma-adapter')
  const dataDir = process.env.PGLITE_DATA_DIR || '/tmp/pglite-data'
  const pg = new PGlite(dataDir)
  void pg // PGlite 0.5: instanca je uporabna takoj po konstruktorju (adapter čaka na readiness)
  const adapter = new PrismaPGlite(pg)
  const proto = Object.getPrototypeOf(adapter) as { performIO?: (q: { sql: string; args: unknown[] }) => unknown }
  if (proto && typeof proto.performIO === 'function') {
    const original = proto.performIO
    proto.performIO = function (query: { sql: string; args: unknown[] }) {
      if (query && query.args) {
        query.args = query.args.map((a) => (typeof a === 'bigint' ? a.toString() : a))
      }
      return original.call(this, query)
    }
  }
  return new PrismaClient({ adapter } as never)
}

const APPLY = process.argv.includes('--apply')

// PG bind-param limit (65k) — batch ≤ 10k id-jev (R84-FIX2 vzorec)
const CHUNK_SIZE = 10_000

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ══════════════════════════════════════════════════════════════════
// 1. DELIVERY TRACKING
// ══════════════════════════════════════════════════════════════════
async function backfillDeliveryTracking(db: PrismaClient) {
  const nullRows = await db.deliveryTracking.findMany({
    where: { locationId: null },
    select: { id: true, deliveryInfoId: true },
    take: 100000,
  })

  console.log('\n══ DELIVERY TRACKING ══')
  console.log(`  NULL locationId skupaj: ${nullRows.length}`)

  if (nullRows.length >= 100_000) {
    console.log('  ⚠️  Dosežen take cap (100k) — po zaključku ponovno pozeni skript za preostanek')
  }
  if (nullRows.length === 0) return

  // Izpeljava: deliveryInfoId → deliveryInfo.order.locationId (batch)
  const infoIds = [...new Set(nullRows.map((r) => r.deliveryInfoId))]
  const infoRows: Array<{ id: string; order: { locationId: string | null } | null }> = []
  // PG bind limit tudi za lookup — chunkano
  for (const batch of chunk(infoIds, CHUNK_SIZE)) {
    const rows = await db.deliveryInfo.findMany({
      where: { id: { in: batch } },
      select: { id: true, order: { select: { locationId: true } } },
      take: batch.length,
    })
    infoRows.push(...rows)
  }
  const infoToLocation = new Map<string, string | null>()
  for (const di of infoRows) infoToLocation.set(di.id, di.order?.locationId ?? null)

  // Združi po ciljni lokaciji → updateMany batch (idempotentno)
  const byLocation = new Map<string, string[]>()
  let unresolved = 0
  for (const row of nullRows) {
    const loc = infoToLocation.get(row.deliveryInfoId) ?? null
    if (!loc) {
      // deliveryInfo manjka ALI order.locationId NULL → ostane NULL (fail-closed)
      unresolved++
      continue
    }
    const list = byLocation.get(loc) ?? []
    list.push(row.id)
    byLocation.set(loc, list)
  }

  console.log(`  izpeljanih lokacij (order chain): ${byLocation.size}`)
  console.log(`  neizpeljivih (brez ordera / lokacije): ${unresolved}`)

  if (APPLY) {
    let updated = 0
    for (const [loc, ids] of byLocation) {
      for (const batch of chunk(ids, CHUNK_SIZE)) {
        const res = await db.deliveryTracking.updateMany({
          where: { id: { in: batch }, locationId: null },
          data: { locationId: loc },
        })
        updated += res.count
      }
    }
    console.log(`  ✅ ZAPISANO: ${updated} DeliveryTracking vrstic`)
  } else {
    for (const [loc, ids] of byLocation) {
      console.log(`  [DRY-RUN] ${ids.length} vrstic → locationId=${loc}`)
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════
async function main() {
  const db = await makeClient()
  console.log(`R85 delivery-tracking locationId backfill — ${APPLY ? 'APPLY (zapisuje!)' : 'CENSUS / DRY-RUN'}`)

  await backfillDeliveryTracking(db)

  await db.$disconnect()
  console.log('\nKončano.')
  if (!APPLY) {
    console.log('Za zapis pozeni z --backfill --apply')
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
