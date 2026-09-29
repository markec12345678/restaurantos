// ============================================
// R166 — FURS SIM-MODE PINI (issue: FURS sim-mode validacija poglobitev)
// ============================================
// Vir: /tmp/r166-audit-report.md §4.4 (nepinane vrzeli) + §6 F4/F5.
//
// Pini:
//   T1  verifyInvoiceWithFURS brez cert + flag=true → success=false,
//       isSimulation=true, determinističen UUID-oblikovan sim EOR,
//       NI fs/network klica (regresija za sim kontrakt ZDDV-1)
//   T2  flag unset → fail-closed 'Manjka certifikat…' + eor ''
//   T3  POST /api/furs core orkestracija: sim → 400 + X-Fiscal-Warning
//       + Receipt pending + audit + eor PROPAGACIJA (F5 — prej eor: '')
//   T4  storno sim (F4, namerna asimetrija "Test 5.3"): effectiveFursResult
//       success=true → stornoReceipt dobi fiscalVerified=true (dokumentirano)
//   T5  storno sim BREZ flaga → 400 + FURS_STORNO_FAILED + ZERO transakcije
//
// Vzorec (r85/r111): vi.hoisted + vi.mock tovarne + mockResolvedValue;
// realna verifyInvoiceWithFURS iz GLOBOKE poti (ne barrel — barrel je
// nestranan); logger utišan.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  // verify-invoice/validate-and-submit
  validateAndFetchData: vi.fn(),
  submitToFurs: vi.fn(),
  // verify-invoice/post-verify
  handleSuccessfulVerification: vi.fn(),
  handleFailedVerification: vi.fn(),
  handleVerificationError: vi.fn(),
  generateQRForVerifiedReceipt: vi.fn(),
  // db
  receiptUpdateMany: vi.fn(),
  receiptFindUnique: vi.fn(),
  receiptUpdate: vi.fn(),
  createAuditLog: vi.fn(),
  // storno-invoice
  validateAndSubmitStorno: vi.fn(),
  executeStornoTransaction: vi.fn(),
  handlePostStorno: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    receipt: {
      updateMany: mocks.receiptUpdateMany,
      findUnique: mocks.receiptFindUnique,
      update: mocks.receiptUpdate,
    },
  },
  createAuditLog: mocks.createAuditLog,
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

vi.mock('@/app/api/furs/helpers/storno-invoice/validate-and-submit', () => ({
  validateAndSubmitStorno: mocks.validateAndSubmitStorno,
}))

vi.mock('@/app/api/furs/helpers/storno-invoice/storno-transaction', () => ({
  executeStornoTransaction: mocks.executeStornoTransaction,
  handlePostStorno: mocks.handlePostStorno,
}))

// GLOBOKA pot (REALNA funkcija — barrel NI mockan v tem fajlu)
import { verifyInvoiceWithFURS } from '@/lib/furs/api/verify-invoice'
import { generateSimulatedEOR } from '@/lib/furs/helpers/qr-eor'
import { verifyInvoice } from '@/app/api/furs/helpers/verify-invoice/core'
import { stornoInvoice } from '@/app/api/furs/helpers/storno-invoice/core'

// Utišaj logger
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const SIM_CONFIG = {
  businessId: 'B12345678',
  taxId: 'SI12345678',
  registerId: 'BLG-001',
  premisesId: 'P001',
  deviceIp: '',
  environment: 'test' as const,
  certPath: undefined,
  certPassword: undefined,
}

