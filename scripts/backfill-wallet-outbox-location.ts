/**
 * R84 — WalletPayment.locationId + OutboxEvent.locationId: CENSUS + BACKFILL
 *
 * Uporaba:
 *   bun scripts/backfill-wallet-outbox-location.ts                    → census (read-only poročilo)
 *   bun scripts/backfill-wallet-outbox-location.ts --backfill         → backfill DRY-RUN (pokaže načrt)
 *   bun scripts/backfill-wallet-outbox-location.ts --backfill --apply → backfill ZAPIŠE (idempotentno)
 *
 * Context (R84-2 schema round):
 *   - WalletPayment je prej imel SAMO go checkId String (brez locationId stolpca
 *     niti relacije) → tenant scope je bil dvokoračen prek checkIds lastne
 *     lokacije (take 10000, PG bind limit, fail-closed nad limitom).
 *   - OutboxEvent je prej bil BREZ locationId → internal replay je prožil
 *     dogodke global-only (lokacijsko vezani webhook-i jih NIKOLI niso prejeli;
 *     fail-closed, R83-DOC).
 *
 * Backfill derivacija:
 *   WalletPayment (locationId = NULL):
 *     1. checkId podan → check.order.locationId
 *     2. checkId NULL (plačila brez čeka) → OSTANE NULL (globalno, vidi samo
 *        super-admin; ni vira za varno derivacijo)
 *   OutboxEvent (locationId = NULL):
 *     1. payload.locationId (R83 pass-through) — če je string
 *     2. aggregateType='order' → order.locationId (aggregateId)
 *     3. ostalo → ostane NULL (global-only, fail-closed)
 *
 * IDEMPOTENTNO: ponovni zagon po uspešnem backfill-u → 0 sprememb.
 * FAIL-CLOSED: ničesar ne ugibamo — če lokacije ni mogoče varno izpeljati,
 * vrstica ostane NULL in je za lokacijske uporabnike nevidna (ni leak-a).
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

// R84-FIX2 (final-auditor LOW): chunking — PG bind-param limit (65k);
// OutboxEvent lahko ima >65k vrstic na lokacijo → batch ≤ 10k id-jev
const CHUNK_SIZE = 10_000

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ══════════════════════════════════════════════════════════════════
// 1. WALLET PAYMENT
// ══════════════════════════════════════════════════════════════════
async function backfillWalletPayments(db: PrismaClient) {
  const nullRows = await db.walletPayment.findMany({
    where: { locationId: null },
    select: { id: true, checkId: true },
    take: 100000,
  })

  const withCheck = nullRows.filter((r): r is { id: string; checkId: string } => !!r.checkId)
  const withoutCheck = nullRows.filter((r) => !r.checkId)

  console.log('\n══ WALLET PAYMENT ══')
  console.log(`  NULL locationId skupaj:        ${nullRows.length}`)
  console.log(`    z checkId (izpeljivo):       ${withCheck.length}`)
  console.log(`    brez checkId (ostane NULL):  ${withoutCheck.length}`)

  if (withCheck.length === 0) return

  // Izpeljava: checkId → order.locationId (batch po checkih)
  const checkIds = [...new Set(withCheck.map((r) => r.checkId))]
  const checks = await db.check.findMany({
    where: { id: { in: checkIds } },
    select: { id: true, order: { select: { locationId: true } } },
    take: checkIds.length,
  })
  const checkToLocation = new Map<string, string | null>()
  for (const c of checks) checkToLocation.set(c.id, c.order?.locationId ?? null)

  // Združi po ciljni lokaciji → updateMany batch (idempotentno)
  const byLocation = new Map<string, string[]>()
  let unresolved = 0
  for (const row of withCheck) {
    const loc = checkToLocation.get(row.checkId)
    if (!loc) {
      // check ne obstaja več ali order.locationId NULL → ostane NULL (fail-closed)
      unresolved++
      continue
    }
    const list = byLocation.get(loc) ?? []
    list.push(row.id)
    byLocation.set(loc, list)
  }

  console.log(`  izpeljanih lokacij:            ${byLocation.size}`)
  console.log(`  neizpeljivih (check/lokacija manjka): ${unresolved}`)

  if (APPLY) {
    let updated = 0
    for (const [loc, ids] of byLocation) {
      for (const batch of chunk(ids, CHUNK_SIZE)) {
        const res = await db.walletPayment.updateMany({
          where: { id: { in: batch }, locationId: null },
          data: { locationId: loc },
        })
        updated += res.count
      }
    }
    console.log(`  ✅ ZAPISANO: ${updated} WalletPayment vrstic`)
  } else {
    for (const [loc, ids] of byLocation) {
      console.log(`  [DRY-RUN] ${ids.length} vrstic → locationId=${loc}`)
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// 2. OUTBOX EVENT
// ══════════════════════════════════════════════════════════════════
type OutboxRow = {
  id: string
  aggregateType: string
  aggregateId: string
  payload: unknown
}

async function backfillOutboxEvents(db: PrismaClient) {
  const nullRows: OutboxRow[] = await db.outboxEvent.findMany({
    where: { locationId: null },
    select: { id: true, aggregateType: true, aggregateId: true, payload: true },
    take: 100000,
  })

  console.log('\n══ OUTBOX EVENT ══')
  console.log(`  NULL locationId skupaj: ${nullRows.length}`)

  if (nullRows.length === 0) return

  // R84-FIX2 (LOW): explicitno opozorilo če je take cap zadel — ponovni zagon potreben
  if (nullRows.length >= 100_000) {
    console.log('  ⚠️  Dosežen take cap (100k) — po zaključku ponovno pozeni skript za preostanek')
  }

  // Združi po aggregateType za batch lookup
  const orders = new Set<string>()
  let fromPayload = 0

  const plan = new Map<string, { locationId: string | null; source: string }>()
  for (const row of nullRows) {
    // 1. payload.locationId (R83 pass-through)
    const payload = row.payload as { locationId?: unknown } | null
    if (payload && typeof payload.locationId === 'string' && payload.locationId.length > 0) {
      plan.set(row.id, { locationId: payload.locationId, source: 'payload' })
      fromPayload++
      continue
    }
    // 2. aggregateType='order' → order.locationId
    if (row.aggregateType === 'order') orders.add(row.aggregateId)
  }

  const orderLocations = new Map<string, string | null>()
  if (orders.size > 0) {
    const orderRows = await db.order.findMany({
      where: { id: { in: [...orders] } },
      select: { id: true, locationId: true },
      take: orders.size,
    })
    for (const o of orderRows) orderLocations.set(o.id, o.locationId)
  }

  let fromOrder = 0
  let unresolved = 0
  const byLocation = new Map<string, string[]>()
  for (const row of nullRows) {
    if (plan.has(row.id)) continue
    if (row.aggregateType === 'order') {
      const loc = orderLocations.get(row.aggregateId) ?? null
      if (!loc) {
        unresolved++
        continue
      }
      plan.set(row.id, { locationId: loc, source: 'order' })
      fromOrder++
      const list = byLocation.get(loc) ?? []
      list.push(row.id)
      byLocation.set(loc, list)
    } else {
      unresolved++
    }
  }

  console.log(`    iz payload.locationId:       ${fromPayload}`)
  console.log(`    iz order.locationId:         ${fromOrder}`)
  console.log(`    neizpeljivih (ostane NULL):  ${unresolved}`)

  if (APPLY) {
    let updated = 0
    // payload-source vrstice: individualni update (locationId je per-event)
    for (const [id, p] of plan) {
      if (p.source !== 'payload') continue
      await db.outboxEvent.update({
        where: { id },
        data: { locationId: p.locationId },
      })
      updated++
    }
    // order-source vrstice: batch per lokacija (chunked — PG bind limit)
    for (const [loc, ids] of byLocation) {
      for (const batch of chunk(ids, CHUNK_SIZE)) {
        const res = await db.outboxEvent.updateMany({
          where: { id: { in: batch }, locationId: null },
          data: { locationId: loc },
        })
        updated += res.count
      }
    }
    console.log(`  ✅ ZAPISANO: ${updated} OutboxEvent vrstic`)
  } else {
    for (const [loc, ids] of byLocation) {
      console.log(`  [DRY-RUN] ${ids.length} vrstic (order-source) → locationId=${loc}`)
    }
    console.log(`  [DRY-RUN] ${fromPayload} vrstic (payload-source) → individualni update`)
  }
}

// ══════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════
async function main() {
  const db = await makeClient()
  console.log(`R84 locationId backfill — ${APPLY ? 'APPLY (zapisuje!)' : 'CENSUS / DRY-RUN'}`)

  await backfillWalletPayments(db)
  await backfillOutboxEvents(db)

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
