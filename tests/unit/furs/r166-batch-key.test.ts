// ============================================
// R166 F1 — BATCH ZOI KLJUČ PASSTHROUGH (P2, latentni sim→real bloker)
// ============================================
// Prej: batch/route.ts:122 `instanceof Buffer` je ZAVRNIL string PEM (primarna
// OpenSSL pot loaderja vrača string) → processBatchReceipt je dobil undefined →
// generateZOI brez ključa → prod: throw / test: neskladen SHA-256 fallback ZOI.
// Fix: union `string | Buffer | undefined` skozi cache + _helpers param.
//
// Pin: passthrough tipa ključa v generateZOI 2. argument (mockan barrel) —
// string NE SME biti izgubljen, Buffer NE SME biti izgubljen.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  generateZOI: vi.fn(),
  verifyInvoiceWithFURS: vi.fn(),
  receiptUpdate: vi.fn(),
}))

vi.mock('@/lib/furs', () => ({
  generateZOI: mocks.generateZOI,
  verifyInvoiceWithFURS: mocks.verifyInvoiceWithFURS,
}))

vi.mock('@/lib/db', () => ({
  db: { receipt: { update: mocks.receiptUpdate } },
}))

import { processBatchReceipt } from '@/app/api/furs/batch/_helpers'

vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const CONFIG = {
  businessId: 'B12345678',
  taxId: 'SI12345678',
  registerId: 'BLG-001',
  premisesId: 'P001',
  deviceIp: '',
  environment: 'test' as const,
  certPath: '/certs/x.p12',
  certPassword: 'pw',
}

const SETTINGS = { taxId: 'SI12345678', registerNumber: 'BLG-001' }

const RECEIPT = {
  id: 'r1',
  receiptNumber: '1',
  createdAt: new Date('2026-09-29T12:00:00Z'),
  total: 10,
  paymentMethod: 'cash',
  vatBreakdown: {},
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.generateZOI.mockReturnValue('ZOI-MOCK')
  mocks.receiptUpdate.mockResolvedValue({})
  mocks.verifyInvoiceWithFURS.mockResolvedValue({
    success: true, zoi: 'Z', eor: 'E',
    verifiedAt: new Date(), isSimulation: false, environment: 'test',
  })
})

describe('R166 F1: processBatchReceipt — ključ passthrough v generateZOI', () => {
  it('string PEM ključ → generateZOI dobi STRING (prej Buffer-only zavrnil)', async () => {
    const key = '-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----\n'
    const result = await processBatchReceipt(RECEIPT, SETTINGS, CONFIG, key)
    expect(result.success).toBe(true)
    expect(mocks.generateZOI).toHaveBeenCalledTimes(1)
    expect(mocks.generateZOI.mock.calls[0][1]).toBe(key) // passthrough, NI izgubljen
  })

  it('Buffer ključ → generateZOI dobi isti Buffer', async () => {
    const key = Buffer.from('pem-bytes')
    await processBatchReceipt(RECEIPT, SETTINGS, CONFIG, key)
    expect(mocks.generateZOI.mock.calls[0][1]).toBe(key)
  })

  it('undefined ključ → generateZOI dobi undefined (fallback pot ostaja)', async () => {
    await processBatchReceipt(RECEIPT, SETTINGS, CONFIG, undefined)
    expect(mocks.generateZOI.mock.calls[0][1]).toBeUndefined()
  })
})
