// ============================================
// R81 — AuditLog.locationId tenant model — regresijski testi
// ============================================
// Pokriva:
//   1. createAuditLog derivation (real db.ts helper z fake tx klientom):
//      - entry brez locationId + userId → izpeljava prek Employee.locationId
//      - entry z eksplicitnim locationId → derivacija se PRESKOČI
//      - entry brez userId (sistemski) → locationId null, brez lookupa
//      - hash payload NE vsebuje locationId (backward-kompatibilna veriga)
//   2. GET /api/audit tenant scoping (real resolver prek tenant-scope):
//      - location-bound admin → where.locationId = seja lokacija
//      - super-admin (brez lokacije) → brez locationId filtra (global)
//      - ne-admin brez lokacije → 403 fail-closed, brez DB klicev
//   3. POST /api/audit — ročni vnos dobi locationId iz seje
//   4. GET /api/notifications — list + stats scoped; stripRecipientPii ostane
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auditLogFindMany: vi.fn(),
  auditLogCount: vi.fn(),
  auditLogCreate: vi.fn(),
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    auditLog: {
      findMany: mocks.auditLogFindMany,
      count: mocks.auditLogCount,
      create: mocks.auditLogCreate,
    },
  },
  createAuditLog: vi.fn(),
  createAuditLogsBatch: vi.fn(),
}))

// Realni tenant-scope resolver (kanonični modul) prek auth-middleware barrel mocka
vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tenant-scope')>()
  return {
    ...actual,
    requireAuth: mocks.requireAuth,
  }
})

// Utišaj logger
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'log').mockImplementation(() => {})

import { createAuditLog as _unusedCreateAuditLog } from '@/lib/db'
void _unusedCreateAuditLog // mock zadostuje rutam; realna implementacija prek importActual spodaj
import { GET as auditGET, POST as auditPOST } from '@/app/api/audit/route'
import { GET as notificationsGET } from '@/app/api/notifications/route'

/** Realna createAuditLog implementacija (importActual obide vi.mock '@/lib/db'). */
async function realCreateAuditLog(entry: Parameters<typeof _unusedCreateAuditLog>[0], tx: unknown) {
  const real = await vi.importActual<typeof import('@/lib/db')>('@/lib/db')
  return real.createAuditLog(entry, tx as never)
}

const LOC_A = 'loc-r81-a'
const LOC_B = 'loc-r81-b'

// --- Fake tx klient za createAuditLog (ni odvisen od globalnega db klienta) ---
function fakeTx(logRows: Array<Record<string, unknown>> = [], employees: Record<string, string | null> = {}) {
  return {
    auditLog: {
      findFirst: vi.fn().mockResolvedValue({ chainHash: 'prev-hash' }),
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        logRows.push(data)
        return data
      }),
    },
    employee: {
      findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (!(where.id in employees)) return null
        return { id: where.id, locationId: employees[where.id] ?? null }
      }),
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('R81: createAuditLog — locationId derivation', () => {
  it('izpelje locationId prek userId → Employee.locationId', async () => {
    const rows: Array<Record<string, unknown>> = []
    const tx = fakeTx(rows, { 'emp-1': LOC_A })

    await realCreateAuditLog(
      { userId: 'emp-1', action: 'CREATE_ORDER', entityType: 'Order', entityId: 'ord-1' },
      tx,
    )

    expect(tx.employee.findUnique).toHaveBeenCalledWith({ where: { id: 'emp-1' }, select: { locationId: true } })
    expect(rows).toHaveLength(1)
    expect(rows[0].locationId).toBe(LOC_A)
  })

  it('ekspliciten locationId se spoštuje (derivacija se preskoči)', async () => {
    const rows: Array<Record<string, unknown>> = []
    const tx = fakeTx(rows, { 'emp-1': LOC_A })

    await realCreateAuditLog(
      { userId: 'emp-1', action: 'REFUND_PAYMENT', entityType: 'Payment', entityId: 'pay-1', locationId: LOC_B },
      tx,
    )

    expect(tx.employee.findUnique).not.toHaveBeenCalled()
    expect(rows[0].locationId).toBe(LOC_B)
  })

  it('sistemski vnos (brez userId) → locationId null, brez lookupa', async () => {
    const rows: Array<Record<string, unknown>> = []
    const tx = fakeTx(rows)

    await realCreateAuditLog({ action: 'CRON_DIGEST', entityType: 'System' }, tx)

    expect(tx.employee.findUnique).not.toHaveBeenCalled()
    expect(rows[0].locationId).toBeNull()
  })

  it('hash payload NE vsebuje locationId (backward-kompatibilna veriga)', async () => {
    const rows: Array<Record<string, unknown>> = []
    const tx = fakeTx(rows, { 'emp-1': LOC_A })

    await realCreateAuditLog(
      { userId: 'emp-1', action: 'ACT', entityType: 'X', entityId: 'e1', details: { k: 1 } },
      tx,
    )

    // chainHash je izračunan iz (previousHash, action, entityType, entityId, userId, details)
    // — ponovimo izračun brez locationId in mora biti enak zapisanemu.
    const crypto = await import('crypto')
    const payload = ['prev-hash', 'ACT', 'X', 'e1', 'emp-1', JSON.stringify({ k: 1 })].join('|')
    const expected = crypto.createHash('sha256').update(payload).digest('hex')
    expect(rows[0].chainHash).toBe(expected)
  })
})

