// ============================================
// R183 — A7: ENOTEN REVERSAL KANON PLAČILNEGA STATUSA
//        recalcCheckAndOrderStatusAfterReversal
// ============================================
//
// Forenzika (A7 iz docs/BUSINESS-CHAIN.md): derivacija check/order
// paymentStatus po povračilu/poničitvi je živela v DVEH (nekaj 3) vzporednih
// izvodih, ki so se DRIFTALI:
//   - POST /api/payments/[id]/refund (inline step 5–6): netPaid = Σ(completed)
//     − Σ(refundAmount) v JS float → 'storno' | 'partial' | 'paid'; order
//     agregacija z 'storno' vejico; paidAt NI bil resetiran.
//   - PUT /api/payments/[id] (recalculatePaymentStatus): Σ(completed) BREZ
//     refundAmount → terminirala v 'unpaid' (NE 'storno'!); paidAt reset SAMO
//     pri 'unpaid'. → isti poslovni dogodek je glede na pot končal v
//     različnem stanju; delno povrnjeno plačilo (completed, refundAmount > 0)
//     je na PUT poti utemeljilo 'paid' kljub nižjemu neto znesku.
//
// KANON (R183): ENA funkcija — recalcCheckAndOrderStatusAfterReversal
// (src/app/api/payments/_helpers/check-status.ts, isti dom kot plačilna smer
// updateCheckAndOrderStatus):
//   netPaid = Σ(completed amount) − Σ(refundAmount po VSEH plačilih čeka)
//   netPaid ≤ 0 → 'storno' · netPaid < total − 0.01 → 'partial' · sicer 'paid'
//   order: allStorno → 'storno' · allPaid → 'paid' · anyPaidOrPartial →
//   'partial' · sicer 'unpaid'; paidAt = null ⟺ derived ≠ 'paid'.
// Konsumatorja: POST /refund (step 5+6) IN PUT /api/payments/[id] (stari
// recalculatePaymentStatus IZBRISAN).
//
// Pokritje: A runtime kanon (storno/partial/paid + refundAmount-zavednost +
// order agregacija + paidAt unifikacija + ε prag + no-op) · B fs-pini (enoten
// dom, konsumatorji, negativni pini izbrisanih inline derivacij, lock red).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { recalcCheckAndOrderStatusAfterReversal } from '@/app/api/payments/_helpers/check-status'

