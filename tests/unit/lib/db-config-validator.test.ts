// ============================================
// DB CONFIG VALIDATOR — Unit testi (Issue #40)
//
// Preverjamo:
// - detectProvider: prepozna postgresql, sqlite, mysql, prazno
// - maskDatabaseUrl: skrije geslo v URL
// - validateDatabaseConfig: vrne pravilen rezultat za vsak primer
//   - SQLite path → invalid (schema je postgresql)
//   - Prazno → valid, usesPglite=true
//   - External PostgreSQL → valid, usesExternalPostgres=true
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  detectProvider,
  maskDatabaseUrl,
  validateDatabaseConfig,
} from '@/lib/db-config-validator'

const setEnv = (key: string, value: string | undefined) => {
  if (value === undefined) {
    delete (process.env as Record<string, string | undefined>)[key]
  } else {
    ;(process.env as Record<string, string | undefined>)[key] = value
  }
}

describe('detectProvider — Issue #40', () => {
  it('prazen DATABASE_URL → pglite (default)', () => {
    expect(detectProvider(undefined)).toEqual({
      provider: 'pglite',
      isExternalPostgres: false,
      isSqlite: false,
      isPglite: true,
    })
    expect(detectProvider('')).toEqual({
      provider: 'pglite',
      isExternalPostgres: false,
      isSqlite: false,
      isPglite: true,
    })
    expect(detectProvider('   ')).toEqual({
      provider: 'pglite',
      isExternalPostgres: false,
      isSqlite: false,
      isPglite: true,
    })
  })

  it('postgresql:// → external PostgreSQL', () => {
    expect(detectProvider('postgresql://user:pass@host:5432/db')).toEqual({
      provider: 'postgresql',
      isExternalPostgres: true,
      isSqlite: false,
      isPglite: false,
    })
  })

  it('postgres:// (short alias) → external PostgreSQL', () => {
    expect(detectProvider('postgres://user:pass@host:5432/db')).toEqual({
      provider: 'postgresql',
      isExternalPostgres: true,
      isSqlite: false,
      isPglite: false,
    })
  })

  it('file:./db/custom.db → SQLite (neveljaven za schemo!)', () => {
    expect(detectProvider('file:./db/custom.db')).toEqual({
      provider: 'sqlite',
      isExternalPostgres: false,
      isSqlite: true,
      isPglite: false,
    })
  })

  it('file:///abs/path.db → SQLite', () => {
    expect(detectProvider('file:///abs/path.db')).toEqual({
      provider: 'sqlite',
      isExternalPostgres: false,
      isSqlite: true,
      isPglite: false,
    })
  })

  it('mysql:// → MySQL (trenutno nepodprt v schemi)', () => {
    expect(detectProvider('mysql://user:pass@host:3306/db')).toEqual({
      provider: 'mysql',
      isExternalPostgres: false,
      isSqlite: false,
      isPglite: false,
    })
  })

  it('unknown:// → unknown provider', () => {
    expect(detectProvider('unknown://foo')).toEqual({
      provider: 'unknown',
      isExternalPostgres: false,
      isSqlite: false,
      isPglite: false,
    })
  })
})

describe('maskDatabaseUrl — Issue #40', () => {
  it('skrije geslo v postgresql URL', () => {
    const masked = maskDatabaseUrl('postgresql://user:secretPass@host:5432/db')
    expect(masked).toBe('postgresql://user:****@host:5432/db')
    expect(masked).not.toContain('secretPass')
  })

  it('skrije geslo v postgres:// URL', () => {
    const masked = maskDatabaseUrl('postgres://admin:Pass123@db.example.com:5432/prod')
    expect(masked).toBe('postgres://admin:****@db.example.com:5432/prod')
  })

  it('URL brez gesla ostane nespremenjen', () => {
    expect(maskDatabaseUrl('postgresql://user@host:5432/db')).toBe('postgresql://user@host:5432/db')
  })

  it('prazen URL → "(empty — PGlite default)"', () => {
    expect(maskDatabaseUrl(undefined)).toBe('(empty — PGlite default)')
    expect(maskDatabaseUrl('')).toBe('(empty — PGlite default)')
  })

  it('SQLite path ostane nespremenjen (nima gesla)', () => {
    expect(maskDatabaseUrl('file:./db/custom.db')).toBe('file:./db/custom.db')
  })
})

describe('validateDatabaseConfig — Issue #40', () => {
  beforeEach(() => {
    setEnv('DATABASE_URL', undefined)
  })

  afterEach(() => {
    setEnv('DATABASE_URL', undefined)
  })

  it('SQLite path → INVALID (schema je postgresql)', () => {
    setEnv('DATABASE_URL', 'file:./db/custom.db')

    const result = validateDatabaseConfig()

    expect(result.valid).toBe(false)
    expect(result.usesPglite).toBe(false)
    expect(result.usesExternalPostgres).toBe(false)
    expect(result.error).toContain('SQLite path')
    expect(result.error).toContain('postgresql')
    expect(result.recommendations).toHaveLength(3)
    expect(result.recommendations.some((r) => r.includes('PGlite'))).toBe(true)
  })

  it('prazen DATABASE_URL → valid, usesPglite=true (default dev)', () => {
    setEnv('DATABASE_URL', undefined)

    const result = validateDatabaseConfig()

    expect(result.valid).toBe(true)
    expect(result.usesPglite).toBe(true)
    expect(result.usesExternalPostgres).toBe(false)
    expect(result.error).toBeNull()
    expect(result.recommendations.some((r) => r.includes('DEV način'))).toBe(true)
  })

  it('external PostgreSQL → valid, usesExternalPostgres=true', () => {
    setEnv('DATABASE_URL', 'postgresql://user:pass@db.example.com:5432/prod')

    const result = validateDatabaseConfig()

    expect(result.valid).toBe(true)
    expect(result.usesPglite).toBe(false)
    expect(result.usesExternalPostgres).toBe(true)
    expect(result.error).toBeNull()
    expect(result.recommendations.some((r) => r.includes('PRODUCTION način'))).toBe(true)
    expect(result.maskedDatabaseUrl).toBe('postgresql://user:****@db.example.com:5432/prod')
  })

  it('unknown protokol → INVALID', () => {
    setEnv('DATABASE_URL', 'unknown://foo')

    const result = validateDatabaseConfig()

    expect(result.valid).toBe(false)
    expect(result.error).toContain('neznan protokol')
  })

  it('MySQL → INVALID (schema je postgresql)', () => {
    setEnv('DATABASE_URL', 'mysql://user:pass@host:3306/db')

    const result = validateDatabaseConfig()

    expect(result.valid).toBe(false)
    // MySQL ni podprt v naši schemi
    expect(result.error).toBeDefined()
  })

  it('maskedDatabaseUrl skrije geslo', () => {
    setEnv('DATABASE_URL', 'postgresql://admin:SuperSecret123@db.host:5432/mydb')

    const result = validateDatabaseConfig()

    expect(result.maskedDatabaseUrl).not.toContain('SuperSecret123')
    expect(result.maskedDatabaseUrl).toContain('****')
  })
})
