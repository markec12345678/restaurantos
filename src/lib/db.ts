import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { logger } from './logger'

// FIX VERCEL: Prisma.Decimal.toJSON() returns string on PostgreSQL.
// Override to return number so frontend gets numbers (not Decimal objects).
import { Prisma } from '@prisma/client'
if (Prisma.Decimal.prototype) {
  (Prisma.Decimal.prototype as unknown as Record<string, unknown>).toJSON = function(this: { toNumber: () => number }) { return this.toNumber() }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __pgliteInstance: unknown | undefined
}

function createPrismaClientSync(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL || ''
  const isExternalPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')

  if (isExternalPostgres) {
    logger.info('DB', 'Povezujem se na zunanji PostgreSQL')
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
  }

  // Dev/test: PGlite (embedded PostgreSQL v Node.js)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PGlite } = require('@electric-sql/pglite') as { PGlite: new (dir: string) => { waitReady: () => Promise<void> } & unknown }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPGlite } = require('pglite-prisma-adapter') as { PrismaPGlite: new (client: unknown, options?: { schema?: string }) => unknown }

    const dataDir = process.env.PGLITE_DATA_DIR || '/home/z/my-project/pglite-data'
    // FIX: Uporabi obstoječo PGlite instanco, če obstaja (prepreči WASM crash)
    let pglite = globalForPrisma.__pgliteInstance as { waitReady: () => Promise<void> } & unknown
    if (!pglite) {
      pglite = new PGlite(dataDir)
      globalForPrisma.__pgliteInstance = pglite
    }
    const adapter = new PrismaPGlite(pglite)

    // FIX WORKFLOW-44: pglite-prisma-adapter 0.3.0 ne serializira BigInt pravilno
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

// PostgreSQL ima vedno WAL vklopljen (no-op za backward kompatibilnost)
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

export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await db.$transaction(async (tx) => {
      const lastLog = await tx.auditLog.findFirst({
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

      await tx.auditLog.create({
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
    })
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
