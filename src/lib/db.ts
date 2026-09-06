import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { logger } from './logger'

// FIX VERCEL: Prisma.Decimal.toJSON() returns string on PostgreSQL.
import { Prisma } from '@prisma/client'
if (Prisma.Decimal.prototype) {
  (Prisma.Decimal.prototype as unknown as Record<string, unknown>).toJSON = function(this: { toNumber: () => number }) { return this.toNumber() }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __pgliteInstance: unknown | undefined
}

function createPrismaClientSync(): PrismaClient {
  // FIX: Check DATABASE_URL first, then POSTGRES_URL (Neon sets both)
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
  const isExternalPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')

  if (isExternalPostgres) {
    // Log masked URL for debugging
    const maskedUrl = dbUrl.replace(/(postgresql|postgres):\/\/([^:]+):([^@]+)@/, '$1://$2:****@')
    logger.info('DB', `Povezujem se na zunanji PostgreSQL: ${maskedUrl.substring(0, 60)}...`)

    // FIX NAPAKA 5 (HTTP 503): Neon free plan ima omejen connection pool (5 povezav).
    // Vercel serverless lahko vzporedno proži več API klicev — brez connection_limit
    // hitro pride do izčrpanja povezav (timeout → 503).
    // - connection_limit=1: vsaka serverless function naj uporabi 1 povezavo
    // - connection_timeout=10: počakaj 10s na povezavo pred timeout
    // - pgbouncer=true: uporabi PgBouncer connection pooler (Neon podpira)
    let optimizedUrl = dbUrl
    if (!dbUrl.includes('connection_limit') && !dbUrl.includes('pgbouncer')) {
      const separator = dbUrl.includes('?') ? '&' : '?'
      // FIX: Neon priporoča connection_limit=1 za serverless + pgbouncer=true
      // (na Neon free planu je pooler na voljo privzeto)
      optimizedUrl = `${dbUrl}${separator}connection_limit=1&connection_timeout=10&pool_timeout=10`
    }

    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: optimizedUrl,
        },
      },
    })
  }

  // Dev/test: PGlite (embedded PostgreSQL v Node.js)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PGlite } = require('@electric-sql/pglite') as { PGlite: new (dir: string) => { waitReady: () => Promise<void> } & unknown }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPGlite } = require('pglite-prisma-adapter') as { PrismaPGlite: new (client: unknown, options?: { schema?: string }) => unknown }

    const dataDir = process.env.PGLITE_DATA_DIR || '/tmp/pglite-data'
    let pglite = globalForPrisma.__pgliteInstance as { waitReady: () => Promise<void> } & unknown
    if (!pglite) {
      pglite = new PGlite(dataDir)
      globalForPrisma.__pgliteInstance = pglite
    }
    const adapter = new PrismaPGlite(pglite)

    const proto = Object.getPrototypeOf(adapter)
    if (proto && typeof proto.performIO === 'function') {
      const originalPerformIO = proto.performIO
      proto.performIO = function (query: { sql: string; args: unknown[] }) {
        if (query && query.args) {
          query.args = query.args.map((arg: unknown) =>
            typeof arg === 'bigint' ? arg.toString() : arg
          )
        }
        return originalPerformIO.call(this, query)
      }
      logger.info('DB', 'PGlite adapter monkey-patched: BigInt → string conversion')
    }

    logger.info('DB', `PGlite (embedded PostgreSQL) inicializiran na ${dataDir}`)
    return new PrismaClient({ adapter } as never)
  } catch (err: unknown) {
    logger.error('DB', 'Ne morem inicializirati PGlite adapterja — padam nazaj na prazen PrismaClient:', err)
    return new PrismaClient({ log: ['error'] })
  }
}

export const db =
  globalForPrisma.prisma ??
  (() => {
    const client = createPrismaClientSync()
    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client
    return client
  })()

let walModeInitialized = false
export async function enableWalMode(): Promise<void> {
  if (walModeInitialized) return
  walModeInitialized = true
  logger.info('DB', 'PostgreSQL MVCC/WAL je privzeto omogočen — ni potrebne dodatne konfiguracije')
}

// ============================================
// REVIZIJSKI DNEVNIK (Audit Log) — PCI DSS + FURS
// ============================================

interface AuditLogEntry {
  userId?: string
  action: string
  entityType: string
  entityId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  terminalId?: string
}

// Prisma's official transaction client type — accepted as optional `tx` param
// so audit log writes can be embedded inside an outer transaction.
type AuditTxClient = import('@prisma/client').Prisma.TransactionClient

/**
 * Zapiše revizijski dnevnik s hash verigo (PCI DSS + FURS zahteva).
 *
 * FIX (P1 audit 2026-09-06): Če je `tx` podan, uporabi obstoječo transakcijo
 * (omogoča atomarno pisanje skupaj z drugimi operacijami — npr. brisanje
 * tip distribucij + kreiranje novih + audit log v eni transakciji).
 * Če `tx` NI podan, odpre svojo lastno transakcijo (backward compat).
 *
 * Hash veriga (previousHash + chainHash) se vedno bere znotraj iste transakcije
 * kot write — s tem zagotovimo konsistentno stanje verige tudi pod concurrency.
 */
export async function createAuditLog(entry: AuditLogEntry, tx?: AuditTxClient): Promise<void> {
  try {
    const runInside = async (client: AuditTxClient) => {
      const lastLog = await client.auditLog.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { chainHash: true },
      })
      const previousHash = lastLog?.chainHash || ''
      const detailsStr = JSON.stringify(entry.details || {})
      const hashPayload = [
        previousHash, entry.action, entry.entityType,
        entry.entityId || '', entry.userId || '', detailsStr,
      ].join('|')
      const chainHash = crypto.createHash('sha256').update(hashPayload).digest('hex')

      await client.auditLog.create({
        data: {
          userId: entry.userId || null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId || null,
          details: detailsStr,
          ipAddress: entry.ipAddress || '',
          terminalId: entry.terminalId || null,
          previousHash,
          chainHash,
        },
      })
    }

    if (tx) {
      await runInside(tx)
    } else {
      await db.$transaction(runInside)
    }
  } catch (error: unknown) {
    logger.error('DB', 'Napaka pri pisanju revizijskega dnevnika:', error)
  }
}

export async function createAuditLogsBatch(entries: AuditLogEntry[]): Promise<void> {
  if (entries.length === 0) return
  try {
    await db.$transaction(async (tx) => {
      let lastHash = ''
      const lastLog = await tx.auditLog.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { chainHash: true },
      })
      if (lastLog?.chainHash) lastHash = lastLog.chainHash

      for (const entry of entries) {
        const detailsStr = JSON.stringify(entry.details || {})
        const hashPayload = [
          lastHash, entry.action, entry.entityType,
          entry.entityId || '', entry.userId || '', detailsStr,
        ].join('|')
        const chainHash = crypto.createHash('sha256').update(hashPayload).digest('hex')

        await tx.auditLog.create({
          data: {
            userId: entry.userId || null,
            action: entry.action,
            entityType: entry.entityType,
            entityId: entry.entityId || null,
            details: detailsStr,
            ipAddress: entry.ipAddress || '',
            terminalId: entry.terminalId || null,
            previousHash: lastHash,
            chainHash,
          },
        })
        lastHash = chainHash
      }
    })
  } catch (error: unknown) {
    logger.error('DB', 'Napaka pri pisanju batch revizijskega dnevnika:', error)
  }
}
