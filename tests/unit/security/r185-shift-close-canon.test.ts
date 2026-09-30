// ============================================
// r185-shift-close-canon.test.ts — A6 drift-gate (enoten zapiralni kanon smene)
// ============================================
// A6 (trojni pisec smene/Z): tri rute zaprejo CashRegisterShift —
//   (1) PUT /api/cash-register/[id]  — R104: pogojni updateMany CAS
//   (2) POST /api/end-of-day → closeShift — R110 EOD-1: pogojni updateMany CAS
//   (3) POST /api/reports/eod → closeShiftTransaction — prej NEPOGOJEN
//       update({ where: { id } }) z read-check (TOCTOU double-close; R110 je
//       popravil samo (2)) — last-writer-wins na finančnih agregatih.
// R185 KANON: closeShiftCasIfOpen (src/lib/cash-shift/close-shift-canon.ts) —
// pogojni updateMany { id, status: 'open' } kot EDINA zapiralna vrata.
// Pini: runtime CAS semantika + closeShiftTransaction (reports/eod) na kanonu
// + fs-pini VSEH treh konsumatorjev + NEGATIVNI pini starega stanja
// (inline updateMany / nepogojen update v pisecih) + Z-pisi ostajajo v R110
// upsert kanonu (advisory ključavnica) — nedotaknjeni.
// ============================================

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  closeShiftCasIfOpen,
  SHIFT_ALREADY_CLOSED,
} from '@/lib/cash-shift/close-shift-canon'

const SRC = join(process.cwd(), 'src')

// vi.mock/vi.hoisted MORAJO biti na vrhu (hoisting pred vsemi importi)
const txRunner = vi.hoisted(() => ({ fn: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => txRunner.fn(fn),
    createAuditLog: vi.fn(),
  },
}))

const AGGREGATES = {
  closingCash: 120,
  expectedCash: 118.5,
  cashDifference: 1.5,
  cashSales: 90,
  cardSales: 20,
  mobileSales: 5,
  alternateSales: 3.5,
  totalSales: 118.5,
  totalOrders: 12,
  totalDiscounts: 2,
  totalTips: 8,
  totalVoided: 0,
}

function makeTx(updateManyCount: number) {
  return {
    cashRegisterShift: {
      updateMany: vi.fn().mockResolvedValue({ count: updateManyCount }),
    },
  }
}

describe('R185 — closeShiftCasIfOpen kanon (runtime CAS semantika)', () => {
  it('count=1 → true; where je { id, status: \'open\' } in data nosi status closed + agregate verbatim', async () => {
    const tx = makeTx(1)
    const closedAt = new Date('2026-09-30T20:00:00Z')
    const result = await closeShiftCasIfOpen(tx as never, 'shift-1', {
      ...AGGREGATES,
      closedAt,
      notes: 'zaprtje',
    })
    expect(result).toBe(true)
    expect(tx.cashRegisterShift.updateMany).toHaveBeenCalledTimes(1)
    const call = tx.cashRegisterShift.updateMany.mock.calls[0][0]
    expect(call.where).toEqual({ id: 'shift-1', status: 'open' })
    expect(call.data.status).toBe('closed')
    expect(call.data.closedAt).toBe(closedAt)
    expect(call.data.closingCash).toBe(120)
    expect(call.data.expectedCash).toBe(118.5)
    expect(call.data.cashDifference).toBe(1.5)
    expect(call.data.totalSales).toBe(118.5)
    expect(call.data.totalOrders).toBe(12)
    expect(call.data.notes).toBe('zaprtje')
  })

  it('count=0 → false (izgubljena tekma — klicatelj javi SHIFT_ALREADY_CLOSED / null vejo)', async () => {
    const tx = makeTx(0)
    const result = await closeShiftCasIfOpen(tx as never, 'shift-1', { ...AGGREGATES })
    expect(result).toBe(false)
  })

  it('closedAt privzeto new Date(); notes privzeto \'\'; splitPayments/totalRefunds NISO pisana, če nista podana', async () => {
    const tx = makeTx(1)
    await closeShiftCasIfOpen(tx as never, 'shift-1', { ...AGGREGATES })
    const call = tx.cashRegisterShift.updateMany.mock.calls[0][0]
    expect(call.data.closedAt).toBeInstanceOf(Date)
    expect(call.data.notes).toBe('')
    expect(call.data).not.toHaveProperty('splitPayments')
    expect(call.data).not.toHaveProperty('totalRefunds')
  })

  it('splitPayments/totalRefunds so pisana, če jih cash-register pot poda (Test 4.2 pariteta)', async () => {
    const tx = makeTx(1)
    await closeShiftCasIfOpen(tx as never, 'shift-1', { ...AGGREGATES, splitPayments: 3, totalRefunds: 4.5 })
    const call = tx.cashRegisterShift.updateMany.mock.calls[0][0]
    expect(call.data.splitPayments).toBe(3)
    expect(call.data.totalRefunds).toBe(4.5)
  })
})

