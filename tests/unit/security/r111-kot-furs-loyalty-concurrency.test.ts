// ============================================
// R111 — KOT PISALNI KANON (status guard + Serializable tx)
//        + FURS OVERITVENI CLAIM KANON (dvojni EOR preprečen)
//        + LOYALTY DAILY-BONUS IDEMPOTENCA (dvojni bonus/SMS preprečen)
//        — CONCURRENCY & ERROR KONTRAKT (TOCTOU razred R100–R110)
// ============================================
//
// Forenzika (glej kot/route.ts, furs/helpers/verify-invoice/core.ts,
// lib/loyalty-automation/index.ts R111 headerje):
//
//   KOT-1 (MEDIUM, POST /api/kot): order read IZVEN tx + BREZ status
//     preverbe → KOT izdan za PREKLICANO naročilo (kuhinja dobi list za
//     jed, ki ne obstaja več) + check-then-act okno (preklic med read in
//     create). Fix: Serializable tx + tx-fresh scoped re-read + status
//     guard + create pod istim snapshot-om; P2034/P2002 → 409.
//   FURS-1 (HIGH, POST /api/furs): verify check-then-act brez zaklepa →
//     ZUNANJI FURS klic → NEPOGOJEN update. Dva sočasna verify-a = DVA
//     EOR-ja za isti račun (fiskalna kršitev ZDDV-1) + last-writer-wins.
//     Fix: CAS claim (updateMany fiscalStatus 'verifying') PRED zunanjim
//     klicem; loser → idempotenten 200 (že overjen) ali 409 (in-flight);
//     stale claim reclaim po 2 min; release na vseh failure poteh.
//   LA-1 (HIGH, lib/loyalty-automation): triggerBirthdayBonus/triggerWinback
//     brez dedup-a → dvoklik ali admin∥cron batch = DVOJNI bonus (točke ×2)
//     + duplirani SMS. Fix: advisory lock 'loyalty-bonus:{id}:{type}:{date}'
//     + Serializable tx + tx-fresh re-check (reason+danes) → skip; SMS
//     ŠELE PO commitu; P2034 → skip (batch ne pada).
//
// Pokritje: A KOT kanon · B FURS claim kanon · C loyalty bonus kanon ·
// D fs-pini (vir pini).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Prisma } from '@prisma/client'

const LOC_A = 'loc-tenant-a'
const ORD = 'ord-1'
const ACC = 'acc-1'

// --- Mocki (vi.hoisted) ---
const mocks = vi.hoisted(() => ({
  // A — KOT
  requireAuth: vi.fn(),
  transaction: vi.fn(),
  txOrderFindFirst: vi.fn(),
  txTableFindUnique: vi.fn(),
  txKotCreate: vi.fn(),
  getNextCounter: vi.fn(),
  // B — FURS
  validateAndFetchData: vi.fn(),
  submitToFurs: vi.fn(),
  handleSuccessfulVerification: vi.fn(),
  handleFailedVerification: vi.fn(),
  handleVerificationError: vi.fn(),
  generateQRForVerifiedReceipt: vi.fn(),
  verifyInvoiceWithFURS: vi.fn(),
  receiptUpdateMany: vi.fn(),
  receiptFindUnique: vi.fn(),
  // C — loyalty
  loyaltyAccountFindUnique: vi.fn(),
  txExecuteRaw: vi.fn(),
  txLoyaltyTxFindFirst: vi.fn(),
  txLoyaltyTxCreate: vi.fn(),
  txLoyaltyAccountUpdate: vi.fn(),
  sendSms: vi.fn(),
  createOutboxEvent: vi.fn(),
}))