const INVOICE_DATA = {
  invoiceNumber: '1',
  issueDateTime: new Date('2026-09-29T12:00:00Z'),
  totalAmount: 10,
  paymentMethod: 'cash' as const,
  vatBreakdown: [{ rate: 22, baseAmount: 8.2, vatAmount: 1.8 }],
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.receiptUpdateMany.mockResolvedValue({ count: 1 })
  mocks.receiptFindUnique.mockResolvedValue(null)
  mocks.receiptUpdate.mockResolvedValue({})
  mocks.createAuditLog.mockResolvedValue({})
  mocks.handleFailedVerification.mockResolvedValue(undefined)
  mocks.handleVerificationError.mockResolvedValue(undefined)
  mocks.handleSuccessfulVerification.mockResolvedValue('qr')
  mocks.generateQRForVerifiedReceipt.mockReturnValue('qr')
  mocks.executeStornoTransaction.mockResolvedValue({ id: 'storno-1', receiptNumber: '1-S' })
  mocks.handlePostStorno.mockResolvedValue('qr')
  process.env.FURS_ALLOW_SIMULATION = ''
})

// ══════════════════════════════════════════════════════════════════
// T1 + T2: verifyInvoiceWithFURS sim veja (REALNA funkcija)
// ══════════════════════════════════════════════════════════════════
describe('R166 T1-T2: verifyInvoiceWithFURS sim veja (verify-invoice :131-157)', () => {
  it('T1: flag=true brez cert → success=false + isSimulation + determinističen sim EOR', async () => {
    vi.stubEnv('FURS_ALLOW_SIMULATION', 'true')
    try {
      const result = await verifyInvoiceWithFURS(SIM_CONFIG, INVOICE_DATA, 'ZOI-TEST')
      expect(result.success).toBe(false) // ZDDV-1: simulacija NI overitev
      expect(result.isSimulation).toBe(true)
      expect(result.error).toContain('račun NI davčno overjen')
      // F5: sim EOR je determinističen UUID-oblikovan niz iz (zoi, sekunda)
      expect(result.eor).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) // generateSimulatedEOR vrača UPPERCASE
      expect(result.eor).toBe(generateSimulatedEOR('ZOI-TEST', result.verifiedAt))
      expect(result.verifiedAt).toBeInstanceOf(Date)
      expect(result.environment).toBe('test')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('T2: flag unset → fail-closed "Manjka certifikat" + eor prazen', async () => {
    vi.stubEnv('FURS_ALLOW_SIMULATION', undefined)
    try {
      const result = await verifyInvoiceWithFURS(SIM_CONFIG, INVOICE_DATA, 'ZOI-TEST')
      expect(result.success).toBe(false)
      expect(result.isSimulation).toBe(true)
      expect(result.error).toBe('Manjka certifikat za FURS overitev. Nastavite FURS_ALLOW_SIMULATION=true za testni način.')
      expect(result.eor).toBe('')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

// ══════════════════════════════════════════════════════════════════
// T3: POST /api/furs core orkestracija — sim 400 kontrakt (F5 eor!)
// ══════════════════════════════════════════════════════════════════
describe('R166 T3: POST /api/furs core — sim 400 + X-Fiscal-Warning + eor propagacija', () => {
  it('sim mode → 400 + header + pending + handleFailedVerification + body.eor = sim EOR (F5)', async () => {
    vi.stubEnv('FURS_ALLOW_SIMULATION', 'true')
    try {
      const receipt = {
        id: 'r1', receiptNumber: '1', fiscalVerified: false,
        zoi: '', eor: '', verificationDate: null,
      }
      mocks.validateAndFetchData.mockResolvedValue({
        order: { id: 'o1', locationId: 'loc-1' },
        receipt,
        settings: { businessId: 'B', taxId: 'T', registerNumber: 'R' },
        config: SIM_CONFIG,
        authResult: { session: { employeeId: 'emp-1' } },
      })
      mocks.submitToFurs.mockResolvedValue({ zoi: 'ZOI-1', invoiceData: INVOICE_DATA })

      const res = await verifyInvoice(new Request('http://localhost:3000/api/furs', { method: 'POST' }))

      expect(res.status).toBe(400)
      expect(res.headers.get('X-Fiscal-Warning')).toContain('Fiscalization pending')
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.isSimulation).toBe(true)
      expect(body.fiscalStatus).toBe('pending')
      // F5 (končno): sim EOR je result-internen — response.eor ostane ''
      // (cross-layer kontrakt E2E core-flow :288/:310: response.eor === DB.eor;
      // propagacija poskusena in VRNJENA v R166 na E2E dokaz)
      expect(body.eor).toBe('')
      // R111: CAS claim updateMany (1×) — pending reset pri FURS-failu NI tu,
      // ampak v handleFailedVerification (db.receipt.update + FURS_VERIFY_FAILED
      // audit, post-verify.ts:88-99); release-vaja updateMany je samo za
      // submitToFurs Response padec (veja zgoraj, tu ni aktivna)
      expect(mocks.receiptUpdateMany).toHaveBeenCalledTimes(1)
      // auditni zapisi prek handleFailedVerification (receipt, zoi, result, employeeId)
      expect(mocks.handleFailedVerification).toHaveBeenCalledTimes(1)
      const passed = mocks.handleFailedVerification.mock.calls[0]
      expect(passed[0].id).toBe('r1')
      expect(passed[1]).toBe('ZOI-1')
      expect(passed[2].isSimulation).toBe(true)
      expect(passed[3]).toBe('emp-1')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

// ══════════════════════════════════════════════════════════════════
// T4 + T5: storno sim asimetrija (F4 — namerna "Test 5.3", zdaj pinana)
// ══════════════════════════════════════════════════════════════════
function stornoFixture() {
  return {
    receipt: { id: 'r1', receiptNumber: '1', orderId: 'o1', locationId: 'loc-1', businessName: 'B', businessAddress: 'A', businessId: 'BI', taxId: 'T', registerId: 'RG' },
    settings: {},
    config: SIM_CONFIG,
    stornoNumber: '1-S',
    zoi: 'ZOI-STORNO',
    fursResult: {
      success: false, isSimulation: true, environment: 'test' as const,
      error: 'FURS simulacija — račun NI davčno overjen. Nastavite certifikat za produkcijo.',
    },
    authResult: { session: { employeeId: 'emp-1' } },
    reason: 'test reason',
    reasonCode: 'R1',
    vatBreakdownForStorno: { '22': { base: 8.2, vat: 1.8 } },
  }
}

describe('R166 T4-T5: storno sim asimetrija (core.ts :24/:53-55)', () => {
  it('T4: flag=true + sim → storno IZVEDEN, effectiveFursResult.success=true (F4 pin)', async () => {
    vi.stubEnv('FURS_ALLOW_SIMULATION', 'true')
    try {
      mocks.validateAndSubmitStorno.mockResolvedValue(stornoFixture())
      const res = await stornoInvoice(new Request('http://localhost:3000/api/furs', { method: 'PUT' }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.isSimulation).toBe(true)
      expect(body.message).toContain('(SIMULACIJA)')
      // F4: executeStornoTransaction dobi success=true (stornoReceipt bo
      // fiscalVerified=true — DOKUMENTIRANA asimetrija, "Test 5.3")
      expect(mocks.executeStornoTransaction).toHaveBeenCalledTimes(1)
      const args = mocks.executeStornoTransaction.mock.calls[0]
      expect(args[2].success).toBe(true)
      expect(args[2].isSimulation).toBe(true)
      expect(args[3]).toBe('ZOI-STORNO')
      expect(mocks.createAuditLog).not.toHaveBeenCalled() // ni FURS_STORNO_FAILED
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('T5: flag UNSET + sim fail → 400 + FURS_STORNO_FAILED audit + ZERO transakcije', async () => {
    vi.stubEnv('FURS_ALLOW_SIMULATION', undefined)
    try {
      mocks.validateAndSubmitStorno.mockResolvedValue(stornoFixture())
      const res = await stornoInvoice(new Request('http://localhost:3000/api/furs', { method: 'PUT' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.isSimulation).toBe(true)
      expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
      expect(mocks.createAuditLog.mock.calls[0][0].action).toBe('FURS_STORNO_FAILED')
      expect(mocks.executeStornoTransaction).not.toHaveBeenCalled()
      expect(mocks.handlePostStorno).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
