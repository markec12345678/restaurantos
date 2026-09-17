// ============================================
// CIS TEST INVOICE — API route + UI mapper testi (runda 28)
//
// Pokritost:
// - POST /api/cis/test-invoice handler (direktno, brez HTTP strežnika):
//   * uspeh → 200 ok=true + jir + environment
//   * P12 ni nastavljen → 400, sendRacunZahtjev NE klican
//   * P12 ne berljiv (loadCisP12 → null) → 400
//   * ok=false s serverErrorCode → 200 (veljaven izid, ne API napaka)
//   * OIB override iz body-a; napačen OIB → 400 (zod)
//   * environment override iz body-a; fallback iz nastavitev
//   * brez nastavitev v bazi → 400
// - mapCisSendResponseToStatus (čista fn za CisTab panel):
//   * 400 konfiguracija / JIR uspeh / serverErrorCode / validacija /
//     transport / defenzivni primer
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocki PRED importom route-a ---
const findFirstMock = vi.fn()
const sendRacunZahtjevMock = vi.fn()
const loadCisP12Mock = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    restaurantSettings: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
    },
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: vi.fn(async () => ({
    session: { employeeId: 'emp-1', locationId: 'loc-1', role: 'admin' },
  })),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: vi.fn(async () => ({ allowed: true, remaining: 59 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  AUTHENTICATED_LIMIT: 60,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/cis', () => ({
  sendRacunZahtjev: (...args: unknown[]) => sendRacunZahtjevMock(...args),
  loadCisP12: (...args: unknown[]) => loadCisP12Mock(...args),
}))

import { POST } from '@/app/api/cis/test-invoice/route'
import { mapCisSendResponseToStatus, type CisSendResponse } from '@/components/pos/settings/cis-send-status'

const settingsWithCert = {
  id: 's1',
  isActive: true,
  taxId: 'SI12345678901',
  cisEnvironment: 'test',
  cisCertPath: '/certs/fina-demo.p12',
  cisCertPassword: 'secret',
}

function post(body?: unknown): Request {
  return new Request('http://localhost:3000/api/cis/test-invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  findFirstMock.mockResolvedValue(settingsWithCert)
  loadCisP12Mock.mockReturnValue({
    certificatePem: '-----BEGIN CERTIFICATE-----\nX\n-----END CERTIFICATE-----',
    privateKeyPem: '-----BEGIN PRIVATE KEY-----\nY\n-----END PRIVATE KEY-----',
  })
})