// Privzeti tx klient (deljen A/C — ločene mock funkcije)
const txClient = {
  // A — KOT
  order: { findFirst: mocks.txOrderFindFirst },
  table: { findUnique: mocks.txTableFindUnique },
  kotDocument: { create: mocks.txKotCreate },
  // C — loyalty
  $executeRaw: mocks.txExecuteRaw,
  loyaltyTransaction: {
    findFirst: mocks.txLoyaltyTxFindFirst,
    create: mocks.txLoyaltyTxCreate,
  },
  loyaltyAccount: { update: mocks.txLoyaltyAccountUpdate },
}

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: mocks.transaction,
    receipt: {
      updateMany: mocks.receiptUpdateMany,
      findUnique: mocks.receiptFindUnique,
    },
    loyaltyAccount: { findUnique: mocks.loyaltyAccountFindUnique },
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/counters', () => ({
  getNextCounter: mocks.getNextCounter,
}))

vi.mock('@/app/api/furs/helpers/verify-invoice/validate-and-submit', () => ({
  validateAndFetchData: mocks.validateAndFetchData,
  submitToFurs: mocks.submitToFurs,
}))

vi.mock('@/app/api/furs/helpers/verify-invoice/post-verify', () => ({
  handleSuccessfulVerification: mocks.handleSuccessfulVerification,
  handleFailedVerification: mocks.handleFailedVerification,
  handleVerificationError: mocks.handleVerificationError,
  generateQRForVerifiedReceipt: mocks.generateQRForVerifiedReceipt,
}))

vi.mock('@/lib/furs', () => ({
  verifyInvoiceWithFURS: mocks.verifyInvoiceWithFURS,
}))

vi.mock('@/lib/sms', () => ({
  sendSms: mocks.sendSms,
}))

vi.mock('@/lib/outbox', () => ({
  createOutboxEvent: mocks.createOutboxEvent,
}))

// Utišaj logger
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { POST as kotPOST } from '@/app/api/kot/route'
import { verifyInvoice } from '@/app/api/furs/helpers/verify-invoice/core'
import { triggerBirthdayBonus, triggerWinback, DEFAULT_CONFIG } from '@/lib/loyalty-automation'

const ACTIVE_ORDER = {
  id: ORD,
  orderNumber: 'ORD-2026-000001',
  status: 'confirmed',
  tableId: 'tbl-1',
  type: 'dine-in',
  locationId: LOC_A,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient))
  // A defaults
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'waiter', locationId: LOC_A },
    error: null,
  })
  mocks.getNextCounter.mockResolvedValue(42)
  mocks.txOrderFindFirst.mockResolvedValue({ ...ACTIVE_ORDER })
  mocks.txTableFindUnique.mockResolvedValue({ number: 5 })
  mocks.txKotCreate.mockResolvedValue({ id: 'kot-1', kotNumber: 42, type: 'original' })
  // B defaults
  mocks.receiptUpdateMany.mockResolvedValue({ count: 1 })
  mocks.receiptFindUnique.mockResolvedValue(null)
  mocks.submitToFurs.mockResolvedValue({ zoi: 'zoi-x', invoiceData: { test: true } })
  mocks.handleSuccessfulVerification.mockResolvedValue('qr-content')
  mocks.verifyInvoiceWithFURS.mockResolvedValue({
    success: true, zoi: 'zoi-x', eor: 'eor-x', verifiedAt: new Date(), isSimulation: true, environment: 'test',
  })
  mocks.generateQRForVerifiedReceipt.mockReturnValue('qr-content')
  // C defaults
  mocks.loyaltyAccountFindUnique.mockResolvedValue({
    id: ACC, customerName: 'Ana', customerPhone: '+38640123456', isActive: true,
  })
  mocks.txExecuteRaw.mockResolvedValue(1)
  mocks.txLoyaltyTxFindFirst.mockResolvedValue(null)
  mocks.txLoyaltyTxCreate.mockResolvedValue({ id: 'ltx-1' })
  mocks.txLoyaltyAccountUpdate.mockResolvedValue({})
  mocks.sendSms.mockResolvedValue({})
  mocks.createOutboxEvent.mockResolvedValue({ id: 'ob-1' })
})