// --- Mock tx (kanon je čista funkcija nad TransactionClient) ---
function makeTx(opts: {
  check?: { id: string; total: number; orderId: string | null } | null
  paidSum?: number
  refundedSum?: number
  orderChecks?: Array<{ paymentStatus: string }>
}) {
  const calls = {
    checkUpdate: vi.fn(),
    orderUpdate: vi.fn(),
    aggregate: vi.fn(),
  }
  const tx = {
    check: {
      findUnique: vi.fn().mockResolvedValue(opts.check ?? null),
      update: calls.checkUpdate,
      findMany: vi.fn().mockResolvedValue(opts.orderChecks ?? []),
    },
    payment: {
      aggregate: calls.aggregate.mockImplementation((args: { where: { status?: string } }) =>
        args.where.status === 'completed'
          ? Promise.resolve({ _sum: { amount: opts.paidSum ?? 0 } })
          : Promise.resolve({ _sum: { refundAmount: opts.refundedSum ?? 0 } })
      ),
    },
    order: {
      update: calls.orderUpdate,
    },
  }
  return { tx, calls }
}

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('R183 · A — reversal kanon runtime (netPaid derivacija)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('A1: polna reverza (net ≤ 0) → check storno + order storno + paidAt reset', async () => {
    const { tx, calls } = makeTx({
      check: { id: 'chk-1', total: 100, orderId: 'ord-1' },
      paidSum: 100,
      refundedSum: 100,
      orderChecks: [{ paymentStatus: 'storno' }],
    })
    await recalcCheckAndOrderStatusAfterReversal(tx as never, 'chk-1')
    expect(calls.checkUpdate).toHaveBeenCalledWith({ where: { id: 'chk-1' }, data: { paymentStatus: 'storno' } })
    expect(calls.orderUpdate).toHaveBeenCalledWith({
      where: { id: 'ord-1' },
      data: { paymentStatus: 'storno', paidAt: null },
    })
  })

  it('A2: delni net (0 < net < total − 0.01) → check partial + order partial + paidAt reset', async () => {
    const { tx, calls } = makeTx({
      check: { id: 'chk-1', total: 100, orderId: 'ord-1' },
      paidSum: 100,
      refundedSum: 30, // net = 70 < 99.99
      orderChecks: [{ paymentStatus: 'partial' }],
    })
    await recalcCheckAndOrderStatusAfterReversal(tx as never, 'chk-1')
    expect(calls.checkUpdate).toHaveBeenCalledWith({ where: { id: 'chk-1' }, data: { paymentStatus: 'partial' } })
    expect(calls.orderUpdate).toHaveBeenCalledWith({
      where: { id: 'ord-1' },
      data: { paymentStatus: 'partial', paidAt: null },
    })
  })

  it('A3: net ≥ total − 0.01 → paid; order paid BREZ paidAt ključa', async () => {
    const { tx, calls } = makeTx({
      check: { id: 'chk-1', total: 100, orderId: 'ord-1' },
      paidSum: 100,
      refundedSum: 0,
      orderChecks: [{ paymentStatus: 'paid' }],
    })
    await recalcCheckAndOrderStatusAfterReversal(tx as never, 'chk-1')
    expect(calls.checkUpdate).toHaveBeenCalledWith({ where: { id: 'chk-1' }, data: { paymentStatus: 'paid' } })
    const data = calls.orderUpdate.mock.calls[0][0].data
    expect(data.paymentStatus).toBe('paid')
    expect(data).not.toHaveProperty('paidAt')
  })

  it('A4: refundAmount-zavednost — completed plačilo z refundAmount > 0 NI avtomatsko paid (PUT drift pin)', async () => {
    // Forenzika stare PUT poti: Σ(completed)=100 ≥ total → 'paid', kljub temu
    // da je refundAmount knjigovodstvo pokazalo net 70. Kanon mora odšteti.
    const { tx, calls } = makeTx({
      check: { id: 'chk-1', total: 100, orderId: 'ord-1' },
      paidSum: 100,       // plačilo še vedno 'completed'
      refundedSum: 30,    // ... z refundAmount 30 (delni refund)
      orderChecks: [{ paymentStatus: 'partial' }],
    })
    await recalcCheckAndOrderStatusAfterReversal(tx as never, 'chk-1')
    expect(calls.checkUpdate).toHaveBeenCalledWith({ where: { id: 'chk-1' }, data: { paymentStatus: 'partial' } })
  })

  it('A5: order agregacija mixed (paid + storno) → order partial + paidAt reset (split-check semantika)', async () => {
    const { tx, calls } = makeTx({
      check: { id: 'chk-1', total: 50, orderId: 'ord-1' },
      paidSum: 50,
      refundedSum: 50,
      orderChecks: [{ paymentStatus: 'paid' }, { paymentStatus: 'storno' }],
    })
    await recalcCheckAndOrderStatusAfterReversal(tx as never, 'chk-1')
    const data = calls.orderUpdate.mock.calls[0][0].data
    expect(data.paymentStatus).toBe('partial')
    expect(data.paidAt).toBeNull()
  })

  it('A6: ε prag — net = total − 0.01 točno → paid (isti prag kot plačilna smer)', async () => {
    const { tx, calls } = makeTx({
      check: { id: 'chk-1', total: 100, orderId: 'ord-1' },
      paidSum: 99.99,
      refundedSum: 0,
      orderChecks: [{ paymentStatus: 'paid' }],
    })
    await recalcCheckAndOrderStatusAfterReversal(tx as never, 'chk-1')
    expect(calls.checkUpdate).toHaveBeenCalledWith({ where: { id: 'chk-1' }, data: { paymentStatus: 'paid' } })
  })

  it('A7: ček ne obstaja → no-op (brez update klicev)', async () => {
    const { tx, calls } = makeTx({ check: null })
    await recalcCheckAndOrderStatusAfterReversal(tx as never, 'chk-404')
    expect(calls.checkUpdate).not.toHaveBeenCalled()
    expect(calls.orderUpdate).not.toHaveBeenCalled()
  })

  it('A8: order brez orderId (check.orderId = null) → samo check update', async () => {
    const { tx, calls } = makeTx({
      check: { id: 'chk-1', total: 100, orderId: null },
      paidSum: 100,
      refundedSum: 100,
    })
    await recalcCheckAndOrderStatusAfterReversal(tx as never, 'chk-1')
    expect(calls.checkUpdate).toHaveBeenCalledTimes(1)
    expect(calls.orderUpdate).not.toHaveBeenCalled()
  })
})

