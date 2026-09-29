// ============================================
// R164 (R163-S1) — CRON PATH /api/cron/scheduled-emails-process
// ============================================
// Problem (issue #140, [ANALIZA] → FIX opcija 1): vercel.json registrira
// /api/scheduled-emails/process na 0 2 * * *, Vercel Cron pa pošilja GET.
// GET TE rute je read-only statistika za admin dashboard (kontrakt
// R85-4c platformAdminGate + R160 LJ poslovni dan) BREZ CRON_SECRET poti
// → cron je dobil 401 in email procesiranje prek Vercel Crona NE bi teklo.
//
// Fix: ločen cron path /api/cron/scheduled-emails-process z GET === POST
// delegacijo na obdelavo (vzorec /api/cron/outbox :18-20); vercel.json vnos
// 0 2 PREUSMERJEN (ostane 2/2 Hobby cron mest — cron_jobs_limits_reached
// @ 398c24fb). Stats kontrakt GET /api/scheduled-emails/process ostaja
// nespremenjen (pini R85-4c F / R160 nedotaknjeni).
//
// Vzorec (r85-med-c): REALNI api-utils/logger/decimal/timezone-sl;
// vi.mock auth barrel + db scheduledEmailLog + email/daily-digest/_helpers;
// mockResolvedValue (NE mockResolvedValueOnce — preživi clearAllMocks).
// vercel.json pin vzorec (r112): readFileSync + JSON.parse.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  scheduledEmailLogFindMany: vi.fn(),
  scheduledEmailLogUpdate: vi.fn(),
  scheduledEmailLogCount: vi.fn(),
  isEmailEnabled: vi.fn(),
  getReportRecipients: vi.fn(),
  sendZReportEmail: vi.fn(),
  fetchDailyDigestData: vi.fn(),
  sendDailyDigestEmail: vi.fn(),
  ensureDailySummaryLog: vi.fn(),
  fetchReportData: vi.fn(),
  generateReportPdf: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', async () => {
  const tenantScope = await import('@/lib/auth-middleware/tenant-scope')
  return {
    requireAuth: mocks.requireAuth,
    resolveTenantLocationId: tenantScope.resolveTenantLocationId,
    resolveTenantLocationIdOrThrow: tenantScope.resolveTenantLocationIdOrThrow,
    tenantScopeToWhere: tenantScope.tenantScopeToWhere,
  }
})

vi.mock('@/lib/db', () => ({
  db: {
    scheduledEmailLog: {
      findMany: mocks.scheduledEmailLogFindMany,
      update: mocks.scheduledEmailLogUpdate,
      count: mocks.scheduledEmailLogCount,
    },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: vi.fn().mockResolvedValue({ allowed: true }),
  getClientIp: () => '127.0.0.1',
  AUTHENTICATED_LIMIT: {},
}))

vi.mock('@/lib/email', () => ({
  isEmailEnabled: mocks.isEmailEnabled,
  getReportRecipients: mocks.getReportRecipients,
  sendZReportEmail: mocks.sendZReportEmail,
}))

vi.mock('@/lib/email/daily-digest', () => ({
  fetchDailyDigestData: mocks.fetchDailyDigestData,
  sendDailyDigestEmail: mocks.sendDailyDigestEmail,
  ensureDailySummaryLog: mocks.ensureDailySummaryLog,
}))

vi.mock('@/app/api/reports/export/_helpers', () => ({
  fetchReportData: mocks.fetchReportData,
  generateReportPdf: mocks.generateReportPdf,
}))

import { GET as cronGET, POST as cronPOST, maxDuration } from '@/app/api/cron/scheduled-emails-process/route'

// Utišaj logger
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const LOC_A = 'loc-tenant-a'

function mockSession(overrides: Record<string, unknown> = {}) {
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A, ...overrides },
    error: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.scheduledEmailLogFindMany.mockResolvedValue([])
  mocks.scheduledEmailLogUpdate.mockResolvedValue({})
  mocks.scheduledEmailLogCount.mockResolvedValue(0)
  mocks.isEmailEnabled.mockResolvedValue(true)
  mocks.getReportRecipients.mockResolvedValue(['ops@resto.si'])
  mocks.ensureDailySummaryLog.mockResolvedValue({ success: true, created: 0, reportDate: '2026-01-01' })
  // Session-path determinističen: brez cron secretov
  process.env.CRON_SECRET = ''
  process.env.WS_BROADCAST_SECRET = ''
})

