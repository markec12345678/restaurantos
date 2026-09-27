// ============================================
// R148-b — EPIC #115 #35 AUDIT/RETENTION — trap-DB uniti
// ============================================
// Vzorec r147-portability (vi.hoisted + vi.mock('@/lib/db') +
// vi.mock('@/lib/auth-middleware') z importOriginal spreadom — requireAuth na
// meji z REALEN hasPermission; rateLimitedResponse REALen iz
// '@/lib/rate-limit/response'; serialize canon REALen — checksum determinizem
// gre čez pravi computeChecksum; verify-chain recompute REALen (node crypto)).
//
// Pokritje (kontrakt R148-b):
//   A. policy.ts: RETENTION_POLICY pin, DOCUMENTED_INDEFINITE pin,
//      retentionCutoffFor datumska matematika, retentionPolicyJson oblika
//   B. GET /api/audit/retention: rl 'audit-retention' PRED authom, 429,
//      401 fail-closed, 403 manager, 200 shape (policy/eligible/chain),
//      count where pini, no-store + brez audit zapisa (cheap read)
//   C. POST /api/audit/archive DRY-RUN: 401/403, cutoff 400 ×3 (manjka /
//      neveljaven / prihodnji), CAP 20000 fail-closed, dry-run brez
//      deleteMany/brez audit, checksum determinizem (2 klica), select
//      cenzura (PII whitelist), orderBy determinizem
//   D. POST /api/audit/archive APPLY=1: pairwise verify → deleteMany ×3 →
//      audit AUDIT_RETENTION_PURGED (AuditRetention, counters-only,
//      anchorIn/anchorOut), 409 fail-closed ob prelomani rezini (NIČ
//      deleteMany/NIČ audit), prazna rezina, attachment headers
//   E. GET /api/audit/verify-chain: intaktna veriga (recompute SHA-256),
//      tampered → broken, dokumentiran purge (anchorIn/anchorOut) →
//      chainIntact true + documentedTruncations, backwards-compat shape +
//      AUDIT_CHAIN_VERIFIED self-audit
//   F. POST /api/cron/data-retention: CRON_SECRET 401/200, policy-import
//      purge, sistemski audit AUDIT_RETENTION_PURGED (SystemRetention,
//      anchor bookkeeping, archive:false), hadErrors → brez audit
//   G. GDPR drive-bys: rl 'gdpr' PRED authom (export + anonymize) + fs-pin
//      no-store na uspešnih odgovorih
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const mocks = vi.hoisted(() => ({
  auditLogCount: vi.fn(),
  auditLogFindMany: vi.fn(),
  auditLogFindFirst: vi.fn(),
  auditLogDeleteMany: vi.fn(),
  webhookCount: vi.fn(),
  webhookFindMany: vi.fn(),
  webhookDeleteMany: vi.fn(),
  emailCount: vi.fn(),
  emailFindMany: vi.fn(),
  emailDeleteMany: vi.fn(),
  sessionCount: vi.fn(),
  sessionDeleteMany: vi.fn(),
  requireAuth: vi.fn(),
  createAuditLog: vi.fn(),
  checkRateLimitAsync: vi.fn(),
  getClientIp: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    auditLog: {
      count: mocks.auditLogCount,
      findMany: mocks.auditLogFindMany,
      findFirst: mocks.auditLogFindFirst,
      deleteMany: mocks.auditLogDeleteMany,
    },
    webhookDelivery: {
      count: mocks.webhookCount,
      findMany: mocks.webhookFindMany,
      deleteMany: mocks.webhookDeleteMany,
    },
    scheduledEmailLog: {
      count: mocks.emailCount,
      findMany: mocks.emailFindMany,
      deleteMany: mocks.emailDeleteMany,
    },
    session: {
      count: mocks.sessionCount,
      deleteMany: mocks.sessionDeleteMany,
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
  },
  createAuditLog: mocks.createAuditLog,
}))

// requireAuth mockan na meji z REALEN hasPermission (r145–r147 kanon)
vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: mocks.requireAuth,
  }
})

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: mocks.getClientIp,
  AUDIT_RETENTION_LIMIT: { maxRequests: 120, windowMs: 60_000 },
  GDPR_LIMIT: { maxRequests: 120, windowMs: 60_000 },
}))

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { GET as retentionGET } from '@/app/api/audit/retention/route'
import { POST as archivePOST, ARCHIVE_ROW_CAP } from '@/app/api/audit/archive/route'
import { GET as verifyChainGET } from '@/app/api/audit/verify-chain/route'
import { POST as cronPOST } from '@/app/api/cron/data-retention/route'
import { GET as gdprExportGET } from '@/app/api/gdpr/export/[employeeId]/route'
import { POST as gdprAnonymizePOST } from '@/app/api/gdpr/anonymize/[employeeId]/route'
import { hasPermission } from '@/lib/auth-middleware/permissions'
import {
  RETENTION_POLICY,
  DOCUMENTED_INDEFINITE,
  RETENTION_POLICY_NOTES,
  retentionCutoffFor,
  retentionPolicyJson,
} from '@/lib/retention/policy'

