// ============================================
// R82-A/R82-B — PLATFORM-ADMIN GATES — regression matrix
//
// Pokriva 2 potrjeni R81 leftover luknji (uporabnikov audit maina):
//
// 1. R82-A — /api/subscription/invoices GET/POST/PATCH:
//    'permission: admin' je pokrival tudi lokacijsko vezane admine:
//    - GET: računi VSEH tenantov (fakturacija, zneski)
//    - POST: generiranje računa za katero koli naročnino
//    - PATCH: status='paid' AKTIVIRA naročnino (trial → active) —
//      lokacijski admin si je lahko sam podaljšal SaaS dostop.
//    Fix: platform-admin gate (mirror /api/subscription, R81).
//
// 2. R82-B — /api/receipts/rebuild POST:
//    globalna maintenance operacija (findMany čez VSE receipte +
//    update) za vsakga 'admin'. Fix: platform-admin ONLY, gate PRED
//    vsakim db klicem (DB reads = 0, če je blokiran).
//
// Regresijska matrika (role × locationId):
//   admin       + locationId → 403 (DB reads = 0)
//   super_admin + locationId → 403 (DB reads = 0)  ← lokacija pomeni tenant admin
//   admin       + null       → 200/201 (platform admin)
//   super_admin + null       → 200/201 (platform admin)
//
// Mock pristop: kot r81-scope-hardening.test.ts — vi.hoisted + vi.mock
// '@/lib/db' in '@/lib/auth-middleware', direkten klic route handlerjev.
// zod validacija + api-utils + decimal ostanejo REALNI.
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocki (vi.hoisted zaradi vitest hoisting) ---
const {
  mockRequireAuth,
  mockInvoiceFindMany,
  mockInvoiceCreate,
  mockInvoiceUpdate,
  mockSubscriptionFindUnique,
  mockSubscriptionUpdate,
  mockGetNextCounter,
  mockReceiptFindMany,
  mockReceiptUpdate,
  mockOrderFindUnique,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockInvoiceFindMany: vi.fn(),
  mockInvoiceCreate: vi.fn(),
  mockInvoiceUpdate: vi.fn(),
  mockSubscriptionFindUnique: vi.fn(),
  mockSubscriptionUpdate: vi.fn(),
  mockGetNextCounter: vi.fn(),
  mockReceiptFindMany: vi.fn(),
  mockReceiptUpdate: vi.fn(),
  mockOrderFindUnique: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mockRequireAuth,
}))

