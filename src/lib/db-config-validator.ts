// ============================================
// PRISMA PROVIDER VALIDATOR — Setup health check
//
// ISSUE #40: Schema uses `provider = "postgresql"` but legacy .env
// had `DATABASE_URL="file:./db/custom.db"` (SQLite path).
// This helper detects mismatches + provides diagnostic info.
//
// Klici:
//   - At app boot (server.js / next.config.ts)
//   - At GET /api/system/db-health (admin dashboard)
//   - In tests to verify config is correct
// ============================================

export type DbProvider = 'postgresql' | 'sqlite' | 'mysql' | 'sqlserver' | 'mongodb'

export interface DatabaseConfigResult {
  /** Ali je trenutna konfiguracija veljavna */
  valid: boolean
  /** Ali aplikacija uporablja PGlite (embedded PostgreSQL) */
  usesPglite: boolean
  /** Ali aplikacija uporablja zunanji PostgreSQL */
  usesExternalPostgres: boolean
  /** Skriti DATABASE_URL (brez gesla) za debug */
  maskedDatabaseUrl: string
  /** Napaka če ni veljavno */
  error: string | null
  /** Priporočila za admin */
  recommendations: string[]
}

/**
 * Detekcija protokola DATABASE_URL.
 *
 * - `postgresql://` ali `postgres://` → zunanji PostgreSQL
 * - `file://` ali `file:./...` → SQLite path (neveljaven za našo schemo!)
 * - prazen / undefined → PGlite (default dev mode)
 */
export function detectProvider(databaseUrl: string | undefined | null): {
  provider: DbProvider | 'pglite' | 'unknown'
  isExternalPostgres: boolean
  isSqlite: boolean
  isPglite: boolean
} {
  if (!databaseUrl || databaseUrl.trim() === '') {
    return { provider: 'pglite', isExternalPostgres: false, isSqlite: false, isPglite: true }
  }

  if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
    return { provider: 'postgresql', isExternalPostgres: true, isSqlite: false, isPglite: false }
  }

  if (databaseUrl.startsWith('file:') || databaseUrl.startsWith('file://')) {
    return { provider: 'sqlite', isExternalPostgres: false, isSqlite: true, isPglite: false }
  }

  if (databaseUrl.startsWith('mysql://')) return { provider: 'mysql', isExternalPostgres: false, isSqlite: false, isPglite: false }

  return { provider: 'unknown', isExternalPostgres: false, isSqlite: false, isPglite: false }
}

/**
 * Maskiraj DATABASE_URL za varno logiranje (skrije geslo).
 */
export function maskDatabaseUrl(url: string | undefined | null): string {
  if (!url) return '(empty — PGlite default)'

  // postgresql://user:password@host:5432/db → postgresql://user:****@host:5432/db
  return url.replace(/(postgresql|postgres):\/\/([^:]+):([^@]+)@/, '$1://$2:****@')
}

/**
 * Glavna validacijska funkcija — kliči ob boot-u.
 */
export function validateDatabaseConfig(): DatabaseConfigResult {
  const databaseUrl = process.env.DATABASE_URL
  const detection = detectProvider(databaseUrl)
  const recommendations: string[] = []

  // SQLite → NAPAČNO za našo schemo (postgresql provider)
  if (detection.isSqlite) {
    return {
      valid: false,
      usesPglite: false,
      usesExternalPostgres: false,
      maskedDatabaseUrl: maskDatabaseUrl(databaseUrl),
      error:
        'DATABASE_URL uporablja SQLite path (file:./...) ampak schema.provider = "postgresql". ' +
        'Prisma bo padla pri validaciji ali pri `prisma db push`.',
      recommendations: [
        'DEV: pusti DATABASE_URL prazen — aplikacija bo uporabila PGlite (embedded PostgreSQL)',
        'PRODUCTION: nastavi DATABASE_URL="postgresql://user:password@host:5432/db"',
        '⚠️ NIKAKOR ne uporabljaj file:./... — schema je postgresql!',
      ],
    }
  }

  // Unknown provider
  if (detection.provider === 'unknown') {
    return {
      valid: false,
      usesPglite: false,
      usesExternalPostgres: false,
      maskedDatabaseUrl: maskDatabaseUrl(databaseUrl),
      error: `DATABASE_URL ima neznan protokol: ${databaseUrl}`,
      recommendations: [
        'Uporabljaj format: postgresql://user:password@host:5432/db',
        'Ali pusti prazno za PGlite (dev)',
      ],
    }
  }

  // PGlite (default dev)
  if (detection.isPglite) {
    recommendations.push(
      '✅ DEV način: aplikacija uporablja PGlite (embedded PostgreSQL). ' +
        'Brez zunanjih odvisnosti — idealno za development.',
    )
    recommendations.push(
      'PRODUCTION: nastavi DATABASE_URL na pravi PostgreSQL strežnik za multi-replica.',
    )
    return {
      valid: true,
      usesPglite: true,
      usesExternalPostgres: false,
      maskedDatabaseUrl: maskDatabaseUrl(databaseUrl),
      error: null,
      recommendations,
    }
  }

  // External PostgreSQL
  if (detection.isExternalPostgres) {
    recommendations.push('✅ PRODUCTION način: zunanji PostgreSQL strežnik.')
    recommendations.push(
      'Preveri povezljivost pred prvo zahtevo: `nc -zv host 5432`',
    )
    recommendations.push(
      'Multi-replica: nastavi tudi REDIS_URL za WebAuthn challenge + rate limit sinhronizacijo.',
    )
    return {
      valid: true,
      usesPglite: false,
      usesExternalPostgres: true,
      maskedDatabaseUrl: maskDatabaseUrl(databaseUrl),
      error: null,
      recommendations,
    }
  }

  // Should not reach here
  return {
    valid: false,
    usesPglite: false,
    usesExternalPostgres: false,
    maskedDatabaseUrl: maskDatabaseUrl(databaseUrl),
    error: 'Neznana napaka pri validaciji DATABASE_URL.',
    recommendations: [],
  }
}