// sessionRef — requireAuth mock bere trenutno sejo (r145 kanon)
const sessionRef: { current: Record<string, unknown> | null } = { current: null }

// ---------- Fixture helperji ----------

function session(overrides: Record<string, unknown> = {}) {
  return {
    token: 'tok-1',
    employeeId: 'emp-1',
    role: 'manager',
    permissions: ['admin'],
    locationId: 'loc-1',
    createdAt: Date.now(),
    expiresAt: Date.now() + 3_600_000,
    absoluteExpiry: Date.now() + 86_400_000,
    ...overrides,
  }
}

const adminSession = () => session() // manager + 'admin' permission — preide requireAuth
const managerSession = () => session({ permissions: ['view_reports'] })

const unauthorized = () => ({
  session: null,
  error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna.' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  }),
})

const forbidden = () => ({
  session: null,
  error: new Response(JSON.stringify({ error: 'Nimate dovoljenja za to operacijo.' }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  }),
})

const retentionURL = 'http://localhost:3000/api/audit/retention'
function archiveURL(params: string): string {
  return `http://localhost:3000/api/audit/archive${params}`
}

async function jsonBody(res: Response): Promise<Record<string, unknown>> {
  return JSON.parse(await res.text()) as Record<string, unknown>
}

const HEX64 = /^[0-9a-f]{64}$/

/** AuditLog vrstica s PRAVIM chainHash-om (isti payload kot db.ts + verify-chain). */
function chainRow(i: number, prevHash: string, overrides: Record<string, unknown> = {}) {
  const row = {
    id: `al-${i + 1}`,
    previousHash: prevHash,
    action: 'TEST_ACTION',
    entityType: 'Test',
    entityId: `e-${i}`,
    userId: 'emp-1',
    details: JSON.stringify({ i }),
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, i)),
    ipAddress: '198.51.100.9',
    terminalId: 'term-1',
    locationId: 'loc-1',
    chainHash: '',
    ...overrides,
  }
  row.chainHash = crypto
    .createHash('sha256')
    .update(
      [row.previousHash, row.action, row.entityType, row.entityId || '', row.userId || '', row.details].join('|'),
    )
    .digest('hex')
  return row
}

/** Neprekinjena veriga n vrstic (genesis prev = startPrev). */
function buildChain(n: number, startPrev = ''): Array<ReturnType<typeof chainRow>> {
  const rows: Array<ReturnType<typeof chainRow>> = []
  let prev = startPrev
  for (let i = 0; i < n; i++) {
    const row = chainRow(i, prev)
    rows.push(row)
    prev = row.chainHash
  }
  return rows
}

/** Kuriran arhivski AuditLog select (za archive route findMany mock). */
function archiveAuditRow(base: ReturnType<typeof chainRow>) {
  const { ipAddress: _ip, terminalId: _t, ...curated } = base
  return curated
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockImplementation(async (_req: Request, opts?: { permission?: string | string[] }) => {
    if (!sessionRef.current) return unauthorized()
    const required = !opts?.permission ? [] : Array.isArray(opts.permission) ? opts.permission : [opts.permission]
    if (!hasPermission(sessionRef.current as never, required as never)) return forbidden()
    return { session: sessionRef.current, error: null }
  })
  sessionRef.current = adminSession()
  mocks.getClientIp.mockReturnValue('203.0.113.7')
  mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
  mocks.createAuditLog.mockResolvedValue(undefined)
  // privzeti DB odgovori — prazne tabele
  mocks.auditLogCount.mockResolvedValue(0)
  mocks.webhookCount.mockResolvedValue(0)
  mocks.emailCount.mockResolvedValue(0)
  mocks.sessionCount.mockResolvedValue(0)
  mocks.auditLogFindMany.mockResolvedValue([])
  mocks.webhookFindMany.mockResolvedValue([])
  mocks.emailFindMany.mockResolvedValue([])
  mocks.auditLogDeleteMany.mockResolvedValue({ count: 0 })
  mocks.webhookDeleteMany.mockResolvedValue({ count: 0 })
  mocks.emailDeleteMany.mockResolvedValue({ count: 0 })
  mocks.sessionDeleteMany.mockResolvedValue({ count: 0 })
  mocks.auditLogFindFirst.mockResolvedValue(null)
})