function jsonPost(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ══════════════════════════════════════════════════════════════════
// A. KOT pisalni kanon (KOT-1)
// ══════════════════════════════════════════════════════════════════
describe('R111 A: POST /api/kot — Serializable tx + status guard', () => {
  it('srečna pot: 201 + tx-fresh scoped order read (locationId v where) + create s kotNumber', async () => {
    const res = await kotPOST(jsonPost('http://localhost/api/kot', { orderId: ORD, type: 'original', itemsJson: '[{"menuItemId":"m1","quantity":2}]' }))
    expect(res.status).toBe(201)
    // tx-fresh order read nosi lokacijski scope
    expect(mocks.txOrderFindFirst).toHaveBeenCalledTimes(1)
    expect(mocks.txOrderFindFirst.mock.calls[0][0].where.locationId).toBe(LOC_A)
    // KOT create pod istim snapshot-om
    expect(mocks.txKotCreate.mock.calls[0][0].data.kotNumber).toBe(42)
    expect(mocks.txKotCreate.mock.calls[0][0].data.orderId).toBe(ORD)
  })

  it('PREKLICANO naročilo → 409 structured (kuhinja ne dobi lista za mrtvo naročilo)', async () => {
    mocks.txOrderFindFirst.mockResolvedValue({ ...ACTIVE_ORDER, status: 'cancelled' })
    const res = await kotPOST(jsonPost('http://localhost/api/kot', { orderId: ORD }))
    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining('preklicano') })
    // NI create-a
    expect(mocks.txKotCreate).not.toHaveBeenCalled()
  })

  it('naročilo ni najdeno / izven scope-a → 404 (enak odgovor, brez razkritja)', async () => {
    mocks.txOrderFindFirst.mockResolvedValue(null)
    const res = await kotPOST(jsonPost('http://localhost/api/kot', { orderId: 'nope' }))
    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toMatchObject({ error: 'Naročilo ni najdeno' })
    expect(mocks.txKotCreate).not.toHaveBeenCalled()
  })

  it('P2034 Serializable konflikt → 409 (prej 500)', async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: 'test' }),
    )
    const res = await kotPOST(jsonPost('http://localhost/api/kot', { orderId: ORD }))
    expect(res.status).toBe(409)
  })

  it('P2002 → 409 (pariteta z R107/R109 kontraktom)', async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
    )
    const res = await kotPOST(jsonPost('http://localhost/api/kot', { orderId: ORD }))
    expect(res.status).toBe(409)
  })

  it('Serializable izolacija: $transaction options { isolationLevel: Serializable }', async () => {
    await kotPOST(jsonPost('http://localhost/api/kot', { orderId: ORD }))
    expect(mocks.transaction.mock.calls[0][1]).toMatchObject({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  })

  it('table number tx-fresh: tableNumber iz tabele, če ni podan', async () => {
    await kotPOST(jsonPost('http://localhost/api/kot', { orderId: ORD }))
    expect(mocks.txKotCreate.mock.calls[0][0].data.tableNumber).toBe(5)
  })
})