describe('R185 — closeShiftTransaction (reports/eod) teče na kanonu', () => {

  function txWith(opts: { status?: string; locationId?: string | null; casCount?: number }) {
    return {
      cashRegisterShift: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'sh-1',
          status: opts.status ?? 'open',
          locationId: opts.locationId ?? 'loc-1',
        }),
        updateMany: vi.fn().mockResolvedValue({ count: opts.casCount ?? 1 }),
      },
    }
  }

  async function run(tx: ReturnType<typeof txWith>, locationId: string | null = 'loc-1') {
    txRunner.fn.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx))
    const { closeShiftTransaction } = await import('@/app/api/reports/eod/_helpers/eod-close')
    await closeShiftTransaction('sh-1', {
      actualClosingCash: 120,
      expectedCash: 118.5,
      cashDifference: 1.5,
      cashSales: 90,
      cardSales: 20,
      mobileSales: 5,
      alternateSales: 3.5,
      totalSales: 118.5,
      completedOrdersCount: 12,
      totalDiscounts: 2,
      totalTips: 8,
      totalVoided: 0,
      notes: 'eod',
    }, locationId)
  }

  beforeEach(() => {
    txRunner.fn.mockReset()
  })

  it('happy path: piše IZKLJUČNO prek kanona (pogojni updateMany, count=1)', async () => {
    const tx = txWith({ casCount: 1 })
    await run(tx)
    expect(tx.cashRegisterShift.updateMany).toHaveBeenCalledTimes(1)
    const call = tx.cashRegisterShift.updateMany.mock.calls[0][0]
    expect(call.where).toEqual({ id: 'sh-1', status: 'open' })
    expect(call.data.status).toBe('closed')
    expect(call.data.totalOrders).toBe(12)
    expect(call.data.notes).toBe('eod')
    // nepogojen update NE sme obstajati več
    expect((tx.cashRegisterShift as unknown as Record<string, unknown>).update).toBeUndefined()
  })

  it('CAS count=0 → throw SHIFT_ALREADY_CLOSED (ruta preslika v 409)', async () => {
    const tx = txWith({ casCount: 0 })
    await expect(run(tx)).rejects.toThrow(SHIFT_ALREADY_CLOSED)
  })

  it('lokacijski guard ostane (defense-in-depth): tujja lokacija → SHIFT_NOT_FOUND, brez pisanja', async () => {
    const tx = txWith({ locationId: 'loc-OTHER' })
    await expect(run(tx, 'loc-1')).rejects.toThrow('SHIFT_NOT_FOUND')
    expect(tx.cashRegisterShift.updateMany).not.toHaveBeenCalled()
  })

  it('že zaprta izmena (pre-check) → SHIFT_ALREADY_CLOSED, brez pisanja', async () => {
    const tx = txWith({ status: 'closed' })
    await expect(run(tx)).rejects.toThrow(SHIFT_ALREADY_CLOSED)
    expect(tx.cashRegisterShift.updateMany).not.toHaveBeenCalled()
  })
})

describe('R185 — fs-pini: VSI trije pisci na kanonu + negativni pini starega stanja', () => {
  const consumers = [
    'app/api/cash-register/[id]/route.ts',
    'app/api/end-of-day/_helpers/close-shift.ts',
    'app/api/reports/eod/_helpers/eod-close.ts',
  ]

  it('vsak od treh piscev importira in kliče closeShiftCasIfOpen', () => {
    for (const rel of consumers) {
      const src = readFileSync(join(SRC, rel), 'utf-8')
      expect(src, rel).toContain('closeShiftCasIfOpen')
    }
  })

  it('NEGATIVNI pin: noben pisec ne vsebuje več inline cashRegisterShift.updateMany', () => {
    for (const rel of consumers) {
      const src = readFileSync(join(SRC, rel), 'utf-8')
      expect(src, rel).not.toMatch(/cashRegisterShift\s*\.\s*updateMany/)
    }
  })

  it('NEGATIVNI pin: reports/eod closeShiftTransaction NE vsebuje več nepogojenega update (A6 jedro)', () => {
    const src = readFileSync(join(SRC, 'app/api/reports/eod/_helpers/eod-close.ts'), 'utf-8')
    expect(src).not.toMatch(/cashRegisterShift\s*\.\s*update\s*\(/)
    expect(src).toContain("status: 'open'")
  })

  it('kanon je edini dom CAS where { id, status: \'open\' } (enoten pisec)', () => {
    const canon = readFileSync(join(SRC, 'lib/cash-shift/close-shift-canon.ts'), 'utf-8')
    expect(canon).toContain("where: { id: shiftId, status: 'open' }")
    expect(canon).toContain("status: 'closed'")
    expect(canon).toContain("export const SHIFT_ALREADY_CLOSED")
  })

  it('Z-pisi ostanejo v R110 upsert kanonu (advisory ključavnica z-report:{locationId}:{date}) — nedotaknjeni', () => {
    const z = readFileSync(join(SRC, 'app/api/z-report/_helpers/upsert-z-report.ts'), 'utf-8')
    expect(z).toContain('pg_advisory_xact_lock')
    expect(z).toContain('z-report:${locationId}:${date}')
    expect(z).toContain("status: { not: 'finalized' }")
  })
})