// ════════════════════════════════════════════════════════════════
// A. policy.ts — enoten vir resnice (epic P2-07 'DEFINIRAJ')
// ════════════════════════════════════════════════════════════════
describe('R148 policy — RETENTION_POLICY vir resnice', () => {
  it('1. RETENTION_POLICY pini: AuditLog 730/timestamp, Webhook 30/createdAt, Email 90/createdAt, Session expired', () => {
    expect(RETENTION_POLICY.map(p => p.entity)).toEqual([
      'AuditLog',
      'WebhookDelivery',
      'ScheduledEmailLog',
      'Session',
    ])
    expect(RETENTION_POLICY[0]).toMatchObject({ days: 730, dateField: 'timestamp' })
    expect(RETENTION_POLICY[1]).toMatchObject({ days: 30, dateField: 'createdAt' })
    expect(RETENTION_POLICY[2]).toMatchObject({ days: 90, dateField: 'createdAt' })
    expect(RETENTION_POLICY[3]).toMatchObject({ days: null, dateField: null })
    for (const p of RETENTION_POLICY) expect(p.basis.length).toBeGreaterThan(20)
  })

  it('2. DOCUMENTED_INDEFINITE: order/receipt/payment/stock/guest — P2-05 utemeljitve', () => {
    expect(DOCUMENTED_INDEFINITE.map(d => d.models)).toEqual([
      ['Order'],
      ['Receipt'],
      ['Payment'],
      ['StockTransaction'],
      ['Guest'],
    ])
    for (const d of DOCUMENTED_INDEFINITE) {
      expect(d.reason.length).toBeGreaterThan(20)
      expect(d.reason).toMatch(/FURS|verig|hramba|GDPR/)
    }
  })

  it('3. retentionCutoffFor: now − dni točno; null za Session in neznano entiteto', () => {
    const now = new Date('2026-06-15T12:00:00.000Z')
    expect(retentionCutoffFor('AuditLog', now)?.toISOString()).toBe('2024-06-15T12:00:00.000Z')
    expect(retentionCutoffFor('WebhookDelivery', now)?.toISOString()).toBe('2026-05-16T12:00:00.000Z')
    expect(retentionCutoffFor('ScheduledEmailLog', now)?.toISOString()).toBe('2026-03-17T12:00:00.000Z')
    expect(retentionCutoffFor('Session', now)).toBeNull()
    expect(retentionCutoffFor('Neznana', now)).toBeNull()
  })

  it('4. retentionPolicyJson: format/version/JSON-serializabilen + kopije (ni referenc na source)', () => {
    const json = retentionPolicyJson(new Date('2026-06-15T12:00:00.000Z'))
    expect(json.format).toBe('restaurantos-retention-policy')
    expect(json.version).toBe(1)
    expect(json.generatedAt).toBe('2026-06-15T12:00:00.000Z')
    expect(json.policy).toEqual(RETENTION_POLICY.map(p => ({ ...p })))
    expect(json.notes).toEqual([...RETENTION_POLICY_NOTES])
    expect(() => JSON.stringify(json)).not.toThrow()
    // copies — mutacija izvoza ne sme vplivati na vir
    const first = json.policy[0] as { days: number | null }
    first.days = 1
    expect(RETENTION_POLICY[0].days).toBe(730)
  })
})