// ══════════════════════════════════════════════════════════════════
// A. Registracija — vercel.json redirect + wrapper meta
// ══════════════════════════════════════════════════════════════════
describe('R164 A: vercel.json registracija cron path-a', () => {
  it('vnos 0 2 PREUSMERJEN na /api/cron/scheduled-emails-process (ne dodan — 2/2 Hobby mest)', () => {
    const vercelJson = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf-8')) as {
      crons: Array<{ path: string; schedule: string }>
    }
    expect(vercelJson.crons).toHaveLength(2) // Hobby limit: max 2 cron jobs @ 398c24fb
    expect(vercelJson.crons).toContainEqual({ path: '/api/cron/scheduled-emails-process', schedule: '0 2 * * *' })
    expect(vercelJson.crons).toContainEqual({ path: '/api/cron/outbox', schedule: '0 3 * * *' })
    const paths = vercelJson.crons.map((c) => c.path)
    expect(paths).not.toContain('/api/scheduled-emails/process') // redirect, NE paralelen vnos
  })

  it('wrapper je cron-kompatibilen: maxDuration 60 + force-dynamic (mirror outbox)', async () => {
    expect(maxDuration).toBe(60)
    const mod = await import('@/app/api/cron/scheduled-emails-process/route')
    expect(mod.dynamic).toBe('force-dynamic')
  })
})

// ══════════════════════════════════════════════════════════════════
// B. GET wrapper — fail-closed + cron pot + platform gate (delegacija)
// ══════════════════════════════════════════════════════════════════
describe('R164 B: GET /api/cron/scheduled-emails-process — delegacija na POST obdelavo', () => {
  it('GET brez CRON_SECRET + brez seje → 401 fail-closed (delegiran auth, ZERO obdelave)', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const res = await cronGET(new Request('http://localhost:3000/api/cron/scheduled-emails-process'))
    expect(res.status).toBe(401)
    expect(mocks.requireAuth).toHaveBeenCalledTimes(1) // delegacija je dosegla auth plast
    expect(mocks.scheduledEmailLogFindMany).not.toHaveBeenCalled()
    expect(mocks.ensureDailySummaryLog).not.toHaveBeenCalled()
  })

  it('GET z Bearer CRON_SECRET → 200 obdelava (self-heal + pending query, brez seje) — regresija R163-S1', async () => {
    process.env.CRON_SECRET = 'cron-test-secret'
    try {
      const res = await cronGET(
        new Request('http://localhost:3000/api/cron/scheduled-emails-process', {
          headers: { authorization: 'Bearer cron-test-secret' },
        }),
      )
      expect(res.status).toBe(200)
      expect(mocks.requireAuth).not.toHaveBeenCalled() // cron pot, ne seja
      expect(mocks.ensureDailySummaryLog).toHaveBeenCalledTimes(1) // self-heal (R160 LJ včeraj)
      expect(mocks.scheduledEmailLogFindMany).toHaveBeenCalledTimes(1)
      const where = mocks.scheduledEmailLogFindMany.mock.calls[0][0].where
      expect(where.status).toBe('pending')
      expect(where.createdAt.lt).toBeInstanceOf(Date)
      const body = await res.json()
      expect(body).toEqual({ message: 'Ni čakajočih emailov', processed: 0 })
    } finally {
      process.env.CRON_SECRET = ''
    }
  })

  it('GET z lokacijsko-admin sejo → 403 platformAdminGate (delegacija NE obide gate) + ZERO obdelave', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await cronGET(new Request('http://localhost:3000/api/cron/scheduled-emails-process'))
    expect(res.status).toBe(403)
    expect(mocks.scheduledEmailLogFindMany).not.toHaveBeenCalled()
    expect(mocks.scheduledEmailLogUpdate).not.toHaveBeenCalled()
    expect(mocks.ensureDailySummaryLog).not.toHaveBeenCalled()
  })

  it('GET === POST pariteta: identičen request → isti status + isti body + ista pending query (outbox vzorec)', async () => {
    process.env.CRON_SECRET = 'cron-test-secret'
    try {
      const url = 'http://localhost:3000/api/cron/scheduled-emails-process'
      const headers = { authorization: 'Bearer cron-test-secret' }
      const getRes = await cronGET(new Request(url, { headers }))
      const getBody = await getRes.json()
      const postRes = await cronPOST(new Request(url, { method: 'POST', headers }))
      const postBody = await postRes.json()
      expect(getRes.status).toBe(postRes.status)
      expect(getBody).toEqual(postBody)
      // Oba klica sta tekla skozi ISTO pending query obliko
      expect(mocks.scheduledEmailLogFindMany).toHaveBeenCalledTimes(2)
      expect(mocks.scheduledEmailLogFindMany.mock.calls[0][0].where.status).toBe('pending')
      expect(mocks.scheduledEmailLogFindMany.mock.calls[1][0].where.status).toBe('pending')
    } finally {
      process.env.CRON_SECRET = ''
    }
  })
})
