import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { logger } from './logger'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// FIX H-09: Onemogoči query logging v produkciji
// V development načinu logiramo samo error in warn (ne query-jev)
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['error', 'warn']
      : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// ============================================
// SQLITE WAL MODE — Omogoči hkratno branje in pisanje
// Kritično za POS sistem z več terminali
// ============================================

let walModeInitialized = false

export async function enableWalMode(): Promise<void> {
  if (walModeInitialized) return
  try {
    await db.$executeRawUnsafe('PRAGMA journal_mode=WAL')
    await db.$executeRawUnsafe('PRAGMA busy_timeout=5000')
    await db.$executeRawUnsafe('PRAGMA synchronous=NORMAL')
    walModeInitialized = true
    logger.info('DB', 'SQLite WAL mode enabled, busy_timeout=5000ms, synchronous=NORMAL')
  } catch (error: unknown) {
    logger.warn('DB', 'Could not enable WAL mode:', error)
  }
}

// ============================================
// REVIZIJSKI DNEVNIK (Audit Log)
// PCI DSS + FURS skladnost — sledenje vseh operacij
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

/**
 * Ustvari revizijski vnos s hash verigo za zaščito pred poseganjem
 * Hash veriga: vsak vnos vsebuje SHA-256 hash prejšnjega vnosa + lastnih podatkov
 *
 * FIX HIGH: Celotna operacija v transakciji — prepreči race condition na chainHash
 * Brez transakcije dva sočasna klica prebereta isti lastLog in ustvarita razvejano verigo
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await db.$transaction(async (tx) => {
      // Pridobi zadnji vnos za hash verigo ZNOTRAJ transakcije
      const lastLog = await tx.auditLog.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { chainHash: true },
      })

      const detailsStr = JSON.stringify(entry.details || {})

      // FIX HIGH: Vključi VSE pomembne podatke v hash — prepreči skrivanje manipulacije
      // Prej je hash vseboval samo details, zdaj vključuje tudi action, entityType, entityId, userId
      const hashPayload = [
        lastLog?.chainHash || '',
        entry.action,
        entry.entityType,
        entry.entityId || '',
        entry.userId || '',
        detailsStr,
      ].join('|')

      // Izračunaj hash verigo: SHA-256(prejsnji_hash + podatki_tega_vnosa)
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
          chainHash,
        },
      })
    })
  } catch (error: unknown) {
    // Audit log ne sme zlomiti aplikacije — samo zabeleži napako
    logger.error('DB', 'Napaka pri pisanju revizijskega dnevnika:', error)
  }
}
