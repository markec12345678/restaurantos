/**
 * R81 — AuditLog.locationId tenant model: CENSUS + BACKFILL
 *
 * Uporaba:
 *   bun scripts/audit-location.ts                    → census (read-only poročilo)
 *   bun scripts/audit-location.ts --backfill         → backfill DRY-RUN (pokaže načrt)
 *   bun scripts/audit-location.ts --backfill --apply → backfill ZAPIŠE (idempotentno)
 *
 * Censuso pokriva runda-81 odprte točke: NULL locationId vrstice za
 * Shift / GiftCard / InventoryItem / CashRegisterShift / AuditLog / Receipt /
 * TimeEntry / GuestFeedback / HaccpEntry / PurchaseOrder.
 *
 * Backfill derivacija (AuditLog vrstice z locationId = NULL):
 *   1. userId → Employee.locationId
 *   2. (entityType, entityId) → entiteta.locationId (ali relacijska pot:
 *      Payment → check.order.locationId, StockTransaction → inventoryItem.locationId)
 *   3. ostalo (sistemski CRON/setup vnosi) → ostane NULL (globalno, vidi samo super-admin)
 *
 * VARNO: backfill NE spreminja previousHash/chainHash (locationId je namerno
 * izklopljen iz hash verige — glej src/lib/db.ts FIX R81 komentar).
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

// --- Modeli z LASTNIM locationId (census + backfill vir) ---
const OWN_LOCATION_MODELS = [
  'shift',
  'giftCard',
  'inventoryItem',
  'cashRegisterShift',
  'receipt',
  'timeEntry',
  'guestFeedback',
  'haccpEntry',
  'purchaseOrder',
] as const

// --- AuditLog entityType → način izpeljave lokacije ---
type DerivedRow = { id: string; locationId: string | null }

async function deriveForEntity(
  db: PrismaClient,
  entityType: string,
  ids: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>()
  if (ids.length === 0) return map
  switch (entityType) {
    case 'Order':
    case 'Table':
    case 'Receipt': {
      const rows: DerivedRow[] = await (db as never as Record<string, { findMany: (a: unknown) => Promise<DerivedRow[]> }>)[entityType.toLowerCase()].findMany({
        where: { id: { in: ids } },
        select: { id: true, locationId: true },
      })
      rows.forEach((r) => map.set(r.id, r.locationId))
      break
    }
    case 'Payment': {
      // Payment NIMA lastnega locationId — pot: check.order.locationId
      const rows = await db.payment.findMany({
        where: { id: { in: ids } },
        select: { id: true, check: { select: { order: { select: { locationId: true } } } } },
      })
      rows.forEach((r) => map.set(r.id, r.check?.order?.locationId ?? null))
      break
    }
    case 'StockTransaction': {
      const rows = await db.stockTransaction.findMany({
        where: { id: { in: ids } },
        select: { id: true, inventoryItem: { select: { locationId: true } } },
      })
      rows.forEach((r) => map.set(r.id, r.inventoryItem?.locationId ?? null))
      break
    }
    case 'MenuItem': {
      const rows = await db.menuItem.findMany({
        where: { id: { in: ids } },
        select: { id: true, category: { select: { menu: { select: { locationId: true } } } } },
      })
      rows.forEach((r) => map.set(r.id, r.category?.menu?.locationId ?? null))
      break
    }
    default: {
      // Model z lastnim locationId (Shift, GiftCard, ...) — poskobi generično.
      const key = entityType.charAt(0).toLowerCase() + entityType.slice(1)
      if ((OWN_LOCATION_MODELS as readonly string[]).includes(key)) {
        const model = db as never as Record<string, { findMany: (a: unknown) => Promise<DerivedRow[]> }>
        const rows = await model[key].findMany({
          where: { id: { in: ids } },
          select: { id: true, locationId: true },
        })
        rows.forEach((r) => map.set(r.id, r.locationId))
      }
      // Neznani entityType → ostane null (sistemski vnos).
    }
  }
  return map
}

async function main() {
  const args = process.argv.slice(2)
  const backfill = args.includes('--backfill')
  const apply = args.includes('--apply')
  const db = await makeClient()

  console.log(`\n=== R81 audit-location ${backfill ? (apply ? 'BACKFILL (APPLY)' : 'BACKFILL (DRY-RUN)') : 'CENSUS'} ===\n`)

  // ── 1. CENSUS: NULL locationId po modelih ──
  console.log('| Model | Skupaj | NULL locationId |')
  console.log('|---|---|---|')
  const census: Array<{ model: string; total: number; nulls: number }> = []
  for (const key of OWN_LOCATION_MODELS) {
    const model = db as never as Record<string, { count: (a?: unknown) => Promise<number> }>
    const total = await model[key].count()
    // Nekateri modeli imajo locationId NOT NULL (npr. Receipt) — filter null je
    // tedaj neveljaven: NULL vrstic je po definiciji 0.
    let nulls = 0
    try {
      nulls = await model[key].count({ where: { locationId: null } })
    } catch {
      nulls = 0
    }
    census.push({ model: key, total, nulls })
    console.log(`| ${key} | ${total} | ${nulls} |`)
  }
  {
    const [total, nulls] = await Promise.all([
      db.auditLog.count(),
      db.auditLog.count({ where: { locationId: null } }),
    ])
    census.push({ model: 'auditLog', total, nulls })
    console.log(`| auditLog | ${total} | ${nulls} |`)
  }

  // ── 2. BACKFILL ──
  if (!backfill) {
    console.log('\n(census — za backfill poženi z --backfill [--apply])')
    await db.$disconnect()
    return
  }

  const nullLogs = await db.auditLog.findMany({
    where: { locationId: null },
    select: { id: true, userId: true, entityType: true, entityId: true },
  })
  console.log(`\nAuditLog vrstic z NULL locationId: ${nullLogs.length}`)

  // Strategija 1: userId → Employee.locationId
  const userIds = [...new Set(nullLogs.map((l) => l.userId).filter((v): v is string => !!v))]
  const empLoc = new Map<string, string | null>()
  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200)
    const emps = await db.employee.findMany({ where: { id: { in: chunk } }, select: { id: true, locationId: true } })
    emps.forEach((e) => empLoc.set(e.id, e.locationId))
  }

  // Strategija 2: (entityType, entityId) → entiteta.locationId
  const byType = new Map<string, string[]>()
  for (const l of nullLogs) {
    if (!l.userId && l.entityId) {
      const arr = byType.get(l.entityType) ?? []
      arr.push(l.entityId)
      byType.set(l.entityType, arr)
    }
  }
  const entityLoc = new Map<string, Map<string, string | null>>()
  for (const [type, ids] of byType) {
    entityLoc.set(type, await deriveForEntity(db, type, [...new Set(ids)]))
  }

  // Načrt + (apply) izvedba v chunkih
  const plan: Array<{ id: string; locationId: string | null; via: 'user' | 'entity' | 'none' }> = []
  for (const l of nullLogs) {
    if (l.userId && empLoc.has(l.userId)) {
      plan.push({ id: l.id, locationId: empLoc.get(l.userId) ?? null, via: 'user' })
    } else if (!l.userId && l.entityId) {
      const loc = entityLoc.get(l.entityType)?.get(l.entityId)
      plan.push({ id: l.id, locationId: loc ?? null, via: loc ? 'entity' : 'none' })
    } else {
      plan.push({ id: l.id, locationId: null, via: 'none' })
    }
  }

  const stats = { user: 0, entity: 0, none: 0 }
  plan.forEach((p) => stats[p.via]++)
  console.log(`Načrt: via user=${stats.user}, via entity=${stats.entity}, ostane NULL (sistemski/neznan)=${stats.none}`)

  if (!apply) {
    console.log('\nDRY-RUN — nič ni zapisano. Za zapis ponovi z --apply.')
    await db.$disconnect()
    return
  }

  let updated = 0
  const writable = plan.filter((p) => p.locationId)
  // Grupiranje po vrednosti locationId → en updateMany na vrednost (učinkovito + idempotentno).
  const byLocation = new Map<string, string[]>()
  for (const p of writable) {
    const arr = byLocation.get(p.locationId as string) ?? []
    arr.push(p.id)
    byLocation.set(p.locationId as string, arr)
  }
  for (const [locId, ids] of byLocation) {
    for (let i = 0; i < ids.length; i += 100) {
      const res = await db.auditLog.updateMany({
        where: { id: { in: ids.slice(i, i + 100) }, locationId: null },
        data: { locationId: locId },
      })
      updated += res.count
    }
  }
  console.log(`\nZapisano: ${updated} auditLog vrstic (locationId dopolnjen; hash veriga NI spreminjana).`)
  const remaining = await db.auditLog.count({ where: { locationId: null } })
  console.log(`Preostalih NULL (sistemski vnosi — pričakovano): ${remaining}`)
  void census
  await db.$disconnect()
}

main().catch((e) => {
  console.error('BACKFILL/CENSUS NAPAKA:', e)
  process.exit(1)
})