// ════════════════════════════════════════════════════════════════
// B. GET /api/audit/retention — admin dry-run preview
// ════════════════════════════════════════════════════════════════
describe('R148 retention GET — vrata + shape', () => {
  it("5. rl bucket 'audit-retention' PRED authom + requireAuth {permission:'admin'}", async () => {
    const res = await retentionGET(new Request(retentionURL))
    expect(res.status).toBe(200)
    expect(mocks.checkRateLimitAsync).toHaveBeenCalledTimes(1)
    const [bucket, ip, limit] = mocks.checkRateLimitAsync.mock.calls[0]
    expect(bucket).toBe('audit-retention')
    expect(ip).toBe('203.0.113.7')
    expect(limit).toEqual({ maxRequests: 120, windowMs: 60_000 })
    expect(mocks.checkRateLimitAsync.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.requireAuth.mock.invocationCallOrder[0],
    )
    expect(mocks.requireAuth).toHaveBeenCalledWith(expect.anything(), { permission: 'admin' })
  })

  it('6. 429 realen rateLimitedResponse — zero-DB, zero-audit', async () => {
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 })
    const res = await retentionGET(new Request(retentionURL))
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('30')
    expect(mocks.auditLogCount).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('7. 401 fail-closed — zero-DB, zero-audit', async () => {
    sessionRef.current = null
    const res = await retentionGET(new Request(retentionURL))
    expect(res.status).toBe(401)
    expect(mocks.auditLogCount).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it("8. 403 manager (permission 'admin' NE preide) — zero-DB", async () => {
    sessionRef.current = managerSession()
    const res = await retentionGET(new Request(retentionURL))
    expect(res.status).toBe(403)
    expect(mocks.auditLogCount).not.toHaveBeenCalled()
  })

  it('9. 200 shape: format/policy/documentedIndefinite/notes/eligible ×4/chain anchor+head', async () => {
    mocks.auditLogCount.mockResolvedValue(3)
    mocks.webhookCount.mockResolvedValue(2)
    mocks.emailCount.mockResolvedValue(1)
    mocks.sessionCount.mockResolvedValue(4)
    mocks.auditLogFindFirst.mockImplementation(async (args?: { orderBy?: Array<Record<string, string>> }) => {
      const dir = args?.orderBy?.[0]?.timestamp
      if (dir === 'asc') return { id: 'al-1', previousHash: 'ANCHOR', timestamp: new Date('2024-01-01T00:00:00Z') }
      return { id: 'al-9', chainHash: 'HEAD', timestamp: new Date('2026-09-27T00:00:00Z') }
    })

    const res = await retentionGET(new Request(retentionURL))
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.format).toBe('restaurantos-audit-retention')
    expect(body.version).toBe(1)
    expect(body.policy).toEqual(RETENTION_POLICY.map(p => ({ ...p })))
    expect(body.documentedIndefinite).toEqual(DOCUMENTED_INDEFINITE.map(d => ({ ...d, models: [...d.models] })))
    expect(body.notes).toEqual([...RETENTION_POLICY_NOTES])
    const eligible = body.eligible as Record<string, { count: number; cutoff: string | null; basis?: string }>
    expect(eligible.AuditLog.count).toBe(3)
    expect(eligible.WebhookDelivery.count).toBe(2)
    expect(eligible.ScheduledEmailLog.count).toBe(1)
    expect(eligible.Session.count).toBe(4)
    expect(eligible.Session.basis).toBe('expired')
    const chain = body.chain as { anchor: { previousHash: string }; head: { chainHash: string } }
    expect(chain.anchor.previousHash).toBe('ANCHOR')
    expect(chain.head.chainHash).toBe('HEAD')

    // where pini: timestamp/createdAt lt cutoff + Session OR expires/absoluteExpiry
    const auditWhere = mocks.auditLogCount.mock.calls[0][0].where
    expect(auditWhere.timestamp.lt).toBeInstanceOf(Date)
    const webhookWhere = mocks.webhookCount.mock.calls[0][0].where
    expect(webhookWhere.createdAt.lt).toBeInstanceOf(Date)
    const sessionWhere = mocks.sessionCount.mock.calls[0][0].where
    expect(Array.isArray(sessionWhere.OR)).toBe(true)
  })

  it('10. no-store header + cheap read (brez audit zapisa, brez findMany nad AuditLog)', async () => {
    const res = await retentionGET(new Request(retentionURL))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
    expect(mocks.auditLogFindMany).not.toHaveBeenCalled()
    expect(mocks.webhookFindMany).not.toHaveBeenCalled()
    expect(mocks.emailFindMany).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// C. POST /api/audit/archive — DRY-RUN
// ════════════════════════════════════════════════════════════════
describe('R148 archive POST — vrata + cutoff validacija + CAP', () => {
  it('11. 401 fail-closed + 403 manager — zero-DB, zero-audit', async () => {
    sessionRef.current = null
    const res401 = await archivePOST(new Request(archiveURL('?cutoff=2026-01-01T00:00:00.000Z')))
    expect(res401.status).toBe(401)
    sessionRef.current = managerSession()
    const res403 = await archivePOST(new Request(archiveURL('?cutoff=2026-01-01T00:00:00.000Z')))
    expect(res403.status).toBe(403)
    expect(mocks.auditLogCount).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('12. cutoff manjka → 400 točno sporočilo; neveljaven → 400; prihodnji → 400 (zero-DB ×3)', async () => {
    const resMissing = await archivePOST(new Request(archiveURL('')))
    expect(resMissing.status).toBe(400)
    expect((await jsonBody(resMissing)).error).toBe('Manjka obvezen parameter cutoff (ISO datum).')

    const resInvalid = await archivePOST(new Request(archiveURL('?cutoff=ni-datum')))
    expect(resInvalid.status).toBe(400)
    expect((await jsonBody(resInvalid)).error).toBe(
      'Neveljaven cutoff — pričakovan ISO datum (npr. 2024-01-31T00:00:00.000Z).',
    )

    const resFuture = await archivePOST(new Request(archiveURL('?cutoff=2099-01-01T00:00:00.000Z')))
    expect(resFuture.status).toBe(400)
    expect((await jsonBody(resFuture)).error).toBe('Cutoff ne sme biti v prihodnosti.')

    expect(mocks.auditLogCount).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('13. CAP pre-check: skupaj > 20000 → 400 fail-closed z točnim sporočilom, BREZ findMany', async () => {
    mocks.auditLogCount.mockResolvedValue(15_000)
    mocks.webhookCount.mockResolvedValue(5_001)
    const res = await archivePOST(new Request(archiveURL('?cutoff=2026-01-01T00:00:00.000Z')))
    expect(res.status).toBe(400)
    expect((await jsonBody(res)).error).toBe(
      `Arhiv presega omejitev ${ARCHIVE_ROW_CAP} vrstic (20001). Zožite cutoff datum in izvedite več prehodov.`,
    )
    expect(ARCHIVE_ROW_CAP).toBe(20_000)
    expect(mocks.auditLogFindMany).not.toHaveBeenCalled()
    expect(mocks.auditLogDeleteMany).not.toHaveBeenCalled()
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('14. rl bucket audit-retention (isti kot GET) + 429 zero-DB', async () => {
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: false, retryAfterMs: 45_000 })
    const res = await archivePOST(new Request(archiveURL('?cutoff=2026-01-01T00:00:00.000Z')))
    expect(res.status).toBe(429)
    expect(mocks.checkRateLimitAsync.mock.calls[0][0]).toBe('audit-retention')
    expect(mocks.auditLogCount).not.toHaveBeenCalled()
  })
})

describe('R148 archive POST — dry-run', () => {
  it('15. dry-run 200: applied:false, wouldPurge, counts, anchorIn/anchorOut, checksum HEX64, brez rows polja', async () => {
    const chain = buildChain(2)
    mocks.auditLogCount.mockResolvedValue(2)
    mocks.auditLogFindMany.mockResolvedValue(chain.map(archiveAuditRow))
    const res = await archivePOST(new Request(archiveURL('?cutoff=2026-06-01T00:00:00.000Z')))
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.format).toBe('restaurantos-audit-archive')
    expect(body.version).toBe(1)
    expect(body.applied).toBe(false)
    expect(body.wouldPurge).toBe(2)
    expect(body.counts).toEqual({ auditLog: 2, webhookDelivery: 0, scheduledEmailLog: 0 })
    expect(body.anchorIn).toBe('') // genesis previousHash
    expect(body.anchorOut).toBe(chain[1].chainHash)
    expect(body.checksum).toMatch(HEX64)
    expect(body.cap).toBe(20_000)
    expect(body.rows).toBeUndefined() // dry-run BREZ vrstic
    expect(Array.isArray(body.notes)).toBe(true)
    // headers
    expect(res.headers.get('x-archive-checksum')).toBe(body.checksum)
    expect(res.headers.get('x-archive-rows')).toBe('2')
    expect(res.headers.get('cache-control')).toBe('no-store')
    // dry-run NIČ pisalnih klicev, NIČ audit
    expect(mocks.auditLogDeleteMany).not.toHaveBeenCalled()
    expect(mocks.webhookDeleteMany).not.toHaveBeenCalled()
    expect(mocks.emailDeleteMany).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('16. checksum determinizem: 2 klica isti podatki → isti X-Archive-Checksum (generatedAt izključen)', async () => {
    const chain = buildChain(3)
    mocks.auditLogCount.mockResolvedValue(3)
    mocks.auditLogFindMany.mockResolvedValue(chain.map(archiveAuditRow))
    const res1 = await archivePOST(new Request(archiveURL('?cutoff=2026-06-01T00:00:00.000Z')))
    const res2 = await archivePOST(new Request(archiveURL('?cutoff=2026-06-01T00:00:00.000Z')))
    const b1 = await jsonBody(res1)
    const b2 = await jsonBody(res2)
    expect(b1.checksum).toBe(b2.checksum)
    expect(res1.headers.get('x-archive-checksum')).toBe(res2.headers.get('x-archive-checksum'))
    // generatedAt namenoma nestabilen (ovojnica, ms granularnost) — samo ISO oblika;
    // determinizem je dokumentiran na checksum nivoju (podatki, ne ovojnica)
    expect(b1.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(b2.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('17. select cenzura: AuditLog BREZ ipAddress/terminalId, Z chainHash/previousHash; webhook BREZ payload/responseBody/signature; email BREZ recipient/subject', async () => {
    await archivePOST(new Request(archiveURL('?cutoff=2026-06-01T00:00:00.000Z')))
    const auditSelect = mocks.auditLogFindMany.mock.calls[0][0].select
    expect(auditSelect).toHaveProperty('chainHash', true)
    expect(auditSelect).toHaveProperty('previousHash', true)
    expect(auditSelect).not.toHaveProperty('ipAddress')
    expect(auditSelect).not.toHaveProperty('terminalId')
    const webhookSelect = mocks.webhookFindMany.mock.calls[0][0].select
    expect(webhookSelect).not.toHaveProperty('payload')
    expect(webhookSelect).not.toHaveProperty('responseBody')
    expect(webhookSelect).not.toHaveProperty('signature')
    const emailSelect = mocks.emailFindMany.mock.calls[0][0].select
    expect(emailSelect).not.toHaveProperty('recipient')
    expect(emailSelect).not.toHaveProperty('subject')
  })

  it('18. determinističen orderBy: [timestamp asc, id asc] / [createdAt asc, id asc] + take CAP', async () => {
    await archivePOST(new Request(archiveURL('?cutoff=2026-06-01T00:00:00.000Z')))
    expect(mocks.auditLogFindMany.mock.calls[0][0].orderBy).toEqual([
      { timestamp: 'asc' },
      { id: 'asc' },
    ])
    expect(mocks.webhookFindMany.mock.calls[0][0].orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }])
    expect(mocks.emailFindMany.mock.calls[0][0].orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }])
    expect(mocks.auditLogFindMany.mock.calls[0][0].take).toBe(20_000)
  })

  it('19. dry-run na PRELOMANI rezini je vseeno 200 (verifikacija je samo apply faza)', async () => {
    const chain = buildChain(2)
    const broken = chain.map(archiveAuditRow)
    broken[1] = { ...broken[1], previousHash: 'tampered-prev' }
    mocks.auditLogCount.mockResolvedValue(2)
    mocks.auditLogFindMany.mockResolvedValue(broken)
    const res = await archivePOST(new Request(archiveURL('?cutoff=2026-06-01T00:00:00.000Z')))
    expect(res.status).toBe(200)
    expect((await jsonBody(res)).applied).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════
// D. POST /api/audit/archive — APPLY=1 (verify → purge → audit)
// ════════════════════════════════════════════════════════════════
describe('R148 archive POST — apply=1', () => {
  it('20. uspešen apply: deleteMany ×3 z ISTIM where + audit AUDIT_RETENTION_PURGED/AuditRetention + attachment headers', async () => {
    const chain = buildChain(2)
    mocks.auditLogCount.mockResolvedValue(2)
    mocks.auditLogFindMany.mockResolvedValue(chain.map(archiveAuditRow))
    mocks.auditLogDeleteMany.mockResolvedValue({ count: 2 })
    mocks.webhookDeleteMany.mockResolvedValue({ count: 1 })
    mocks.emailDeleteMany.mockResolvedValue({ count: 0 })
    // prva ohranjena vrstica (po purge-u) — previousHash == chainHash zadnje izbrisane
    mocks.auditLogFindFirst.mockResolvedValue({ id: 'al-3', previousHash: chain[1].chainHash })

    const res = await archivePOST(new Request(archiveURL('?cutoff=2026-06-01T00:00:00.000Z&apply=1')))
    expect(res.status).toBe(200)

    // deleteMany z istim where kot fetch
    expect(mocks.auditLogDeleteMany).toHaveBeenCalledTimes(1)
    expect(mocks.auditLogDeleteMany.mock.calls[0][0].where.timestamp.lt).toBeInstanceOf(Date)
    expect(mocks.webhookDeleteMany).toHaveBeenCalledTimes(1)
    expect(mocks.emailDeleteMany).toHaveBeenCalledTimes(1)

    // audit — counters-only + anchor bookkeeping
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
    const auditEntry = mocks.createAuditLog.mock.calls[0][0]
    expect(auditEntry.action).toBe('AUDIT_RETENTION_PURGED')
    expect(auditEntry.entityType).toBe('AuditRetention')
    expect(auditEntry.entityId).toBe('2026-06-01T00:00:00.000Z')
    expect(auditEntry.locationId).toBeNull()
    expect(auditEntry.userId).toBe('emp-1')
    expect(auditEntry.details).toMatchObject({
      auditLogRows: 2,
      webhookDeliveryRows: 1,
      scheduledEmailLogRows: 0,
      cutoff: '2026-06-01T00:00:00.000Z',
      anchorIn: chain[1].chainHash,
      anchorOut: '',
    })
    expect(auditEntry.details.checksum).toMatch(HEX64)

    // attachment headers + telo vsebuje rows
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="audit-arhiv-\d{8}-\d{6}\.json"$/)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = (await jsonBody(res)) as unknown as {
      applied: boolean
      rows: Record<string, unknown[]>
      checksum: string
      anchorIn: string
      anchorOut: string
    }
    expect(body.applied).toBe(true)
    expect(body.rows.auditLog).toHaveLength(2)
    expect(body.rows.auditLog[0]).not.toHaveProperty('ipAddress')
    expect(body.rows.auditLog[0]).not.toHaveProperty('terminalId')
    expect(body.rows.auditLog[0]).toHaveProperty('chainHash')
    expect(body.anchorIn).toBe('')
    expect(body.anchorOut).toBe(chain[1].chainHash)
    expect(body.checksum).toBe(res.headers.get('x-archive-checksum'))
  })

  it('21. prelomana rezina → 409 fail-closed z točnim sporočilom, NIČ deleteMany, NIČ audit', async () => {
    const chain = buildChain(2)
    const broken = chain.map(archiveAuditRow)
    broken[1] = { ...broken[1], previousHash: 'tampered-prev' }
    mocks.auditLogCount.mockResolvedValue(2)
    mocks.auditLogFindMany.mockResolvedValue(broken)

    const res = await archivePOST(new Request(archiveURL('?cutoff=2026-06-01T00:00:00.000Z&apply=1')))
    expect(res.status).toBe(409)
    expect((await jsonBody(res)).error).toBe(
      'Veriga arhivirane rezine ni neprekinjena pri vnosu al-2 — purge preklican (fail-closed).',
    )
    expect(mocks.auditLogDeleteMany).not.toHaveBeenCalled()
    expect(mocks.webhookDeleteMany).not.toHaveBeenCalled()
    expect(mocks.emailDeleteMany).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('22. prazna rezina apply: 200, counts 0, deleteMany ×3 (0 vrstic), audit z anchorIn null + anchorOut null', async () => {
    const res = await archivePOST(new Request(archiveURL('?cutoff=2026-06-01T00:00:00.000Z&apply=1')))
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.counts).toEqual({ auditLog: 0, webhookDelivery: 0, scheduledEmailLog: 0 })
    expect(mocks.auditLogDeleteMany).toHaveBeenCalledTimes(1)
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
    const entry = mocks.createAuditLog.mock.calls[0][0]
    expect(entry.details).toMatchObject({
      auditLogRows: 0,
      webhookDeliveryRows: 0,
      scheduledEmailLogRows: 0,
      anchorIn: null,
      anchorOut: null,
    })
  })
})

// ════════════════════════════════════════════════════════════════
// E. GET /api/audit/verify-chain — anchor-aware
// ════════════════════════════════════════════════════════════════
describe('R148 verify-chain — anchor-aware documented truncation', () => {
  function wireFindMany(window: unknown[], purge: unknown[]) {
    mocks.auditLogFindMany.mockImplementation(async (args?: { where?: unknown }) => {
      if (args && args.where) return purge
      return window
    })
  }

  it('23. intaktna veriga → chainIntact true, verified N, recompute SHA-256 z realnim crypto', async () => {
    const chain = buildChain(3)
    wireFindMany(chain, [])
    mocks.auditLogFindFirst.mockResolvedValue({ id: 'al-3', chainHash: chain[2].chainHash, timestamp: chain[2].timestamp })

    const res = await verifyChainGET(new Request('http://localhost:3000/api/audit/verify-chain'))
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.total).toBe(3)
    expect(body.verified).toBe(3)
    expect(body.broken).toBe(0)
    expect(body.chainIntact).toBe(true)
    expect(body.documentedTruncations).toBe(0)
    const anchor = body.anchor as { previousHash: string }
    const head = body.head as { chainHash: string }
    expect(anchor.previousHash).toBe('')
    expect(head.chainHash).toBe(chain[2].chainHash)
    // self-audit (guest-visit-integrity precedens) — counters-only
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
    expect(mocks.createAuditLog.mock.calls[0][0].action).toBe('AUDIT_CHAIN_VERIFIED')
    expect(mocks.createAuditLog.mock.calls[0][0].details).toMatchObject({
      total: 3,
      verified: 3,
      broken: 0,
      chainIntact: true,
      documentedTruncations: 0,
    })
  })

  it('24. tampered previousHash → broken 1, chainIntact false, brokenEntries pin', async () => {
    const chain = buildChain(3)
    chain[2] = { ...chain[2], previousHash: 'deadbeef' }
    wireFindMany(chain, [])
    mocks.auditLogFindFirst.mockResolvedValue({ id: 'al-3', chainHash: chain[2].chainHash, timestamp: chain[2].timestamp })

    const res = await verifyChainGET(new Request('http://localhost:3000/api/audit/verify-chain'))
    const body = await jsonBody(res)
    expect(body.chainIntact).toBe(false)
    expect(body.broken).toBe(1)
    const broken = (body.brokenEntries as Array<{ id: string; expected: string; actual: string }>)[0]
    expect(broken.id).toBe('al-3')
    expect(broken.expected).toBe(chain[1].chainHash)
    expect(broken.actual).toBe('deadbeef')
  })

  it('25. dokumentiran purge (anchorIn == actual, anchorOut == expectedPrev) → documentedTruncations 1 + chainIntact TRUE (epic gate)', async () => {
    // purgana veriga: prva ohranjena vrstica ima previousHash 'Hn' (chainHash
    // izbrisane predhodnice) — brez purge zapisa bi bilo to 'broken'
    const kept = buildChain(3, 'Hn')
    const purgeEntry = {
      id: 'purge-1',
      details: JSON.stringify({ anchorIn: 'Hn', anchorOut: '', archive: true, auditLogRows: 7 }),
    }
    wireFindMany(kept, [purgeEntry])
    mocks.auditLogFindFirst.mockResolvedValue({ id: 'al-3', chainHash: kept[2].chainHash, timestamp: kept[2].timestamp })

    const res = await verifyChainGET(new Request('http://localhost:3000/api/audit/verify-chain'))
    const body = await jsonBody(res)
    expect(body.chainIntact).toBe(true)
    expect(body.broken).toBe(0)
    expect(body.documentedTruncations).toBe(1)
    expect(body.verified).toBe(3)
  })

  it('26. backwards-compat shape: legacy polja ostanejo + anchor/head/documentedTruncations DODANA', async () => {
    wireFindMany([], [])
    mocks.auditLogFindFirst.mockResolvedValue(null)
    const res = await verifyChainGET(new Request('http://localhost:3000/api/audit/verify-chain'))
    const body = await jsonBody(res)
    for (const key of ['total', 'verified', 'broken', 'chainIntact']) {
      expect(body).toHaveProperty(key)
    }
    for (const key of ['documentedTruncations', 'anchor', 'head']) {
      expect(body).toHaveProperty(key)
    }
    expect(body.total).toBe(0)
    expect(body.chainIntact).toBe(true)
    expect(body.anchor).toBeNull()
    expect(body.head).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════
// F. POST /api/cron/data-retention — policy import + sistemski audit
// ════════════════════════════════════════════════════════════════
describe('R148 cron data-retention — policy + AUDIT_RETENTION_PURGED', () => {
  it('27. brez CRON_SECRET + brez seje → 401 fail-closed (r82 pariteta)', async () => {
    vi.stubEnv('CRON_SECRET', '')
    sessionRef.current = null
    const res = await cronPOST(new Request('http://localhost:3000/api/cron/data-retention', { method: 'POST' }))
    expect(res.status).toBe(401)
    vi.unstubAllEnvs()
  })

  it('28. pravi CRON_SECRET → purge po policy + sistemski audit AUDIT_RETENTION_PURGED/SystemRetention z anchor bookkeeping + no-store', async () => {
    vi.stubEnv('CRON_SECRET', 'sekret')
    mocks.auditLogDeleteMany.mockResolvedValue({ count: 2 })
    mocks.auditLogFindFirst.mockResolvedValue({ id: 'al-kept', previousHash: 'H-first-kept' })
    mocks.webhookDeleteMany.mockResolvedValue({ count: 1 })
    mocks.sessionDeleteMany.mockResolvedValue({ count: 3 })
    mocks.emailDeleteMany.mockResolvedValue({ count: 0 })

    const res = await cronPOST(
      new Request('http://localhost:3000/api/cron/data-retention', {
        method: 'POST',
        headers: { authorization: 'Bearer sekret' },
      }),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await jsonBody(res)
    expect(body.success).toBe(true)
    const results = body.results as Record<string, { deleted?: number }>
    expect(results.auditLog.deleted).toBe(2)
    expect(results.webhookDelivery.deleted).toBe(1)
    expect(results.sessions.deleted).toBe(3)

    // purge po RETENTION_POLICY (timestamp lt cutoff) — NIČ hardcode
    expect(mocks.auditLogDeleteMany.mock.calls[0][0].where.timestamp.lt).toBeInstanceOf(Date)
    expect(mocks.sessionDeleteMany.mock.calls[0][0].where.OR).toBeDefined()

    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
    const entry = mocks.createAuditLog.mock.calls[0][0]
    expect(entry.action).toBe('AUDIT_RETENTION_PURGED') // ISTO ime kot archive route — verify-chain match
    expect(entry.entityType).toBe('SystemRetention')
    expect(entry.entityId).toBe('cron:data-retention')
    expect(entry.locationId).toBeNull()
    expect(entry.details).toMatchObject({
      auditLog: 2,
      webhookDelivery: 1,
      sessions: 3,
      scheduledEmailLog: 0,
      anchorIn: 'H-first-kept',
      anchorOut: '',
      archive: false,
    })
    vi.unstubAllEnvs()
  })

  it('29. napaka v eni tabeli → hadErrors → createAuditLog NI klican (audit samo ob uspehu)', async () => {
    vi.stubEnv('CRON_SECRET', 'sekret')
    mocks.webhookDeleteMany.mockRejectedValue(new Error('db down'))
    const res = await cronPOST(
      new Request('http://localhost:3000/api/cron/data-retention', {
        method: 'POST',
        headers: { authorization: 'Bearer sekret' },
      }),
    )
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.success).toBe(true)
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })
})

// ════════════════════════════════════════════════════════════════
// G. GDPR drive-bys — rl 'gdpr' + no-store
// ════════════════════════════════════════════════════════════════
describe('R148 GDPR drive-bys — rl bucket + no-store', () => {
  it('30. gdpr export: rl bucket \'gdpr\' PRED authom + GDPR_LIMIT + 401 fail-closed zero-DB', async () => {
    sessionRef.current = null
    const res = await gdprExportGET(
      new Request('http://localhost:3000/api/gdpr/export/emp-1'),
      { params: Promise.resolve({ employeeId: 'emp-1' }) },
    )
    expect(res.status).toBe(401)
    expect(mocks.checkRateLimitAsync).toHaveBeenCalledTimes(1)
    const [bucket, , limit] = mocks.checkRateLimitAsync.mock.calls[0]
    expect(bucket).toBe('gdpr')
    expect(limit).toEqual({ maxRequests: 120, windowMs: 60_000 })
    expect(mocks.checkRateLimitAsync.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.requireAuth.mock.invocationCallOrder[0],
    )
    expect(mocks.auditLogFindMany).not.toHaveBeenCalled()
  })

  it('31. gdpr anonymize: rl bucket \'gdpr\' PRED authom + 401 fail-closed', async () => {
    sessionRef.current = null
    const res = await gdprAnonymizePOST(
      new Request('http://localhost:3000/api/gdpr/anonymize/emp-1', { method: 'POST' }),
      { params: Promise.resolve({ employeeId: 'emp-1' }) },
    )
    expect(res.status).toBe(401)
    expect(mocks.checkRateLimitAsync).toHaveBeenCalledTimes(1)
    expect(mocks.checkRateLimitAsync.mock.calls[0][0]).toBe('gdpr')
  })

  it('32. fs-pin: obe GDPR ruti vsebujeta no-store na uspešnem odgovoru + rl wiring', () => {
    const exportSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/gdpr/export/[employeeId]/route.ts'),
      'utf8',
    )
    expect(exportSrc).toContain("checkRateLimitAsync('gdpr'")
    expect(exportSrc).toContain("'Cache-Control': 'no-store'")
    const anonymizeSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/gdpr/anonymize/[employeeId]/route.ts'),
      'utf8',
    )
    expect(anonymizeSrc).toContain("checkRateLimitAsync('gdpr'")
    expect(anonymizeSrc).toContain("'Cache-Control': 'no-store'")
  })
})