// Eksplicitni db mock (overrides globalni Proxy mock iz tests/setup.ts) —
// da lahko trdimo KATERE poizvedbe so (ne) izvedene.
vi.mock('@/lib/db', () => ({
  db: {
    subscriptionInvoice: {
      findMany: mockInvoiceFindMany,
      create: mockInvoiceCreate,
      update: mockInvoiceUpdate,
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    subscription: {
      findUnique: mockSubscriptionFindUnique,
      update: mockSubscriptionUpdate,
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    receipt: {
      findMany: mockReceiptFindMany,
      update: mockReceiptUpdate,
    },
    order: {
      findUnique: mockOrderFindUnique,
    },
  },
}))

vi.mock('@/lib/counters', () => ({
  getNextCounter: mockGetNextCounter,
}))

import { GET as getInvoices, POST as postInvoices, PATCH as patchInvoices } from '@/app/api/subscription/invoices/route'
import { POST as postRebuild } from '@/app/api/receipts/rebuild/route'

// --- Helperji ---
function makeSession(locationId: string | null, role = 'admin') {
  return { employeeId: 'emp-1', role, locationId, permissions: ['admin'] }
}

function mockAuth(locationId: string | null, role = 'admin') {
  mockRequireAuth.mockResolvedValue({ session: makeSession(locationId, role), error: null })
}

function makeGetReq(): Request {
  return new Request('http://localhost:3000/api/subscription/invoices', { method: 'GET' })
}

function makePostReq(body: unknown): Request {
  return new Request('http://localhost:3000/api/subscription/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makePatchReq(body: unknown): Request {
  return new Request('http://localhost:3000/api/subscription/invoices', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeRebuildReq(): Request {
  return new Request('http://localhost:3000/api/receipts/rebuild', { method: 'POST' })
}

const INVOICE_BODY = { subscriptionId: 'sub-1', periodStart: '2026-01-01', periodEnd: '2026-01-31' }

// ============================================
// 1) R82-A — subscription/invoices: regresijska matrika
// ============================================
describe('R82-A: /api/subscription/invoices platform-admin gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --- GET ---
  it('GET: lokacijsko vezan admin (loc-1) → 403, DB reads = 0', async () => {
    mockAuth('loc-1')

    const res = await getInvoices(makeGetReq())
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toContain('platformni administrator')
    expect(mockInvoiceFindMany).not.toHaveBeenCalled()
  })

  it('GET: super_admin Z lokacijo → 403 (lokacija pomeni tenant admin)', async () => {
    mockAuth('loc-1', 'super_admin')

    const res = await getInvoices(makeGetReq())

    expect(res.status).toBe(403)
    expect(mockInvoiceFindMany).not.toHaveBeenCalled()
  })

  it('GET: admin BREZ lokacije (platform admin) → 200', async () => {
    mockAuth(null)
    mockInvoiceFindMany.mockResolvedValue([])

    const res = await getInvoices(makeGetReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.invoices).toEqual([])
    expect(mockInvoiceFindMany).toHaveBeenCalledTimes(1)
  })

  it('GET: super_admin BREZ lokacije → 200', async () => {
    mockAuth(null, 'super_admin')
    mockInvoiceFindMany.mockResolvedValue([{ id: 'inv-1', totalAmount: 35.38 }])

    const res = await getInvoices(makeGetReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.invoices).toHaveLength(1)
  })

  // --- POST ---
  it('POST: lokacijsko vezan admin → 403, naročnina se NE lookupa, račun se NE ustvari', async () => {
    mockAuth('loc-1')

    const res = await postInvoices(makePostReq(INVOICE_BODY))

    expect(res.status).toBe(403)
    expect(mockSubscriptionFindUnique).not.toHaveBeenCalled()
    expect(mockInvoiceCreate).not.toHaveBeenCalled()
    expect(mockGetNextCounter).not.toHaveBeenCalled()
  })

  it('POST: super_admin Z lokacijo → 403', async () => {
    mockAuth('loc-1', 'super_admin')

    const res = await postInvoices(makePostReq(INVOICE_BODY))

    expect(res.status).toBe(403)
    expect(mockInvoiceCreate).not.toHaveBeenCalled()
  })

  it('POST: platform admin → 201, račun ustvarjen', async () => {
    mockAuth(null)
    mockSubscriptionFindUnique.mockResolvedValue({ id: 'sub-1', monthlyPrice: 29, currency: 'EUR' })
    mockGetNextCounter.mockResolvedValue(7)
    mockInvoiceCreate.mockResolvedValue({ id: 'inv-new', invoiceNumber: 'NAR-202601-0007', totalAmount: 35.38 })

    const res = await postInvoices(makePostReq(INVOICE_BODY))

    expect(res.status).toBe(201)
    expect(mockSubscriptionFindUnique).toHaveBeenCalledWith({ where: { id: 'sub-1' } })
    expect(mockInvoiceCreate).toHaveBeenCalledTimes(1)
  })

  // --- PATCH (najnevarnejši: 'paid' aktivira naročnino) ---
  it('PATCH: lokacijski admin status=paid → 403, update + aktivacija se NE izvedeta', async () => {
    mockAuth('loc-1')

    const res = await patchInvoices(makePatchReq({ id: 'inv-1', status: 'paid' }))

    expect(res.status).toBe(403)
    expect(mockInvoiceUpdate).not.toHaveBeenCalled()
    expect(mockSubscriptionFindUnique).not.toHaveBeenCalled()
    expect(mockSubscriptionUpdate).not.toHaveBeenCalled()
  })

  it('PATCH: super_admin Z lokacijo → 403', async () => {
    mockAuth('loc-1', 'super_admin')

    const res = await patchInvoices(makePatchReq({ id: 'inv-1', status: 'paid' }))

    expect(res.status).toBe(403)
    expect(mockInvoiceUpdate).not.toHaveBeenCalled()
  })

  it('PATCH: platform admin status=overdue → 200, update izveden', async () => {
    mockAuth(null)
    mockInvoiceUpdate.mockResolvedValue({ id: 'inv-1', subscriptionId: 'sub-1', status: 'overdue' })

    const res = await patchInvoices(makePatchReq({ id: 'inv-1', status: 'overdue' }))

    expect(res.status).toBe(200)
    expect(mockInvoiceUpdate).toHaveBeenCalledTimes(1)
    // overdue NE sproži aktivacijske poti
    expect(mockSubscriptionFindUnique).not.toHaveBeenCalled()
  })
})

// ============================================
// 2) R82-B — receipts/rebuild: platform-admin only
// ============================================
describe('R82-B: /api/receipts/rebuild platform-admin gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST: lokacijsko vezan admin → 403, DB reads = 0 (gate PRED findMany)', async () => {
    mockAuth('loc-1')

    const res = await postRebuild(makeRebuildReq())
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toContain('platformni administrator')
    // Ključna asercija: NIČ db klicev, če je blokiran
    expect(mockReceiptFindMany).not.toHaveBeenCalled()
    expect(mockOrderFindUnique).not.toHaveBeenCalled()
    expect(mockReceiptUpdate).not.toHaveBeenCalled()
  })

  it('POST: super_admin Z lokacijo → 403, DB reads = 0', async () => {
    mockAuth('loc-1', 'super_admin')

    const res = await postRebuild(makeRebuildReq())

    expect(res.status).toBe(403)
    expect(mockReceiptFindMany).not.toHaveBeenCalled()
    expect(mockReceiptUpdate).not.toHaveBeenCalled()
  })

  it('POST: platform admin + nič za rebuildat → 200, processed=0', async () => {
    mockAuth(null)
    mockReceiptFindMany.mockResolvedValue([])

    const res = await postRebuild(makeRebuildReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.processed).toBe(0)
    expect(body.updated).toBe(0)
    expect(mockReceiptFindMany).toHaveBeenCalledTimes(1)
  })

  it('POST: platform admin + prazni vatBreakdown → 200, update izveden (vatBreakdown izračunan)', async () => {
    mockAuth(null)
    mockReceiptFindMany.mockResolvedValue([
      { id: 'r-1', receiptNumber: 'R-1', orderId: 'o-1', vatBreakdown: '' },
    ])
    mockOrderFindUnique.mockResolvedValue({
      id: 'o-1',
      orderItems: [
        { voided: false, price: 10, quantity: 2, vatRate: 22, vatAmount: 0, menuItem: { vatRate: 22 } },
      ],
    })
    mockReceiptUpdate.mockResolvedValue({ id: 'r-1' })

    const res = await postRebuild(makeRebuildReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.processed).toBe(1)
    expect(body.updated).toBe(1)
    expect(mockOrderFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'o-1' } }),
    )
    const updateArg = mockReceiptUpdate.mock.calls[0][0]
    expect(updateArg.where).toEqual({ id: 'r-1' })
    expect(JSON.parse(updateArg.data.vatBreakdown)).toEqual({
      '22': { base: 20, vat: 4.4 },
    })
  })

  it('POST: platform admin + napaka pri enem receiptu → ostali nadaljevani, failed=1', async () => {
    mockAuth(null)
    mockReceiptFindMany.mockResolvedValue([
      { id: 'r-1', receiptNumber: 'R-1', orderId: 'o-missing', vatBreakdown: '' },
      { id: 'r-2', receiptNumber: 'R-2', orderId: 'o-2', vatBreakdown: '' },
    ])
    mockOrderFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === 'o-2') {
        return {
          id: 'o-2',
          orderItems: [
            { voided: false, price: 10, quantity: 1, vatRate: 22, vatAmount: 0, menuItem: { vatRate: 22 } },
          ],
        }
      }
      return null
    })
    mockReceiptUpdate.mockResolvedValue({ id: 'r-2' })

    const res = await postRebuild(makeRebuildReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.updated).toBe(1)
    expect(body.failed).toBe(1)
    expect(mockReceiptUpdate).toHaveBeenCalledTimes(1)
    expect(mockReceiptUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'r-2' } }))
  })
})