describe('R183 · B — fs-pini (enoten dom + konsumatorji + negativni pini)', () => {
  const canon = read('src/app/api/payments/_helpers/check-status.ts')
  const refund = read('src/app/api/payments/[id]/refund/route.ts')
  const putRoute = read('src/app/api/payments/[id]/route.ts')
  const putHelpers = read('src/app/api/payments/[id]/_helpers.ts')
  const barrel = read('src/app/api/payments/_helpers/index.ts')

  it('B1: check-status.ts = ENOTEN dom obeh smeri (plačilna + reversal)', () => {
    expect(canon).toContain('export async function updateCheckAndOrderStatus')
    expect(canon).toContain('export async function recalcCheckAndOrderStatusAfterReversal')
    // Kanon formula: refundAmount-zaveden netPaid + storno terminacija
    expect(canon).toContain("_sum: { refundAmount: true }")
    expect(canon).toContain("'storno'")
    // Barrel eksportira oba
    expect(barrel).toContain('recalcCheckAndOrderStatusAfterReversal')
  })

  it('B2: refund route — kanon klic, NI inline derivacije (negativni pini)', () => {
    expect(refund).toContain('recalcCheckAndOrderStatusAfterReversal(tx, payment.checkId)')
    // Negativni pini: inline derivacija izbrisana
    expect(refund).not.toContain('tx.check.update')
    expect(refund).not.toContain('tx.order.update')
    expect(refund).not.toContain('allOrderChecks')
    expect(refund).not.toContain('netPaid <= 0')
  })

  it('B3: PUT route — kanon klic prek checkId; stara helper funkcija izbrisana', () => {
    expect(putRoute).toContain('recalcCheckAndOrderStatusAfterReversal(tx, existingPayment.checkId)')
    // Negativni pini na KOD (klic/import), ne na forenzične komentarje
    expect(putRoute).not.toContain('recalculatePaymentStatus(')
    expect(putRoute).not.toMatch(/import.*recalculatePaymentStatus/)
    expect(putHelpers).not.toContain('export async function recalculatePaymentStatus')
  })

  it('B4: lock red ohranjen — paymentMutationLockKey + paymentCheckLockKey PRED kanonom (refund)', () => {
    const lockIdx = refund.indexOf('paymentMutationLockKey')
    const checkLockIdx = refund.indexOf('paymentCheckLockKey')
    const canonIdx = refund.indexOf('recalcCheckAndOrderStatusAfterReversal(tx')
    expect(lockIdx).toBeGreaterThan(-1)
    expect(checkLockIdx).toBeGreaterThan(lockIdx)
    expect(canonIdx).toBeGreaterThan(checkLockIdx)
  })

  it('B5: R109 ključa ostajata unificirana v [id]/_helpers.ts', () => {
    expect(putHelpers).toContain('export function paymentMutationLockKey')
    expect(putHelpers).toContain('export function paymentCheckLockKey')
  })
})
