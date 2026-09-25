// ============================================
// R127 / EPIC #115 P0-6 — BACKUP API RUTE (trap-DB)
// ============================================
// Pokritje:
//  GET /api/backup
//   • auth matrika: brez CRON_SECRET-a + brej seje → 401; staff → 403
//     (requireAuth error passthrough); CRON_SECRET Bearer → 200; admin → 200
//   • full: createBackup {}, priponka headers (Content-Disposition /
//     X-Backup-Checksum), heartbeat zapisan (sizeBytes > 0)
//   • manifest: includeRowData:false, BREZ heartbeat-a, counts-only odgovor
//   • ?tables filter passthrough; BackupError MANIFEST → 400 + code,
//     DB → 500; rate limit → 429
//  POST /api/backup/restore
//   • auth: samo admin seja; brez seje → 401 (tudi s CRON_SECRET-om —
//     destruktivna operacija je človeška odločitev)
//   • confirm dvostopenjska zaščita: brez ?confirm=true → 400
//   • body: neveljaven JSON → 400; prevelik content-length → 413
//   • uspeh: applyRestore(parsed, { verifyOnly }) + audit BACKUP_RESTORE
//     (SAMO dejanski restore, verifyOnly brez audita) + success odgovor
//   • BackupError CHECKSUM → 422, DB → 500 (status passthrough)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

// ---------- Mocki (hišni stil R126: hoisted ref + getter) ----------

const mocks = vi.hoisted(() => ({
  createBackup: vi.fn(),
  applyRestore: vi.fn(),
  writeBackupHeartbeat: vi.fn(),
  requireAuth: vi.fn(),
  checkRateLimitAsync: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
  auditEntries: [] as Array<Record<string, unknown>>,
}))

vi.mock('@/lib/backup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/backup')>()
  return {
    ...actual, // REAL BackupError (instanceof) + canonicalStringify
    createBackup: mocks.createBackup,
    applyRestore: mocks.applyRestore,
    writeBackupHeartbeat: mocks.writeBackupHeartbeat,
  }
})

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: mocks.getClientIp,
  BACKUP_LIMIT: { maxRequests: 12, windowMs: 3_600_000 },
  RESTORE_LIMIT: { maxRequests: 6, windowMs: 3_600_000 },
}))

vi.mock('@/lib/rate-limit/response', () => ({
  rateLimitedResponse: (retryAfterMs: number, message: string) =>
    NextResponse.json({ error: message }, { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }),
}))

