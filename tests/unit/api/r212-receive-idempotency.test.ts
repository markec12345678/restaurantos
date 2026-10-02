// ============================================
// #152 G7 (R212) — PO RECEIVE IDEMPOTENCY (R116 kanon)
// ============================================
// Vrzel G7 (docs/INVENTORY-CHAIN.md §5): POST /api/purchase-orders/[id]/receive
// ni sprejel klientega idempotencyKey — retry/ponovljen prevzem z ISTIMI
// količinami po statusu `partial` je po oblikovanju prištel zalogo DVAKRAT
// (terminal-status guard + cap-check sta edini zavori).
//
// FIX (R212): route sprejme opcijski idempotencyKey (trim → NULL), posreduje
// ga receivePurchaseOrderItems kanonu (replay check POD per-PO advisory
// lockom, PRED terminalnimi zaščitami) in izpostavi `replay` flag v
// odgovoru + audit detailih (hišni vzorec waste/batch-prep).
//
// Tukaj ROUTE-nivo: key parsing/passthrough/replay wire kontrakt. Kanon
// semantika (replay = ISTI GRN, EN efekt) je dokazana v IT drillu
// (tests/integration/r209-inventory-chain-drill.test.ts — R212 G7 describe).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const m = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  resolveTenantLocationIdOrThrow: vi.fn(),
  receivePurchaseOrderItems: vi.fn(),
  createAuditLog: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: (...args: unknown[]) => m.requireAuth(...args),
  resolveTenantLocationIdOrThrow: (...args: unknown[]) => m.resolveTenantLocationIdOrThrow(...args),
}))

vi.mock('@/lib/db', () => ({
  db: {
    employee: { findUnique: vi.fn().mockResolvedValue({ name: 'R212 Test Skladovnik' }) },
  },
  createAuditLog: (...args: unknown[]) => m.createAuditLog(...args),
}))

vi.mock('@/app/api/purchase-orders/[id]/_helpers', () => ({
  receivePurchaseOrderItems: (...args: unknown[]) => m.receivePurchaseOrderItems(...args),
}))

import { POST } from '@/app/api/purchase-orders/[id]/receive/route'

function authOk() {
  return {
    session: { employeeId: 'emp-1', locationId: 'loc-1' },
    error: null,
  }
}

function makeReq(body: unknown): Request {
  return new Request('http://localhost:3000/api/purchase-orders/po-1/receive', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer unit' },
    body: JSON.stringify(body),
  })
}

const HELPER_RESULT = {
  po: { poNumber: 'ND-2026-000001', status: 'partial' },
  allReceived: false,
  anyPartial: true,
  grn: { id: 'grn-1', grnNumber: 'GR-2026-000001', status: 'confirmed', supplierDocNumber: 'DOB-1' },
  replay: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  m.requireAuth.mockResolvedValue(authOk())
  m.resolveTenantLocationIdOrThrow.mockReturnValue({ locationId: 'loc-1' })
  m.receivePurchaseOrderItems.mockResolvedValue(HELPER_RESULT)
  m.createAuditLog.mockResolvedValue({})
})

describe('POST /api/purchase-orders/[id]/receive — idempotencyKey passthrough (#152 G7, R212)', () => {
  it('posreduje TRIMAN ključ receivePurchaseOrderItems kanonu (call-arg pin)', async () => {
    const res = await POST(
      makeReq({ receivedItems: [{ itemId: 'i-1', quantityReceived: 2 }], idempotencyKey: '  key-1  ' }),
      { params: Promise.resolve({ id: 'po-1' }) },
    )
    expect(res.status).toBe(200)
    expect(m.receivePurchaseOrderItems).toHaveBeenCalledTimes(1)
    expect(m.receivePurchaseOrderItems).toHaveBeenCalledWith(
      expect.objectContaining({ poId: 'po-1', idempotencyKey: 'key-1' }),
    )
  })

  it('brez ključa / whitespace-only → idempotencyKey NULL (legacy vedenje bit-for-bit)', async () => {
    await POST(makeReq({ receivedItems: [{ itemId: 'i-1', quantityReceived: 2 }] }), {
      params: Promise.resolve({ id: 'po-1' }),
    })
    expect(m.receivePurchaseOrderItems).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: null }))

    await POST(makeReq({ receivedItems: [{ itemId: 'i-1', quantityReceived: 2 }], idempotencyKey: '   ' }), {
      params: Promise.resolve({ id: 'po-1' }),
    })
    expect(m.receivePurchaseOrderItems).toHaveBeenLastCalledWith(expect.objectContaining({ idempotencyKey: null }))
  })

  it('replay:true → 200 body.replay + replay message; audit details nosi replay flag (hišni vzorec waste/batch-prep)', async () => {
    m.receivePurchaseOrderItems.mockResolvedValue({ ...HELPER_RESULT, replay: true })
    const res = await POST(
      makeReq({ receivedItems: [{ itemId: 'i-1', quantityReceived: 2 }], idempotencyKey: 'key-1' }),
      { params: Promise.resolve({ id: 'po-1' }) },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { replay: boolean; message: string; grn: { grnNumber: string } }
    expect(body.replay).toBe(true)
    expect(body.message).toContain('replay')
    expect(body.grn.grnNumber).toBe('GR-2026-000001')

    // Audit se piše tudi na replay-u (retry poskus revizijsko viden, efekt EN)
    expect(m.createAuditLog).toHaveBeenCalledTimes(1)
    const auditArg = m.createAuditLog.mock.calls[0][0] as { details: { replay: boolean } }
    expect(auditArg.details.replay).toBe(true)
  })

  it('replay:false → body.replay false, audit details.replay false (additivno, wire kontrakt nespremenjen)', async () => {
    const res = await POST(
      makeReq({ receivedItems: [{ itemId: 'i-1', quantityReceived: 2 }], idempotencyKey: 'key-2' }),
      { params: Promise.resolve({ id: 'po-1' }) },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { replay: boolean }
    expect(body.replay).toBe(false)
    const auditArg = m.createAuditLog.mock.calls[0][0] as { details: { replay: boolean } }
    expect(auditArg.details.replay).toBe(false)
  })

  it('ključ > 100 znakov → 400 validacija (zod meja, helper NI klican)', async () => {
    const res = await POST(
      makeReq({ receivedItems: [{ itemId: 'i-1', quantityReceived: 2 }], idempotencyKey: 'k'.repeat(101) }),
      { params: Promise.resolve({ id: 'po-1' }) },
    )
    expect(res.status).toBe(400)
    expect(m.receivePurchaseOrderItems).not.toHaveBeenCalled()
  })
})
