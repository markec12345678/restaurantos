// ============================================
// DIGEST SEND — Unit testi (Task 22)
//
// POST /api/reports/digest-send — ročno pošiljanje dnevnega povzetka:
// - ensureDailySummaryLog fail (email onemogočen) → 400 z razlogom
// - neveljaven datum → 400
// - vsi logi 'sent' → skipped:true, BREZ pošiljanja (idempotentnost)
// - pending logi → pošlje vsakemu prejemniku + označi sent
// - failed logi → retry; SMTP fail → označi failed + error v odgovoru
// - mešani rezultati → pravilni sent/failed števci
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ensureDailySummaryLog: vi.fn(),
  fetchDailyDigestData: vi.fn(),
  sendDailyDigestEmail: vi.fn(),
  logsFindMany: vi.fn(),
  logsUpdate: vi.fn(),
  requireAuth: vi.fn(),
  checkRateLimitAsync: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    scheduledEmailLog: {
      findMany: mocks.logsFindMany,
      update: mocks.logsUpdate,
    },
  },
}))

vi.mock('@/lib/email/daily-digest', () => ({
  ensureDailySummaryLog: mocks.ensureDailySummaryLog,
  fetchDailyDigestData: mocks.fetchDailyDigestData,
  sendDailyDigestEmail: mocks.sendDailyDigestEmail,
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: () => '127.0.0.1',
  AUTHENTICATED_LIMIT: {},
}))

vi.mock('@/lib/api-utils', () => ({
  handleApiError: (e: unknown) => ({
    json: async () => ({ error: String(e) }),
    status: 500,
  }),
}))

import { POST } from '@/app/api/reports/digest-send/route'

function makeLog(id: string, recipient: string, status: string) {
  return { id, recipient, status, reportType: 'daily_summary', reportDate: new Date() }
}

function post(body?: unknown) {
  return POST(
    new Request('http://localhost/api/reports/digest-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }) as unknown as globalThis.Request
  )
}

const DIGEST_DATA = { date: '2026-09-16', revenue: 100, ordersCount: 3 }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockResolvedValue({ error: null })
  mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true })
  mocks.fetchDailyDigestData.mockResolvedValue(DIGEST_DATA)
  mocks.logsUpdate.mockResolvedValue({})
})