vi.mock('@/lib/db', () => ({
  createAuditLog: async (entry: Record<string, unknown>) => {
    mocks.auditEntries.push(entry)
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// ---------- Importi produkcijskih rut ----------
import { GET as backupGet } from '@/app/api/backup/route'
import { POST as restorePost } from '@/app/api/backup/restore/route'
import { BackupError, type BackupFile } from '@/lib/backup'

// ---------- Pripomočki ----------

const ADMIN_SESSION = {
  token: 'tok', employeeId: 'emp-1', role: 'admin',
  permissions: ['admin'], locationId: null,
}
const STAFF_SESSION = {
  token: 'tok2', employeeId: 'emp-2', role: 'staff',
  permissions: ['take_orders'], locationId: 'loc-1',
}

function okAuth(session: Record<string, unknown>) {
  return { session, error: null }
}

function staffDenied() {
  return { session: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
}

function sampleBackup(overrides?: Partial<BackupFile>): BackupFile {
  return {
    format: 'restaurantos-backup',
    version: 1,
    schemaStamp: 'stamp',
    createdAt: '2026-09-25T10:00:00.000Z',
    engine: 'pglite',
    counts: { Menu: 1, Category: 1 },
    tables: {
      Menu: [{ id: 'm1', name: 'm1-name', locationId: 'loc-1' }],
      Category: [{ id: 'c1', name: 'c1-name', menuId: 'm1' }],
    },
    checksum: 'abc123',
    countsChecksum: 'def456',
    ...overrides,
  }
}

const req = (path: string, init?: RequestInit) => new Request(`http://localhost:3000${path}`, init)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auditEntries.length = 0
  mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
  mocks.writeBackupHeartbeat.mockResolvedValue(true)
  delete process.env['CRON_SECRET']
})

// ---------- GET /api/backup ----------

describe('GET /api/backup — auth', () => {
  it('401: brez CRON_SECRET-a in brez seje (javna pot, session null + error null)', async () => {
    mocks.requireAuth.mockResolvedValue({ session: null, error: null })
    const res = await backupGet(req('/api/backup'))
    expect(res.status).toBe(401)
    expect(mocks.createBackup).not.toHaveBeenCalled()
  })

  it('403: staff seja (requireAuth error passthrough)', async () => {
    mocks.requireAuth.mockResolvedValue(staffDenied())
    const res = await backupGet(req('/api/backup'))
    expect(res.status).toBe(403)
    expect(mocks.createBackup).not.toHaveBeenCalled()
  })

  it('200: CRON_SECRET Bearer (cron pot, brez seje)', async () => {
    process.env['CRON_SECRET'] = 'sekret'
    mocks.createBackup.mockResolvedValue(sampleBackup())
    const res = await backupGet(req('/api/backup', {
      headers: { authorization: 'Bearer sekret' },
    }))
    expect(res.status).toBe(200)
    expect(mocks.requireAuth).not.toHaveBeenCalled()
  })

  it('200: admin seja; napačen CRON_SECRET pade na admin auth', async () => {
    process.env['CRON_SECRET'] = 'pravi'
    mocks.requireAuth.mockResolvedValue(okAuth(ADMIN_SESSION))
    mocks.createBackup.mockResolvedValue(sampleBackup())
    const res = await backupGet(req('/api/backup', {
      headers: { authorization: 'Bearer napacen' },
    }))
    expect(res.status).toBe(200)
    expect(mocks.requireAuth).toHaveBeenCalled()
  })
})

describe('GET /api/backup — vsebina', () => {
  beforeEach(() => {
    mocks.requireAuth.mockResolvedValue(okAuth(ADMIN_SESSION))
  })

  it('full: priponka + checksum header + heartbeat (sizeBytes > 0)', async () => {
    mocks.createBackup.mockResolvedValue(sampleBackup())
    const res = await backupGet(req('/api/backup'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(res.headers.get('content-disposition')).toContain('attachment')
    expect(res.headers.get('x-backup-checksum')).toBe('abc123')
    expect(res.headers.get('x-backup-mode')).toBe('full')
    const body = (await res.json()) as Record<string, unknown>
    expect(body['format']).toBe('restaurantos-backup')
    expect(body['checksum']).toBe('abc123')
    expect(mocks.createBackup).toHaveBeenCalledWith({ tables: undefined })
    expect(mocks.writeBackupHeartbeat).toHaveBeenCalledTimes(1)
    const hb = mocks.writeBackupHeartbeat.mock.calls[0][0] as { sizeBytes: number; note: string }
    expect(hb.sizeBytes).toBeGreaterThan(0)
    expect(hb.note).toContain('2 tabel')
  })

  it('manifest: includeRowData:false, brez heartbeat-a', async () => {
    mocks.createBackup.mockResolvedValue(sampleBackup({ checksum: '', tables: {} }))
    const res = await backupGet(req('/api/backup?mode=manifest'))
    expect(res.status).toBe(200)
    expect(mocks.createBackup).toHaveBeenCalledWith({ includeRowData: false, tables: undefined })
    const body = (await res.json()) as Record<string, unknown>
    expect(body['counts']).toBeDefined()
    expect(mocks.writeBackupHeartbeat).not.toHaveBeenCalled()
  })

  it('?tables filter passthrough v createBackup', async () => {
    mocks.createBackup.mockResolvedValue(sampleBackup())
    await backupGet(req('/api/backup?tables=Menu,Category'))
    expect(mocks.createBackup).toHaveBeenCalledWith({ tables: ['Menu', 'Category'] })
  })

  it('BackupError MANIFEST → 400 + code; DB → 500', async () => {
    mocks.createBackup.mockRejectedValue(new BackupError('MANIFEST', 'Neznane tabele: Bogus'))
    const res1 = await backupGet(req('/api/backup?tables=Bogus'))
    expect(res1.status).toBe(400)
    expect(((await res1.json()) as Record<string, unknown>)['code']).toBe('MANIFEST')

    mocks.createBackup.mockRejectedValue(new BackupError('DB', 'findMany fail'))
    const res2 = await backupGet(req('/api/backup'))
    expect(res2.status).toBe(500)
  })

  it('rate limit → 429', async () => {
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: false, retryAfterMs: 60_000 })
    const res = await backupGet(req('/api/backup'))
    expect(res.status).toBe(429)
    expect(mocks.createBackup).not.toHaveBeenCalled()
  })
})

// ---------- POST /api/backup/restore ----------

describe('POST /api/backup/restore — auth + confirm', () => {
  it('401: brez seje (javna pot) — CRON_SECRET NE zadošča za restore', async () => {
    process.env['CRON_SECRET'] = 'sekret'
    mocks.requireAuth.mockResolvedValue({ session: null, error: null })
    const res = await restorePost(req('/api/backup/restore?confirm=true', { method: 'POST' }), )
    expect(res.status).toBe(401)
    expect(mocks.applyRestore).not.toHaveBeenCalled()
  })

  it('403: staff seja', async () => {
    mocks.requireAuth.mockResolvedValue(staffDenied())
    const res = await restorePost(req('/api/backup/restore?confirm=true', { method: 'POST' }))
    expect(res.status).toBe(403)
  })

  it('400: admin, a manjka ?confirm=true', async () => {
    mocks.requireAuth.mockResolvedValue(okAuth(ADMIN_SESSION))
    const res = await restorePost(req('/api/backup/restore', { method: 'POST' }))
    expect(res.status).toBe(400)
    const body = (await res.json()) as Record<string, unknown>
    expect(String(body['error'])).toContain('confirm=true')
  })
})

describe('POST /api/backup/restore — body + izvedba', () => {
  beforeEach(() => {
    mocks.requireAuth.mockResolvedValue(okAuth(ADMIN_SESSION))
  })

  it('400: neveljaven JSON body', async () => {
    const res = await restorePost(req('/api/backup/restore?confirm=true', {
      method: 'POST',
      body: '{ne-jason',
      headers: { 'content-type': 'application/json' },
    }))
    expect(res.status).toBe(400)
    expect(((await res.json()) as Record<string, unknown>)['code']).toBe('FORMAT')
  })

  it('413: prevelik content-length (zavrnitev PRED branjem bodyja)', async () => {
    const res = await restorePost(req('/api/backup/restore?confirm=true', {
      method: 'POST',
      body: '{}',
      headers: { 'content-length': String(2_000_000_000) },
    }))
    expect(res.status).toBe(413)
  })

  it('200: uspešen restore — applyRestore + audit BACKUP_RESTORE + success', async () => {
    const file = sampleBackup()
    mocks.applyRestore.mockResolvedValue({
      verifyOnly: false,
      tables: { Menu: { expected: 1, restored: 1, matched: true } },
      totalExpected: 2,
      totalRestored: 2,
      matched: true,
      warnings: [],
      durationMs: 42,
    })
    const res = await restorePost(req('/api/backup/restore?confirm=true', {
      method: 'POST',
      body: JSON.stringify(file),
      headers: { 'content-type': 'application/json' },
    }))
    expect(res.status).toBe(200)
    expect(mocks.applyRestore).toHaveBeenCalledTimes(1)
    const [arg, opts] = mocks.applyRestore.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(arg).toEqual(file)
    expect(opts).toEqual({ verifyOnly: false })
    const body = (await res.json()) as Record<string, unknown>
    expect(body['success']).toBe(true)
    expect(body['matched']).toBe(true)
    expect(body['totalRestored']).toBe(2)
    expect(mocks.auditEntries).toHaveLength(1)
    expect(mocks.auditEntries[0]).toMatchObject({
      action: 'BACKUP_RESTORE',
      entityType: 'System',
      userId: 'emp-1',
    })
  })

  it('200: verifyOnly — applyRestore verifyOnly:true, BREZ audit zapisa', async () => {
    mocks.applyRestore.mockResolvedValue({
      verifyOnly: true,
      tables: {},
      totalExpected: 2,
      totalRestored: 0,
      matched: false,
      warnings: ['verifyOnly — ni zapisov'],
      durationMs: 5,
    })
    const res = await restorePost(req('/api/backup/restore?confirm=true&verifyOnly=true', {
      method: 'POST',
      body: JSON.stringify(sampleBackup()),
      headers: { 'content-type': 'application/json' },
    }))
    expect(res.status).toBe(200)
    expect(mocks.applyRestore).toHaveBeenCalledWith(expect.anything(), { verifyOnly: true })
    expect(mocks.auditEntries).toHaveLength(0)
  })

  it('BackupError CHECKSUM → 422 + code; DB → 500', async () => {
    mocks.applyRestore.mockRejectedValue(new BackupError('CHECKSUM', 'Checksum tables se ne ujema'))
    const res1 = await restorePost(req('/api/backup/restore?confirm=true', {
      method: 'POST',
      body: JSON.stringify(sampleBackup()),
      headers: { 'content-type': 'application/json' },
    }))
    expect(res1.status).toBe(422)
    expect(((await res1.json()) as Record<string, unknown>)['code']).toBe('CHECKSUM')

    mocks.applyRestore.mockRejectedValue(new BackupError('DB', 'TRUNCATE fail'))
    const res2 = await restorePost(req('/api/backup/restore?confirm=true', {
      method: 'POST',
      body: JSON.stringify(sampleBackup()),
      headers: { 'content-type': 'application/json' },
    }))
    expect(res2.status).toBe(500)
  })
})