describe('R81: GET /api/audit — tenant scoping', () => {
  it('location-bound admin → where.locationId = seja lokacija', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A },
      error: null,
    })
    mocks.auditLogFindMany.mockResolvedValue([])
    mocks.auditLogCount.mockResolvedValue(0)

    const res = await auditGET(new Request(`http://localhost/api/audit`) as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    const where = mocks.auditLogFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe(LOC_A)
    expect(body.total).toBe(0)
    expect(mocks.auditLogCount.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('super-admin (brez lokacije) → brez locationId filtra (globalni pogled)', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-9', role: 'admin', locationId: null },
      error: null,
    })
    mocks.auditLogFindMany.mockResolvedValue([])
    mocks.auditLogCount.mockResolvedValue(0)

    const res = await auditGET(new Request(`http://localhost/api/audit`) as never)

    expect(res.status).toBe(200)
    const where = mocks.auditLogFindMany.mock.calls[0][0].where
    expect('locationId' in where).toBe(false)
  })

  it('ne-admin brez lokacije → 403 fail-closed, brez DB klicev', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-2', role: 'staff', locationId: null },
      error: null,
    })

    const res = await auditGET(new Request(`http://localhost/api/audit`) as never)

    expect(res.status).toBe(403)
    expect(mocks.auditLogFindMany).not.toHaveBeenCalled()
    expect(mocks.auditLogCount).not.toHaveBeenCalled()
  })

  it('?locationId query override za location-bound admina se IGNORIRA', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A },
      error: null,
    })
    mocks.auditLogFindMany.mockResolvedValue([])
    mocks.auditLogCount.mockResolvedValue(0)

    await auditGET(new Request(`http://localhost/api/audit?locationId=${LOC_B}`) as never)

    const where = mocks.auditLogFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe(LOC_A) // seja, ne query!
  })
})

describe('R81: POST /api/audit — ročni vnos dobi lokacijo seje', () => {
  it('location-bound admin → zapis z locationId = seja lokacija', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A },
      error: null,
    })
    mocks.auditLogCreate.mockResolvedValue({ id: 'al-new' })

    const req = new Request('http://localhost/api/audit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'MANUAL_AUDIT_NOTE', entityType: 'Order', entityId: 'ord-1' }),
    })
    const res = await auditPOST(req as never)

    expect(res.status).toBe(201)
    expect(mocks.auditLogCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
    expect(mocks.auditLogCreate.mock.calls[0][0].data.userId).toBe('emp-1')
  })
})

describe('R81: GET /api/notifications — tenant scoping + PII strip', () => {
  it('location-bound admin → list + stats scoped na svojo lokacijo', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A },
      error: null,
    })
    mocks.auditLogFindMany
      .mockResolvedValueOnce([]) // list
      .mockResolvedValueOnce([]) // byActionAndChannel (stats)
    mocks.auditLogCount.mockResolvedValue(0)

    const res = await notificationsGET(new Request('http://localhost/api/notifications') as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    const listWhere = mocks.auditLogFindMany.mock.calls[0][0].where
    expect(listWhere.locationId).toBe(LOC_A)
    // stats counta prav tako scoped
    expect(mocks.auditLogCount.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.auditLogCount.mock.calls[1][0].where.locationId).toBe(LOC_A)
    expect(body.total).toBe(0)
  })

  it('super-admin → brez locationId filtra; recipient PII ostaja odstranjen', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-9', role: 'admin', locationId: null },
      error: null,
    })
    mocks.auditLogFindMany
      .mockResolvedValueOnce([
        { id: 'n1', action: 'NOTIFICATION_SENT', details: JSON.stringify({ channel: 'sms', recipient: '+38640123456', subject: 'Rezervacija' }) },
      ])
      .mockResolvedValueOnce([]) // stats
    mocks.auditLogCount.mockResolvedValue(1)

    const res = await notificationsGET(new Request('http://localhost/api/notifications') as never)
    const body = await res.json()

    const listWhere = mocks.auditLogFindMany.mock.calls[0][0].where
    expect('locationId' in listWhere).toBe(false)
    expect(body.notifications).toHaveLength(1)
    const raw = body.notifications[0].details
    const details = typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, unknown>)
    expect(details.recipient).toBeUndefined() // PII strip (R80, defense-in-depth)
    expect(details.channel).toBe('sms')
    expect(details.subject).toBe('Rezervacija')
  })
})