// ══════════════════════════════════════════════════════════════════
// B. FURS overitveni claim kanon (FURS-1)
// ══════════════════════════════════════════════════════════════════
describe('R111 B: POST /api/furs verify — CAS claim pred zunanjim klicem', () => {
  const VALIDATION = (receiptFiscalVerified = false, receiptStatus = 'none') => ({
    order: { id: ORD, orderNumber: 'ORD-2026-000001', orderItems: [], locationId: LOC_A },
    receipt: { id: 'rcpt-1', fiscalVerified: receiptFiscalVerified, fiscalStatus: receiptStatus, zoi: '', eor: '' },
    settings: { taxId: 'SI123', businessId: 'B1', registerNumber: 'R1' },
    config: { premisesId: 'P1' },
    authResult: { session: { employeeId: 'emp-1' } },
  })

  it('claim: updateMany { id, fiscalVerified: false, OR[fiscalStatus!=verifying | stale] } → fiscalStatus verifying', async () => {
    mocks.validateAndFetchData.mockResolvedValue(VALIDATION())
    await verifyInvoice(jsonPost('http://localhost/api/furs', { orderId: ORD }))
    expect(mocks.receiptUpdateMany).toHaveBeenCalledTimes(1)
    const where = mocks.receiptUpdateMany.mock.calls[0][0].where
    expect(where.id).toBe('rcpt-1')
    expect(where.fiscalVerified).toBe(false)
    expect(where.OR[0]).toMatchObject({ fiscalStatus: { not: 'verifying' } })
    expect(where.OR[1]).toMatchObject({ fiscalStatus: 'verifying', updatedAt: { lt: expect.any(Date) } })
    expect(mocks.receiptUpdateMany.mock.calls[0][0].data).toMatchObject({ fiscalStatus: 'verifying' })
  })

  it('zmagovalec claima (count 1) → FURS klic + handleSuccessfulVerification', async () => {
    mocks.validateAndFetchData.mockResolvedValue(VALIDATION())
    const res = await verifyInvoice(jsonPost('http://localhost/api/furs', { orderId: ORD }))
    expect(mocks.verifyInvoiceWithFURS).toHaveBeenCalledTimes(1)
    expect(mocks.handleSuccessfulVerification).toHaveBeenCalledTimes(1)
    const body = await res.json()
    expect(body).toMatchObject({ success: true, eor: 'eor-x', fiscalVerified: true })
  })

  it('izgubljena tekma + že overjen (re-read fiscalVerified) → 200 idempotenten, NI FURS klica', async () => {
    mocks.validateAndFetchData.mockResolvedValue(VALIDATION())
    mocks.receiptUpdateMany.mockResolvedValue({ count: 0 })
    mocks.receiptFindUnique.mockResolvedValue({ id: 'rcpt-1', fiscalVerified: true, zoi: 'zoi-1', eor: 'eor-1', verificationDate: new Date() })
    const res = await verifyInvoice(jsonPost('http://localhost/api/furs', { orderId: ORD }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toContain('že davčno overjen')
    expect(body.eor).toBe('eor-1')
    expect(mocks.verifyInvoiceWithFURS).not.toHaveBeenCalled()
    expect(mocks.handleSuccessfulVerification).not.toHaveBeenCalled()
  })

  it('izgubljena tekma + še vedno neoverjen → 409 in-flight', async () => {
    mocks.validateAndFetchData.mockResolvedValue(VALIDATION())
    mocks.receiptUpdateMany.mockResolvedValue({ count: 0 })
    mocks.receiptFindUnique.mockResolvedValue({ id: 'rcpt-1', fiscalVerified: false, fiscalStatus: 'verifying' })
    const res = await verifyInvoice(jsonPost('http://localhost/api/furs', { orderId: ORD }))
    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining('že poteka') })
    expect(mocks.verifyInvoiceWithFURS).not.toHaveBeenCalled()
  })

  it('FURS failure → handleFailedVerification (release claima na pending)', async () => {
    mocks.validateAndFetchData.mockResolvedValue(VALIDATION())
    mocks.verifyInvoiceWithFURS.mockResolvedValue({ success: false, error: 'FURS down', isSimulation: false })
    const res = await verifyInvoice(jsonPost('http://localhost/api/furs', { orderId: ORD }))
    expect(res.status).toBe(400)
    expect(mocks.handleFailedVerification).toHaveBeenCalledTimes(1)
  })

  it('izrzenek med verify → handleVerificationError (release claima)', async () => {
    mocks.validateAndFetchData.mockResolvedValue(VALIDATION())
    mocks.verifyInvoiceWithFURS.mockRejectedValue(new Error('timeout'))
    const res = await verifyInvoice(jsonPost('http://localhost/api/furs', { orderId: ORD }))
    expect(res.status).toBe(500)
    expect(mocks.handleVerificationError).toHaveBeenCalledTimes(1)
  })

  it('submitToFurs Response (preklic po claimu) → claim releasan na pending', async () => {
    mocks.validateAndFetchData.mockResolvedValue(VALIDATION())
    mocks.submitToFurs.mockResolvedValue(new Response(JSON.stringify({ error: 'cert' }), { status: 400 }))
    await verifyInvoice(jsonPost('http://localhost/api/furs', { orderId: ORD }))
    // 2. updateMany = release (prvi je bil claim)
    expect(mocks.receiptUpdateMany).toHaveBeenCalledTimes(2)
    expect(mocks.receiptUpdateMany.mock.calls[1][0].data).toMatchObject({ fiscalStatus: 'pending' })
  })

  it('fast-path: že overjen pri fetchu → 200 BREZ claima', async () => {
    mocks.validateAndFetchData.mockResolvedValue(VALIDATION(true, 'verified'))
    const res = await verifyInvoice(jsonPost('http://localhost/api/furs', { orderId: ORD }))
    expect(res.status).toBe(200)
    expect(mocks.receiptUpdateMany).not.toHaveBeenCalled()
    expect(mocks.verifyInvoiceWithFURS).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// C. Loyalty daily-bonus kanon (LA-1)
// ══════════════════════════════════════════════════════════════════
describe('R111 C: loyalty bonus — advisory lock + tx-fresh dedup + SMS po commitu', () => {
  it('podelitev: advisory lock ključ loyalty-bonus:{id}:birthday_bonus:{date} + create + increment + SMS', async () => {
    const result = await triggerBirthdayBonus(ACC, DEFAULT_CONFIG)
    expect(result).toMatchObject({ points: 100, smsSent: true })
    expect(mocks.txExecuteRaw).toHaveBeenCalledTimes(1)
    const lockParam = mocks.txExecuteRaw.mock.calls[0][1]
    expect(lockParam).toBe(`loyalty-bonus:${ACC}:birthday_bonus:${new Date().toISOString().slice(0, 10)}`)
    // tx-fresh dedup check z reason + dnevnim spodnjim boundom
    expect(mocks.txLoyaltyTxFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ loyaltyAccountId: ACC, reason: 'Rojstni dan bonus', createdAt: { gte: expect.any(Date) } }),
      }),
    )
    expect(mocks.txLoyaltyTxCreate).toHaveBeenCalledTimes(1)
    expect(mocks.txLoyaltyTxCreate.mock.calls[0][0].data.points).toBe(100)
    expect(mocks.txLoyaltyAccountUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.txLoyaltyAccountUpdate.mock.calls[0][0].data.pointsBalance).toMatchObject({ increment: 100 })
    // SMS + outbox ŠELE PO commitu
    expect(mocks.sendSms).toHaveBeenCalledTimes(1)
    expect(mocks.createOutboxEvent).toHaveBeenCalledTimes(1)
  })

  it('dvojni klic (isti dan) → drugi klic SKIP (brez create, brez SMS)', async () => {
    await triggerBirthdayBonus(ACC, DEFAULT_CONFIG)
    // simuliraj: drugi klic — dedup najde obstoječo transakcijo
    mocks.txLoyaltyTxFindFirst.mockResolvedValue({ id: 'ltx-existing', points: 100 })
    vi.clearAllMocks()
    mocks.loyaltyAccountFindUnique.mockResolvedValue({ id: ACC, customerName: 'Ana', customerPhone: '+38640123456', isActive: true })
    mocks.txExecuteRaw.mockResolvedValue(1)
    mocks.txLoyaltyTxFindFirst.mockResolvedValue({ id: 'ltx-existing', points: 100 })

    const result = await triggerBirthdayBonus(ACC, DEFAULT_CONFIG)
    expect(result).toMatchObject({ points: 0, smsSent: false })
    expect(mocks.txLoyaltyTxCreate).not.toHaveBeenCalled()
    expect(mocks.txLoyaltyAccountUpdate).not.toHaveBeenCalled()
    expect(mocks.sendSms).not.toHaveBeenCalled()
  })

  it('P2034 Serializable konflikt → skip ({ points: 0, smsSent: false }), batch NE pade', async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: 'test' }),
    )
    const result = await triggerBirthdayBonus(ACC, DEFAULT_CONFIG)
    expect(result).toMatchObject({ points: 0, smsSent: false })
    expect(mocks.sendSms).not.toHaveBeenCalled()
  })

  it('winback: 200 točk, reason Win-back bonus, ločen lock ključ', async () => {
    const result = await triggerWinback(ACC, DEFAULT_CONFIG)
    expect(result).toMatchObject({ points: 200, smsSent: true })
    const lockParam = mocks.txExecuteRaw.mock.calls[0][1]
    expect(lockParam).toBe(`loyalty-bonus:${ACC}:winback:${new Date().toISOString().slice(0, 10)}`)
    expect(mocks.txLoyaltyTxCreate.mock.calls[0][0].data.reason).toBe('Win-back bonus')
  })

  it('Serializable izolacija na bonus tx', async () => {
    await triggerBirthdayBonus(ACC, DEFAULT_CONFIG)
    expect(mocks.transaction.mock.calls[0][1]).toMatchObject({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  })

  it('neaktiven račun / brez telefona → skip brez tx', async () => {
    mocks.loyaltyAccountFindUnique.mockResolvedValue({ id: ACC, customerName: 'X', customerPhone: '', isActive: true })
    const result = await triggerBirthdayBonus(ACC, DEFAULT_CONFIG)
    expect(result).toMatchObject({ points: 0, smsSent: false })
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.sendSms).not.toHaveBeenCalled()
  })

  it('onemogočen trigger → zgodnji izhod brez db klicev', async () => {
    const result = await triggerBirthdayBonus(ACC, { ...DEFAULT_CONFIG, triggers: { ...DEFAULT_CONFIG.triggers, birthdayBonus: false } })
    expect(result).toMatchObject({ points: 0, smsSent: false })
    expect(mocks.loyaltyAccountFindUnique).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// D. fs-pini — vir pini (regresija zaščita)
// ══════════════════════════════════════════════════════════════════
describe('R111 D: fs-pini — kanon pini v viru', () => {
  const kotSrc = readFileSync(join(process.cwd(), 'src/app/api/kot/route.ts'), 'utf-8')
  const fursSrc = readFileSync(join(process.cwd(), 'src/app/api/furs/helpers/verify-invoice/core.ts'), 'utf-8')
  const loyaltySrc = readFileSync(join(process.cwd(), 'src/lib/loyalty-automation/index.ts'), 'utf-8')

  it('KOT: Serializable + cancelled guard + P2034 mapping + structuredErrorResponse pini', () => {
    expect(kotSrc).toContain('TransactionIsolationLevel.Serializable')
    expect(kotSrc).toContain("freshOrder.status === 'cancelled'")
    expect(kotSrc).toContain("'P2034'")
    expect(kotSrc).toContain('structuredErrorResponse')
  })

  it('FURS verify: CAS claim (verifying + OR stale reclaim) + 409 in-flight pini', () => {
    expect(fursSrc).toContain("fiscalStatus: 'verifying'")
    expect(fursSrc).toContain("fiscalStatus: { not: 'verifying' }")
    expect(fursSrc).toContain('updatedAt: { lt: staleClaimBefore }')
    expect(fursSrc).toContain('status: 409')
  })

  it('loyalty: advisory lock + Serializable + P2034 skip + SMS po commitu pini', () => {
    expect(loyaltySrc).toContain('pg_advisory_xact_lock')
    expect(loyaltySrc).toContain('loyalty-bonus:')
    expect(loyaltySrc).toContain('TransactionIsolationLevel.Serializable')
    expect(loyaltySrc).toContain("'P2034'")
    expect(loyaltySrc).toContain('ŠELE PO commitu')
  })
})