describe('POST /api/cis/test-invoice', () => {
  it('uspešna oddaja → 200, ok=true, jir, environment iz nastavitev', async () => {
    sendRacunZahtjevMock.mockResolvedValue({
      ok: true, jir: '17012345678901234', zki: 'a'.repeat(32), idPoruke: 'u-1',
      responseTime: 123, httpStatus: 200, signedEnvelope: '<xml/>',
    })

    const res = await POST(post({}))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.jir).toBe('17012345678901234')
    expect(data.environment).toBe('test')
    expect(data.testedAt).toBeTruthy()

    // OIB je izluščen iz taxId (SI12345678901 → 12345678901)
    const callArgs = sendRacunZahtjevMock.mock.calls[0]
    expect(callArgs[1].oib).toBe('12345678901')
    expect(callArgs[1].iznosUkupno).toBe('10.00') // sintetičen znesek
    // P12 parametri so PEM-i iz loadCisP12
    expect(callArgs[2].certificatePem).toContain('BEGIN CERTIFICATE')
    // loadCisP12 je dobil pot + geslo iz nastavitev
    expect(loadCisP12Mock).toHaveBeenCalledWith('/certs/fina-demo.p12', 'secret')
  })

  it('brez P12 konfiguracije → 400, sendRacunZahtjev NE klican', async () => {
    findFirstMock.mockResolvedValue({ ...settingsWithCert, cisCertPath: '', cisCertPassword: '' })

    const res = await POST(post({}))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('P12')
    expect(sendRacunZahtjevMock).not.toHaveBeenCalled()
  })

  it('P12 ne berljiv (loadCisP12 → null) → 400', async () => {
    loadCisP12Mock.mockReturnValue(null)

    const res = await POST(post({}))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('prebrati')
    expect(sendRacunZahtjevMock).not.toHaveBeenCalled()
  })

  it('strežnik zavrnil (ok=false + serverErrorCode) → 200 z ok=false', async () => {
    sendRacunZahtjevMock.mockResolvedValue({
      ok: false, serverErrorCode: 'b001', errorMessage: 'Neispravan OIB',
      idPoruke: 'u-2', httpStatus: 200,
    })

    const res = await POST(post({}))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(false)
    expect(data.serverErrorCode).toBe('b001')
    expect(data.errorMessage).toBe('Neispravan OIB')
  })

  it('OIB override iz body-a pride do sendRacunZahtjev', async () => {
    sendRacunZahtjevMock.mockResolvedValue({ ok: true, jir: '17012345678901234', idPoruke: 'u-3' })

    await POST(post({ oib: '98765432100' }))

    expect(sendRacunZahtjevMock.mock.calls[0][1].oib).toBe('98765432100')
  })

  it('napačen OIB v body-u → 400 (zod validacija)', async () => {
    const res = await POST(post({ oib: '123' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('OIB')
  })

  it('environment override iz body-a ima prednost pred nastavitvami', async () => {
    sendRacunZahtjevMock.mockResolvedValue({ ok: true, jir: '17012345678901234', idPoruke: 'u-4' })

    await POST(post({ environment: 'production' }))

    expect(sendRacunZahtjevMock.mock.calls[0][0]).toBe('production')
  })

  it('brez nastavitev v bazi → 400', async () => {
    findFirstMock.mockResolvedValue(null)

    const res = await POST(post({}))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Nastavitve')
  })
})

describe('mapCisSendResponseToStatus', () => {
  it('400 konfiguracijska napaka → error z API sporočilom', () => {
    const res = mapCisSendResponseToStatus({ error: 'FINA P12 certifikat ni nastavljen' })
    expect(res.status).toBe('error')
    expect(res.message).toContain('P12')
  })

  it('uspeh → connected + JIR v sporočilu in polju', () => {
    const res = mapCisSendResponseToStatus({
      ok: true, jir: '17012345678901234', responseTime: 250, environment: 'test',
    } as CisSendResponse)
    expect(res.status).toBe('connected')
    expect(res.jir).toBe('17012345678901234')
    expect(res.message).toContain('17012345678901234')
    expect(res.message).toContain('TESTNO')
    expect(res.message).toContain('250 ms')
  })

  it('serverErrorCode → error s kodo in PorukaGreske', () => {
    const res = mapCisSendResponseToStatus({
      ok: false, serverErrorCode: 'b001', errorMessage: 'Neispravan OIB', environment: 'production',
    } as CisSendResponse)
    expect(res.status).toBe('error')
    expect(res.message).toContain('b001')
    expect(res.message).toContain('Neispravan OIB')
    expect(res.message).toContain('PRODUKCIJA')
  })

  it('validacijske napake → error s prvo napako + števec', () => {
    const res = mapCisSendResponseToStatus({
      ok: false,
      validation: { valid: false, errors: ['OIB je obvezen', 'Znesek je obvezen'], warnings: [] },
    } as CisSendResponse)
    expect(res.status).toBe('error')
    expect(res.message).toContain('OIB je obvezen')
    expect(res.message).toContain('+1')
  })

  it('transport napaka → error', () => {
    const res = mapCisSendResponseToStatus({
      ok: false, errorMessage: 'Timeout po 10000 ms', environment: 'test',
    } as CisSendResponse)
    expect(res.status).toBe('error')
    expect(res.message).toContain('Timeout')
  })

  it('defenzivni primer (ok=true brez JIR) → error', () => {
    const res = mapCisSendResponseToStatus({ ok: true, environment: 'test' } as CisSendResponse)
    expect(res.status).toBe('error')
    expect(res.message).toContain('Nepričakovan')
  })
})
