// @vitest-environment node
// ============================================
// P1-20/P1-21: INTEGRACIJSKI TESTI — prava DB, brez mockov
// ============================================
// Zažene se ločeno od unit suite: `vitest run tests/integration`
//
// okolje:
//   - CI (PostgreSQL): DATABASE_URL je nastavljen → db.ts se poveže na
//     pravi Postgres (schema se push-a z `prisma db push` pred testi)
//   - Lokalno (PGlite): brez DATABASE_URL → embedded PGlite na
//     PGLITE_DATA_DIR (schema: `node scripts/init-pglite.mjs`)
//
// Pokriva DB ravnan invariante, ki jih unit testi z mock-iranim db NE morejo:
//   - unique constraint-i (idempotencyKey, session token, sync kompozitni ključ)
//   - FK relacije (Order → Location)
//   - decimal preciznost (Payment.amount numeric(12,2))
//   - P1-11 Employee.sessionVersion default 0
// ============================================

import { describe, it, expect, afterAll, vi } from 'vitest'

// KLJUČNO: tests/setup.ts globalno mock-ira @/lib/db — za integracijske
// teste želimo PRAVEGA klienta (PGlite oz. PostgreSQL).
vi.unmock('@/lib/db')

import { db } from '@/lib/db'

const RUN_ID = `p21-int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const EMP_ID = `${RUN_ID}-emp`

afterAll(async () => {
  // Čistimo SAMO svoje vrstice (run-unique ID-ji)
  await db.session.deleteMany({ where: { employeeId: EMP_ID } }).catch(() => {})
  await db.employee.deleteMany({ where: { id: EMP_ID } }).catch(() => {})
  await db.$disconnect().catch(() => {})
})

// ─────────────────────────────────────────────
// A. SHEMA — invariante, ki jih koda pričakuje
// ─────────────────────────────────────────────
describe('Integracija A: shema — kritične tabele obstajajo', () => {
  it('vse ključne tabele so prisotne (plačila, seje, accounting, inventory)', async () => {
    const tables = (await db.$queryRaw<{ tablename: string }[]>`
      SELECT tablename::text FROM pg_tables WHERE schemaname = 'public'
    `).map((r) => r.tablename)

    const required = [
      'Payment', 'Session', 'Employee', 'SyncState', 'JournalEntry',
      'StockTransaction', 'Location', 'Order', 'AuditLog', 'CashRegisterShift',
    ]
    for (const t of required) {
      expect(tables).toContain(t)
    }
  })
})

describe('Integracija B: unique constraint-i (idempotenca na DB ravni)', () => {
  it('Payment.idempotencyKey ima UNIQUE index — zadnja varovalka pred dvojnim plačilom', async () => {
    const idx = await db.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'Payment' AND indexname = 'Payment_idempotencyKey_key'
    `
    expect(idx.length).toBe(1)
    expect(idx[0].indexdef).toContain('UNIQUE')
  })

  it('SyncState ima kompozitni UNIQUE (entityType, entityId) — offline replay ne more ustvariti dvojne vrstice', async () => {
    const idx = await db.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'SyncState' AND indexname = 'SyncState_entityType_entityId_key'
    `
    expect(idx.length).toBe(1)
    expect(idx[0].indexdef).toContain('UNIQUE')
  })

  it('Session.token ima UNIQUE index — session fixation/replay nemogoč na DB ravni', async () => {
    const idx = await db.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'Session' AND indexname = 'Session_token_key'
    `
    expect(idx.length).toBe(1)
    expect(idx[0].indexdef).toContain('UNIQUE')
  })
})

describe('Integracija C: FK + tipi + defaulti', () => {
  it('Order → Location FK obstaja (multi-tenant integriteta)', async () => {
    const fk = await db.$queryRaw<{ conname: string }[]>`
      SELECT conname::text FROM pg_constraint
      WHERE contype = 'f' AND conname = 'Order_locationId_fkey'
    `
    expect(fk.length).toBe(1)
  })

  it('Payment.amount je numeric(12,2) — DB sila 2 decimalni merski zneskov', async () => {
    const col = await db.$queryRaw<{ data_type: string; numeric_scale: number }[]>`
      SELECT data_type, numeric_scale FROM information_schema.columns
      WHERE table_name = 'Payment' AND column_name = 'amount'
    `
    expect(col[0].data_type).toBe('numeric')
    expect(col[0].numeric_scale).toBe(2)
  })

  it('Employee.sessionVersion ima default 0 (P1-11 backward kompatibilnost)', async () => {
    const col = await db.$queryRaw<{ column_default: string }[]>`
      SELECT column_default FROM information_schema.columns
      WHERE table_name = 'Employee' AND column_name = 'sessionVersion'
    `
    expect(col[0].column_default).toBe('0')
  })
})

// ─────────────────────────────────────────────
// D. PRAVA TRANSAKCIJA — P2002 skozi pravi klient
// ─────────────────────────────────────────────
describe('Integracija D: write roundtrip + unique violation (P2002)', () => {
  it('create employee + session + readback prek pravega klienta', async () => {
    await db.employee.create({
      data: {
        id: EMP_ID,
        name: 'P21 Integracija',
        email: `${RUN_ID}@test.local`,
        phone: '',
        role: 'waiter',
        status: 'active',
        hireDate: new Date(),
        pin: 'pin-hash-placeholder',
      },
    })

    const created = await db.session.create({
      data: {
        token: `hash-${RUN_ID}`,
        employeeId: EMP_ID,
        role: 'waiter',
        permissions: JSON.stringify([]),
        sessionVersion: 0,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        absoluteExpiry: new Date(Date.now() + 3_600_000),
      },
    })
    expect(created.sessionVersion).toBe(0)

    // P1-11 default: employee brez eksplicitnega sessionVersion → 0
    const emp = await db.employee.findUnique({ where: { id: EMP_ID } })
    expect(emp?.sessionVersion).toBe(0)
  })

  it('dvojni session token → PrismaClientKnownRequestError P2002 (pravi unique index)', async () => {
    await expect(
      db.session.create({
        data: {
          token: `hash-${RUN_ID}`, // isti token kot v prejšnjem testu
          employeeId: EMP_ID,
          role: 'waiter',
          permissions: JSON.stringify([]),
          sessionVersion: 0,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
          absoluteExpiry: new Date(Date.now() + 3_600_000),
        },
      })
    ).rejects.toMatchObject({
      code: 'P2002',
      clientVersion: expect.any(String),
    })
  })
})