describe('POST /api/reports/digest-send (Task 22)', () => {
  it('vrne 400, če email ni omogočen (ensure fail z razlogom)', async () => {
    mocks.ensureDailySummaryLog.mockResolvedValue({
      success: false,
      created: 0,
      recipients: [],
      reportDate: '2026-09-16',
      reportType: 'daily_summary',
      reason: 'Email ni konfiguriran (emailEnabled=false ali manjkajo SMTP nastavitve)',
    })

    const res = await post()
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('emailEnabled')
    expect(mocks.sendDailyDigestEmail).not.toHaveBeenCalled()
  })

  it('vrne 400 pri neveljavnem formatu datuma', async () => {
    const res = await post({ date: '16-09-2026' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('YYYY-MM-DD')
  })

  it('skipped, če so vsi logi že sent — brez pošiljanja (idempotentnost)', async () => {
    mocks.ensureDailySummaryLog.mockResolvedValue({
      success: true, created: 0, recipients: ['a@b.si'],
      reportDate: '2026-09-16', reportType: 'daily_summary', skipped: true,
    })
    mocks.logsFindMany.mockResolvedValue([makeLog('1', 'a@b.si', 'sent')])

    const res = await post()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.skipped).toBe(true)
    expect(json.sent).toBe(0)
    expect(json.reason).toContain('že')
    expect(mocks.sendDailyDigestEmail).not.toHaveBeenCalled()
  })

  it('pošlje pending logom in označi sent', async () => {
    mocks.ensureDailySummaryLog.mockResolvedValue({
      success: true, created: 2, recipients: ['a@b.si', 'c@d.si'],
      reportDate: '2026-09-16', reportType: 'daily_summary',
    })
    mocks.logsFindMany.mockResolvedValue([
      makeLog('1', 'a@b.si', 'pending'),
      makeLog('2', 'c@d.si', 'pending'),
    ])
    mocks.sendDailyDigestEmail.mockResolvedValue({ success: true })

    const res = await post()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.skipped).toBe(false)
    expect(json.sent).toBe(2)
    expect(json.failed).toBe(0)
    expect(mocks.sendDailyDigestEmail).toHaveBeenCalledTimes(2)
    expect(mocks.sendDailyDigestEmail).toHaveBeenCalledWith('a@b.si', DIGEST_DATA)
    expect(mocks.sendDailyDigestEmail).toHaveBeenCalledWith('c@d.si', DIGEST_DATA)
    expect(mocks.fetchDailyDigestData).toHaveBeenCalledTimes(1) // ENKRAT za vse
    expect(mocks.logsUpdate).toHaveBeenCalledTimes(2)
    expect(mocks.logsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: '1' }, data: expect.objectContaining({ status: 'sent' }) })
    )
  })

  it('retry failed logov; SMTP napaka → označi failed + error v results', async () => {
    mocks.ensureDailySummaryLog.mockResolvedValue({
      success: true, created: 0, recipients: ['a@b.si'],
      reportDate: '2026-09-16', reportType: 'daily_summary',
    })
    mocks.logsFindMany.mockResolvedValue([
      makeLog('1', 'a@b.si', 'failed'),
      makeLog('2', 'ok@b.si', 'pending'),
    ])
    mocks.sendDailyDigestEmail
      .mockResolvedValueOnce({ success: false, error: 'SMTP 535: authentication failed' })
      .mockResolvedValueOnce({ success: true })

    const res = await post()
    const json = await res.json()
    expect(json.sent).toBe(1)
    expect(json.failed).toBe(1)
    expect(json.success).toBe(true) // vsaj en uspešen
    const failedResult = json.results.find((r: { to: string }) => r.to === 'a@b.si')
    expect(failedResult.ok).toBe(false)
    expect(failedResult.error).toContain('535')
    expect(mocks.logsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: '1' },
        data: expect.objectContaining({ status: 'failed', errorMessage: expect.stringContaining('535') }),
      })
    )
  })

  it('vsi fail → success:false v odgovoru', async () => {
    mocks.ensureDailySummaryLog.mockResolvedValue({
      success: true, created: 1, recipients: ['a@b.si'],
      reportDate: '2026-09-16', reportType: 'daily_summary',
    })
    mocks.logsFindMany.mockResolvedValue([makeLog('1', 'a@b.si', 'pending')])
    mocks.sendDailyDigestEmail.mockResolvedValue({ success: false, error: 'ECONNREFUSED' })

    const res = await post()
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.sent).toBe(0)
    expect(json.failed).toBe(1)
  })

  it('samo sent logi med failed/pending mešanicami NE dobijo ponovnega pošiljanja', async () => {
    mocks.ensureDailySummaryLog.mockResolvedValue({
      success: true, created: 0, recipients: ['a@b.si'],
      reportDate: '2026-09-16', reportType: 'daily_summary',
    })
    mocks.logsFindMany.mockResolvedValue([
      makeLog('1', 'sent@b.si', 'sent'),      // preskočen
      makeLog('2', 'retry@b.si', 'pending'),  // poslan
    ])
    mocks.sendDailyDigestEmail.mockResolvedValue({ success: true })

    await post()
    expect(mocks.sendDailyDigestEmail).toHaveBeenCalledTimes(1)
    expect(mocks.sendDailyDigestEmail).toHaveBeenCalledWith('retry@b.si', DIGEST_DATA)
    expect(mocks.sendDailyDigestEmail).not.toHaveBeenCalledWith('sent@b.si', expect.anything())
  })
})
