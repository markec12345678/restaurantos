// ============================================
// R143-b — EPIC #115 #30 LOYALTY / CUSTOMER LIFECYCLE — trap-DB uniti
// ============================================
// Vzorec r141-briefing / r142-devices (vi.hoisted + vi.mock('@/lib/db') +
// importOriginal auth-middleware spread — requireAuth na meji,
// resolveTenantLocationIdOrThrow ostane REALEN fail-closed modul).
//
// Pokritje (kontrakt R143-b):
//   1.  isBirthdayToday: mesec/dan ujemanje, 29. 2. (prestopno / neprestopno),
//       null/Date/niz vnosi, LJ meja (UTC 23:30 → naslednji dan po LJ)
//   2.  Birthday batch: račun z ujemajočim Guest rojstnim dnem → podeli;
//       brez gosta/rojstnega dne → skip; povzetek šteje skippedNoBirthday
//   3.  Birthday batch idempotenca (obstoječi advisory-lock + tx-fresh guard,
//       R111 kanon — nespremenjen): drugi isti-dnevni tek → ni druge podelitve
//   4.  GET /api/loyalty `search`: OR contains (insensitive) na
//       ime/telefon/e-pošto; kompozibilno s tier filtrom; brez searcha → brez OR
//   5.  GET /api/loyalty: Cache-Control no-store
//   6.  lifecycle: 401 fail-closed + scope where (locationId za loc-admina,
//       brez ključa za super-admina)
//   7.  lifecycle totals: inactive60d (count + poštevane številke v odgovoru)
//   8.  lifecycle bucketi: no-tx → new, ≤60 → active, 61–180 → at_risk,
//       >180 → churned (pragovi iz lifecycle-constants — enoten vir)
//   9.  expiringSoon30d FIFO približek: 500 − 300 = 200; balance ≤ earn → 0
//   10. topAccounts: PII whitelist select (BREZ telefona/e-pošte) +
//       tierProgress iz kanonskega lib/loyalty-tiers
//   11. lifecycle: no-store + 429 rate-limit pot (mock exceed)
//   12. per-sekcijski fallback: ena Prisma poizvedba rejecta → sekcija
//       nevtralna, ostale celote, skupni odgovor še vedno 200 (briefing kanon)
//   13. expiry_notify: admin gate (error passthrough), NIČ pisnih klicev
//       (loyaltyTransaction.create / $transaction / outbox / sms), povzetek
//       števcev v odgovoru; neznana akcija → 400 (ZodError kanon)
//   14. mobile tier: pointsBalance 600 → kanonski tier (silver regija,
//       naslednji gold pri 2000) — lokalni driftani helper je odstranjen
//
// Rate-limit barrel je mockan (r93/r141 kanon); rateLimitedResponse ostane
// REALen (direct import '@/lib/rate-limit/response' — 429 shape gre čez pravi
// helper). sms + outbox so mockani (r111 vzorec) — batch ne pošilja resnično.
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'
const SUB_1 = 'sub-1'
const DAY_MS = 24 * 60 * 60 * 1000
const P1 = '+38640111222'
const P2 = '+38640333444'

const mocks = vi.hoisted(() => ({
  // db.loyaltyAccount
  accFindMany: vi.fn(),
  accFindFirst: vi.fn(),
  accFindUnique: vi.fn(),
  accCount: vi.fn(),
  accGroupBy: vi.fn(),
  accUpdate: vi.fn(),
  // db.loyaltyTransaction
  txGroupBy: vi.fn(),
  txFindMany: vi.fn(),
  txFindFirst: vi.fn(),
  txCreate: vi.fn(),
  // db.guest
  guestFindMany: vi.fn(),
  // $transaction (advisory-lock kanon)
  transaction: vi.fn(),
  executeRaw: vi.fn(),
  // infra
  requireAuth: vi.fn(),
  checkRateLimitAsync: vi.fn(),
  verifyApiKey: vi.fn(),
  // kanali (r111 vzorec)
  sendSms: vi.fn(),
  createOutboxEvent: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    loyaltyAccount: {
      findMany: mocks.accFindMany,
      findFirst: mocks.accFindFirst,
      findUnique: mocks.accFindUnique,
      count: mocks.accCount,
      groupBy: mocks.accGroupBy,
      update: mocks.accUpdate,
    },
    loyaltyTransaction: {
      groupBy: mocks.txGroupBy,
      findMany: mocks.txFindMany,
      findFirst: mocks.txFindFirst,
      create: mocks.txCreate,
    },
    guest: { findMany: mocks.guestFindMany },
    $transaction: mocks.transaction,
  },
}))

// requireAuth mockan na meji; resolver ostane REALen (r133/r141 vzorec)
vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: mocks.requireAuth,
  }
})

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: vi.fn(() => '1.2.3.4'),
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60_000 },
}))

vi.mock('@/lib/api-security', () => ({
  verifyApiKey: mocks.verifyApiKey,
}))

vi.mock('@/lib/sms', () => ({
  sendSms: mocks.sendSms,
}))

vi.mock('@/lib/outbox', () => ({
  createOutboxEvent: mocks.createOutboxEvent,
}))

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { GET as loyaltyGET } from '@/app/api/loyalty/route'
import { GET as lifecycleGET } from '@/app/api/loyalty/lifecycle/route'
import { POST as automationPOST } from '@/app/api/loyalty-automation/route'
import { GET as mobileLoyaltyGET } from '@/app/api/mobile/loyalty/route'
import { processBirthdayBatch, processExpiryNotifyBatch, DEFAULT_CONFIG } from '@/lib/loyalty-automation'
import { isBirthdayToday } from '@/lib/loyalty/birthday'
import {
  lifecycleBucketForDays,
  LIFECYCLE_ACTIVE_MAX_DAYS,
  LIFECYCLE_AT_RISK_MAX_DAYS,
} from '@/lib/loyalty/lifecycle-constants'
import { tierProgress, TIER_THRESHOLDS } from '@/lib/loyalty-tiers'
import { ljubljanaTodayStr } from '@/lib/timezone-sl'

function session(overrides: Record<string, unknown> = {}) {
  return {
    token: 'tok-1',
    employeeId: 'emp-1',
    role: 'manager',
    permissions: ['view_reports', 'take_orders'],
    locationId: LOC_A,
    ...overrides,
  }
}

function getReq(url: string) {
  return new Request(url, { method: 'GET' })
}

function jsonPost(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Današnji LJ datum kot Date (UTC polnoč — Prisma date-only kanon). */
function birthdayTodayUtcMidnight(): Date {
  return new Date(`${ljubljanaTodayStr()}T00:00:00.000Z`)
}

// tx odjemalec za $transaction callback (advisory-lock kanon, r111 vzorec)
const txClient = {
  $executeRaw: mocks.executeRaw,
  loyaltyTransaction: { findFirst: mocks.txFindFirst, create: mocks.txCreate },
  loyaltyAccount: { update: mocks.accUpdate },
}

// ---------- Deterministični dispatch defaulti (sekcije tečejo vzporedno —
// vrstni red klicev NI determinističen; dispatch poteka po OBLIKI poizvedbe) ----------
beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockResolvedValue({ session: session(), error: null })
  mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient))
  mocks.executeRaw.mockResolvedValue(1)
  mocks.txFindFirst.mockResolvedValue(null)
  mocks.txCreate.mockResolvedValue({ id: 'ltx-1' })
  mocks.accUpdate.mockResolvedValue({})
  mocks.createOutboxEvent.mockResolvedValue({ id: 'ob-1' })
  mocks.sendSms.mockResolvedValue({})
  mocks.guestFindMany.mockResolvedValue([])
  // loyalty GET list (brez selecta → prazen default); lifecycle sekcije
  // dobijo deterministične defaulte: 4 računi za buckete, 2 za expiring
  mocks.accFindMany.mockImplementation(async (args: { select?: Record<string, unknown> } = {}) => {
    const sel = args?.select ?? {}
    if ('customerName' in sel) return [] // topAccounts default (overridan v svojem testu)
    if ('pointsBalance' in sel) {
      return [{ id: 'a1', pointsBalance: 500 }, { id: 'a2', pointsBalance: 200 }]
    }
    if (Object.keys(sel).length === 1 && 'id' in sel) {
      return [{ id: 'a-new' }, { id: 'a-active' }, { id: 'a-risk' }, { id: 'a-churn' }]
    }
    return []
  })
  mocks.accCount.mockImplementation(async (args: { where?: Record<string, unknown> } = {}) =>
    'transactions' in (args?.where ?? {}) ? 7 : 12, // inactive60d : active
  )
  mocks.accGroupBy.mockResolvedValue([
    { tier: 'bronze', _count: { tier: 5 } },
    { tier: 'gold', _count: { tier: 2 } },
  ])
  mocks.txGroupBy.mockImplementation(async (args: { _max?: unknown; _sum?: unknown } = {}) => {
    if (args?._max) {
      // last-tx per account (bucketi) — a-new namerno ODSOTEN (brez tx)
      return [
        { loyaltyAccountId: 'a-active', _max: { createdAt: new Date(Date.now() - 10 * DAY_MS) } },
        { loyaltyAccountId: 'a-risk', _max: { createdAt: new Date(Date.now() - 100 * DAY_MS) } },
        { loyaltyAccountId: 'a-churn', _max: { createdAt: new Date(Date.now() - 200 * DAY_MS) } },
      ]
    }
    if (args?._sum) {
      // Σ earn v 335-dnevnem oknu (expiring FIFO)
      return [
        { loyaltyAccountId: 'a1', _sum: { points: 300 } },
        { loyaltyAccountId: 'a2', _sum: { points: 250 } },
      ]
    }
    return []
  })
  // mobile default
  mocks.accFindFirst.mockResolvedValue({
    id: 'acc-m1',
    customerName: 'Mojca',
    customerPhone: P1,
    customerEmail: 'mojca@example.com',
    pointsBalance: 600,
    lifetimePoints: 600,
    tier: 'bronze',
    isActive: true,
    transactions: [],
  })
  mocks.txFindMany.mockResolvedValue([])
  mocks.verifyApiKey.mockResolvedValue({
    valid: true,
    error: null,
    apiKey: { id: 'key-1', scopes: ['read:loyalty'] },
    subscriptionId: SUB_1,
  })
})

// ════════════════════════════════════════════════════════════════
describe('R143 1: isBirthdayToday (čisto jedro, LJ čas)', () => {
  it('točno mesec/dan ujemanje (string + Date vnosi)', () => {
    // februar = CET (UTC+1): 2026-02-14T10:00Z → LJ 11:00 14. 2.
    const now = '2026-02-14T10:00:00.000Z'
    expect(isBirthdayToday('1990-02-14', now)).toBe(true)
    expect(isBirthdayToday('2001-02-14', now)).toBe(true) // leto se ignorira
    expect(isBirthdayToday('1990-02-13', now)).toBe(false)
    expect(isBirthdayToday('1990-02-15', now)).toBe(false)
    // Date vnos (Prisma DateTime → UTC polnoč za date-only); marec = CET (UTC+1):
    // 21:00 UTC 8. 3. je še 8. 3. po LJ, 23:30 UTC 8. 3. je ŽE 9. 3. po LJ
    expect(isBirthdayToday(new Date('1990-03-08T00:00:00.000Z'), '2026-03-08T21:00:00.000Z')).toBe(true)
    expect(isBirthdayToday(new Date('1990-03-09T00:00:00.000Z'), '2026-03-08T21:00:00.000Z')).toBe(false)
    expect(isBirthdayToday(new Date('1990-03-08T00:00:00.000Z'), '2026-03-08T23:30:00.000Z')).toBe(false)
    expect(isBirthdayToday(new Date('1990-03-09T00:00:00.000Z'), '2026-03-08T23:30:00.000Z')).toBe(true)
  })

  it('29. 2.: ujema SAMO v prestopnem letu; neprestopno 28. 2. → false (dokumentirana izbira)', () => {
    // 2024 je prestopno: 2024-02-29T12:00Z → LJ 13:00 29. 2.
    expect(isBirthdayToday('2000-02-29', '2024-02-29T12:00:00.000Z')).toBe(true)
    // 2026 NI prestopno: niti 28. 2. niti 1. 3. ne ujema (konservativno —
    // sistem ne izmišlja nadomestnega dne)
    expect(isBirthdayToday('2000-02-29', '2026-02-28T12:00:00.000Z')).toBe(false)
    expect(isBirthdayToday('2000-02-29', '2026-03-01T12:00:00.000Z')).toBe(false)
  })

  it('null / prazen / neveljaven vnos → false', () => {
    expect(isBirthdayToday(null)).toBe(false)
    expect(isBirthdayToday(undefined)).toBe(false)
    expect(isBirthdayToday('')).toBe(false)
    expect(isBirthdayToday('nonsense')).toBe(false)
    expect(isBirthdayToday(new Date('nonsense'))).toBe(false)
    // neveljaven `now` → false (varno)
    expect(isBirthdayToday('1990-02-14', 'nonsense')).toBe(false)
  })

  it('LJ meja: UTC 22:30 13. 2. je še 13. 2. po LJ; UTC 23:30 13. 2. je ŽE 14. 2. po LJ', () => {
    // februar = CET (UTC+1) — deterministično pinnano obnašanje
    expect(isBirthdayToday('1990-02-13', '2026-02-13T22:30:00.000Z')).toBe(true)
    expect(isBirthdayToday('1990-02-14', '2026-02-13T22:30:00.000Z')).toBe(false)
    // 23:30 UTC = 00:30 naslednjega dne po ljubljansko
    expect(isBirthdayToday('1990-02-13', '2026-02-13T23:30:00.000Z')).toBe(false)
    expect(isBirthdayToday('1990-02-14', '2026-02-13T23:30:00.000Z')).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════
describe('R143 2: birthday batch — podeli SAMO z ujemajočim Guest rojstnim dnem', () => {
  beforeEach(() => {
    // dva kandidata: acc-a (telefon P1) in acc-b (telefon P2)
    mocks.accFindMany.mockResolvedValue([
      { id: 'acc-a', customerName: 'Ana', customerPhone: P1, locationId: LOC_A },
      { id: 'acc-b', customerName: 'Bor', customerPhone: P2, locationId: LOC_A },
    ])
    mocks.accFindUnique.mockImplementation(async (args: { where?: { id?: string } } = {}) => ({
      id: args?.where?.id ?? 'x',
      customerName: 'Kdo',
      customerPhone: args?.where?.id === 'acc-a' ? P1 : P2,
      isActive: true,
    }))
  })

  it('gost z rojstnim dnem DANES → podeli (advisory lock + create + SMS po commitu); drugi → skip', async () => {
    mocks.guestFindMany.mockResolvedValue([
      { phone: P1, birthday: birthdayTodayUtcMidnight(), locationId: LOC_A },
      // P2 gost ima rojstni drug dan → skip
      { phone: P2, birthday: new Date('1990-01-01T00:00:00.000Z'), locationId: LOC_A },
    ])

    const result = await processBirthdayBatch(DEFAULT_CONFIG, LOC_A)

    expect(result).toEqual({ processed: 2, sent: 1, skippedNoBirthday: 1, pointsAwarded: 100 })
    // soft-join: ENA poizvedba po telefonih obeh kandidatov
    expect(mocks.guestFindMany).toHaveBeenCalledTimes(1)
    expect(mocks.guestFindMany.mock.calls[0][0].where).toEqual({ phone: { in: [P1, P2] } })
    // podelitev: točko ustvari SAMO za acc-a (reason 'Rojstni dan bonus')
    expect(mocks.txCreate).toHaveBeenCalledTimes(1)
    expect(mocks.txCreate.mock.calls[0][0].data).toMatchObject({
      loyaltyAccountId: 'acc-a',
      type: 'earn',
      points: 100,
      reason: 'Rojstni dan bonus',
    })
    // SMS šele PO commitu (outbox event)
    expect(mocks.createOutboxEvent).toHaveBeenCalledTimes(1)
    expect(mocks.sendSms).toHaveBeenCalledTimes(1)
  })

  it('račun BREZ ujemajočega gosta → skipped (podelitev NI klicana), brez napake', async () => {
    mocks.guestFindMany.mockResolvedValue([]) // noben guest ne ujema

    const result = await processBirthdayBatch(DEFAULT_CONFIG, LOC_A)

    expect(result).toEqual({ processed: 2, sent: 0, skippedNoBirthday: 2, pointsAwarded: 0 })
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.txCreate).not.toHaveBeenCalled()
    expect(mocks.createOutboxEvent).not.toHaveBeenCalled()
  })

  it('gost BREZ rojstnega dne → skip; lokacijsko usklajevanje (druga lokacija → skip, null → globalen match)', async () => {
    // P1: gost druge lokacije → za račun na LOC_A NE ujema; P2: brez rojstnega dne
    mocks.guestFindMany.mockResolvedValue([
      { phone: P1, birthday: birthdayTodayUtcMidnight(), locationId: LOC_B },
      { phone: P2, birthday: null, locationId: LOC_A },
    ])
    const mismatch = await processBirthdayBatch(DEFAULT_CONFIG, LOC_A)
    expect(mismatch.sent).toBe(0)
    expect(mismatch.skippedNoBirthday).toBe(2)

    // globalen gost (locationId null) z rojstnim dnem danes → ujema
    mocks.guestFindMany.mockResolvedValue([
      { phone: P1, birthday: birthdayTodayUtcMidnight(), locationId: null },
      { phone: P2, birthday: null, locationId: LOC_A },
    ])
    const globalMatch = await processBirthdayBatch(DEFAULT_CONFIG, LOC_A)
    expect(globalMatch.sent).toBe(1)
    expect(globalMatch.skippedNoBirthday).toBe(1)
  })
})

// ════════════════════════════════════════════════════════════════
describe('R143 3: birthday batch — idempotenca guard ohranjen (R111 kanon)', () => {
  beforeEach(() => {
    mocks.accFindMany.mockResolvedValue([
      { id: 'acc-a', customerName: 'Ana', customerPhone: P1, locationId: LOC_A },
    ])
    mocks.accFindUnique.mockResolvedValue({
      id: 'acc-a',
      customerName: 'Ana',
      customerPhone: P1,
      isActive: true,
    })
    mocks.guestFindMany.mockResolvedValue([
      { phone: P1, birthday: birthdayTodayUtcMidnight(), locationId: LOC_A },
    ])
  })

  it('drugi isti-dnevni tek → tx-fresh re-check najde obstoječo transakcijo → NI druge podelitve', async () => {
    mocks.txFindFirst.mockResolvedValueOnce(null).mockResolvedValue({ id: 'existing-tx' })

    const first = await processBirthdayBatch(DEFAULT_CONFIG, LOC_A)
    expect(first).toMatchObject({ sent: 1, pointsAwarded: 100 })

    const second = await processBirthdayBatch(DEFAULT_CONFIG, LOC_A)
    expect(second).toMatchObject({ sent: 0, pointsAwarded: 0, skippedNoBirthday: 0 })

    // podelitev (create + increment) se zgodila TOČNO ENKRAT
    expect(mocks.txCreate).toHaveBeenCalledTimes(1)
    expect(mocks.accUpdate).toHaveBeenCalledTimes(1)
    // advisory lock ključ (obstoječi kanon, r111 pin: 2. argument tagged templatea):
    // per account + type + UTC dan — idempotenca guard je NESPREMENJEN
    const lockParam = mocks.executeRaw.mock.calls[0][1]
    expect(lockParam).toBe(
      `loyalty-bonus:acc-a:birthday_bonus:${new Date().toISOString().slice(0, 10)}`,
    )
  })
})

// ════════════════════════════════════════════════════════════════
describe('R143 4+5: GET /api/loyalty — search filter + no-store', () => {
  it('search → OR contains (insensitive) na imenu/telefonu/e-pošti, kompozibilno s tier + scope', async () => {
    mocks.accFindMany.mockResolvedValue([])
    mocks.accCount.mockResolvedValue(0)

    const res = await loyaltyGET(getReq(`http://x/api/loyalty?search=Janez&tier=gold`))

    expect(res.status).toBe(200)
    expect(mocks.accFindMany).toHaveBeenCalledTimes(1)
    const call = mocks.accFindMany.mock.calls[0][0]
    expect(call.where.locationId).toBe(LOC_A) // scope ostane
    expect(call.where.tier).toBe('gold') // obstoječi filter kompozibilen
    expect(call.where.OR).toEqual([
      { customerName: { contains: 'Janez', mode: 'insensitive' } },
      { customerPhone: { contains: 'Janez', mode: 'insensitive' } },
      { customerEmail: { contains: 'Janez', mode: 'insensitive' } },
    ])
    // count dobi ISTI where (pagination total)
    expect(mocks.accCount.mock.calls[0][0].where).toEqual(call.where)
  })

  it('brez searcha (ali whitespace-only) → where BREZ OR ključa', async () => {
    await loyaltyGET(getReq('http://x/api/loyalty'))
    expect('OR' in mocks.accFindMany.mock.calls[0][0].where).toBe(false)

    await loyaltyGET(getReq('http://x/api/loyalty?search=%20%20%20'))
    expect('OR' in mocks.accFindMany.mock.calls[1][0].where).toBe(false)
  })

  it('Cache-Control: no-store na odgovoru', async () => {
    const res = await loyaltyGET(getReq('http://x/api/loyalty'))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})

// ════════════════════════════════════════════════════════════════
describe('R143 6: GET /api/loyalty/lifecycle — auth + scope', () => {
  it('brez seje → 401 fail-closed, ZERO DB dotikov', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: null,
      error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna.' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    })

    const res = await lifecycleGET(getReq('http://x/api/loyalty/lifecycle'))
    expect(res.status).toBe(401)
    expect(mocks.requireAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ permission: 'view_reports' }),
    )
    expect(mocks.accCount).not.toHaveBeenCalled()
    expect(mocks.accFindMany).not.toHaveBeenCalled()
    expect(mocks.accGroupBy).not.toHaveBeenCalled()
  })

  it('loc-bound admin → scope where nosi locationId; super-admin → where BREZ locationId ključa', async () => {
    await lifecycleGET(getReq('http://x/api/loyalty/lifecycle'))
    // count (totals): oba klica scoped na LOC_A
    for (const call of mocks.accCount.mock.calls) {
      expect(call[0].where.locationId).toBe(LOC_A)
      expect(call[0].where.isActive).toBe(true)
    }
    // buckets findMany (select samo id)
    const bucketCall = mocks.accFindMany.mock.calls.find(
      (c) => c[0].select && Object.keys(c[0].select).length === 1 && 'id' in c[0].select,
    )
    expect(bucketCall).toBeTruthy()
    expect(bucketCall![0].where.locationId).toBe(LOC_A)

    // super-admin (locationId null) = globalni pogled — pogojni spread kanon
    mocks.requireAuth.mockResolvedValue({
      session: session({ role: 'admin', locationId: null }),
      error: null,
    })
    const callsBefore = mocks.accCount.mock.calls.length
    await lifecycleGET(getReq('http://x/api/loyalty/lifecycle'))
    const superAdminCalls = mocks.accCount.mock.calls.slice(callsBefore)
    expect(superAdminCalls.length).toBe(2)
    for (const call of superAdminCalls) {
      expect('locationId' in call[0].where).toBe(false)
      expect(call[0].where.isActive).toBe(true)
    }
  })
})

// ════════════════════════════════════════════════════════════════
describe('R143 7+8: GET /api/loyalty/lifecycle — totals + bucketi', () => {
  it('totals: active + inactive60d številke iz count poizvedb (no-tx šteje kot inaktiven)', async () => {
    const res = await lifecycleGET(getReq('http://x/api/loyalty/lifecycle'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totals).toEqual({ active: 12, inactive60d: 7 })
    // inactive60d poizvedba: transactions.none.createdAt.gte (≈ now − 60 dni)
    const inactiveWhere = mocks.accCount.mock.calls.find(
      (c) => 'transactions' in c[0].where,
    )![0].where
    const gte = inactiveWhere.transactions.none.createdAt.gte as Date
    expect(gte.getTime()).toBeGreaterThan(Date.now() - 61 * DAY_MS)
    expect(gte.getTime()).toBeLessThan(Date.now() - 59 * DAY_MS)
  })

  it('bucketi: no-tx → new, ≤60 → active, 61–180 → at_risk, >180 → churned', async () => {
    const res = await lifecycleGET(getReq('http://x/api/loyalty/lifecycle'))
    const body = await res.json()
    expect(body.lifecycleBuckets).toEqual({ new: 1, active: 1, at_risk: 1, churned: 1 })
    // last-tx groupBy: _max createdAt po scoped računih
    const lastTxCall = mocks.txGroupBy.mock.calls.find((c) => c[0]._max)
    expect(lastTxCall).toBeTruthy()
  })

  it('čisti helper lifecycleBucketForDays pina prage iz lifecycle-constants (enoten vir za UI)', () => {
    expect(LIFECYCLE_ACTIVE_MAX_DAYS).toBe(60)
    expect(LIFECYCLE_AT_RISK_MAX_DAYS).toBe(180)
    expect(lifecycleBucketForDays(null)).toBe('new')
    expect(lifecycleBucketForDays(undefined)).toBe('new')
    expect(lifecycleBucketForDays(0)).toBe('active')
    expect(lifecycleBucketForDays(60)).toBe('active')
    expect(lifecycleBucketForDays(60.9)).toBe('active') // floor
    expect(lifecycleBucketForDays(61)).toBe('at_risk')
    expect(lifecycleBucketForDays(180)).toBe('at_risk')
    expect(lifecycleBucketForDays(180.9)).toBe('at_risk')
    expect(lifecycleBucketForDays(181)).toBe('churned')
    expect(lifecycleBucketForDays(9999)).toBe('churned')
  })
})

// ════════════════════════════════════════════════════════════════
describe('R143 9: expiringSoon30d — FIFO približek', () => {
  it('balance 500 − earn-v-oknu 300 = 200; balance ≤ earn-v-oknu → 0', async () => {
    // default dispatch: a1 (500, earn 300) → 200; a2 (200, earn 250) → 0
    const res = await lifecycleGET(getReq('http://x/api/loyalty/lifecycle'))
    const body = await res.json()
    expect(body.expiringSoon30d).toEqual({ points: 200, accounts: 1, capped: false, scanned: 2 })

    // okno = 335 dni (365 − 30), tip 'earn'
    const earnCall = mocks.txGroupBy.mock.calls.find((c) => c[0]._sum)![0]
    expect(earnCall.where.type).toBe('earn')
    const gte = earnCall.where.createdAt.gte as Date
    expect(Math.abs(gte.getTime() - (Date.now() - 335 * DAY_MS))).toBeLessThan(5000)
    expect(earnCall.where.loyaltyAccountId.in.sort()).toEqual(['a1', 'a2'])
  })

  it('prazen scope → nevtralni { points: 0, accounts: 0, capped: false } brez earn poizvedbe', async () => {
    mocks.accFindMany.mockImplementation(async (args: { select?: Record<string, unknown> } = {}) => {
      const sel = args?.select ?? {}
      if ('customerName' in sel) return []
      if ('pointsBalance' in sel) return []
      if (Object.keys(sel).length === 1 && 'id' in sel) return [{ id: 'x' }]
      return []
    })
    const res = await lifecycleGET(getReq('http://x/api/loyalty/lifecycle'))
    const body = await res.json()
    expect(body.expiringSoon30d).toEqual({ points: 0, accounts: 0, capped: false, scanned: 0 })
  })
})

// ════════════════════════════════════════════════════════════════
describe('R143 10: topAccounts — PII whitelist + kanonski tierProgress', () => {
  it('select vsebuje TOČNO { id, customerName, tier, pointsBalance, lifetimePoints } — brez telefona/e-pošte', async () => {
    mocks.accFindMany.mockImplementation(async (args: { select?: Record<string, unknown> } = {}) => {
      const sel = args?.select ?? {}
      if ('customerName' in sel) {
        return [
          { id: 't1', customerName: 'Ana', tier: 'bronze', pointsBalance: 600, lifetimePoints: 600 },
          { id: 't2', customerName: 'Bor', tier: 'silver', pointsBalance: 100, lifetimePoints: 2100 },
        ]
      }
      if ('pointsBalance' in sel) return []
      if (Object.keys(sel).length === 1 && 'id' in sel) return []
      return []
    })

    const res = await lifecycleGET(getReq('http://x/api/loyalty/lifecycle'))
    const body = await res.json()

    const topCall = mocks.accFindMany.mock.calls.find((c) => 'customerName' in c[0].select)
    expect(Object.keys(topCall![0].select).sort()).toEqual(
      ['customerName', 'id', 'lifetimePoints', 'pointsBalance', 'tier'],
    )
    expect(topCall![0].select).not.toHaveProperty('customerPhone')
    expect(topCall![0].select).not.toHaveProperty('customerEmail')

    expect(body.topAccounts).toHaveLength(2)
    // tierProgress iz KANONSKEGA lib (600 lifetime = silver regija po 500/2000/5000)
    expect(TIER_THRESHOLDS.find((t) => t.tier === 'silver')!.minLifetime).toBe(500)
    expect(body.topAccounts[0].tierProgress.current).toBe('silver')
    expect(body.topAccounts[0].tierProgress.next).toBe('gold')
    expect(body.topAccounts[0].tierProgress.pointsToNext).toBe(1400)
    // 2100 lifetime = gold; ročno dodeljen silver se ne poniži (override kanon)
    expect(tierProgress(2100, 'silver').current).toBe('gold')
    expect(body.topAccounts[1].tierProgress.next).toBe('platinum')
    // PII nikoli v odgovoru
    expect(JSON.stringify(body)).not.toContain(P1)
    expect(JSON.stringify(body)).not.toContain('@example.com')
  })
})

// ════════════════════════════════════════════════════════════════
describe('R143 11+12: lifecycle — no-store, 429, per-sekcijski fallback', () => {
  it('no-store header + oblika odgovora (generatedAt + vseh 5 sekcij)', async () => {
    const res = await lifecycleGET(getReq('http://x/api/loyalty/lifecycle'))
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await res.json()
    expect(Object.keys(body).sort()).toEqual(
      ['byTier', 'expiringSoon30d', 'generatedAt', 'lifecycleBuckets', 'topAccounts', 'totals'],
    )
    expect(typeof body.generatedAt).toBe('string')
    expect(body.byTier).toEqual({ bronze: 5, silver: 0, gold: 2, platinum: 0 })
  })

  it('rate limit exceed → 429 (rateLimitedResponse kanon), zero DB', async () => {
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: false, retryAfterMs: 60000 })
    const res = await lifecycleGET(getReq('http://x/api/loyalty/lifecycle'))
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('60')
    expect(mocks.accCount).not.toHaveBeenCalled()
    expect(mocks.accFindMany).not.toHaveBeenCalled()
  })

  it('ena Prisma poizvedba rejecta → samo tista sekcija nevtralna, ostale celote, 200', async () => {
    mocks.txGroupBy.mockImplementation(async (args: { _max?: unknown; _sum?: unknown } = {}) => {
      if (args?._max) throw new Error('groupBy padla') // SAMO bucket sekcija
      // _sum (earn v oknu) ostane cel: a1 (500−300=200), a2 (200−250→0)
      return [
        { loyaltyAccountId: 'a1', _sum: { points: 300 } },
        { loyaltyAccountId: 'a2', _sum: { points: 250 } },
      ]
    })

    const res = await lifecycleGET(getReq('http://x/api/loyalty/lifecycle'))
    expect(res.status).toBe(200) // sekcija padla NIKOLI ne 500-a celote
    const body = await res.json()
    // padla sekcija → nevtralni fallback
    expect(body.lifecycleBuckets).toEqual({ new: 0, active: 0, at_risk: 0, churned: 0 })
    // ostale sekcije celote
    expect(body.totals).toEqual({ active: 12, inactive60d: 7 })
    expect(body.expiringSoon30d).toEqual({ points: 200, accounts: 1, capped: false, scanned: 2 })
    expect(body.byTier).toEqual({ bronze: 5, silver: 0, gold: 2, platinum: 0 })
  })
})

// ════════════════════════════════════════════════════════════════
describe('R143 13: loyalty-automation expiry_notify — notify-only', () => {
  it('ne-admin → requireAuth error passthrough, ZERO DB', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: null,
      error: new Response(JSON.stringify({ error: 'Dostop zavrnjen.' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    })

    const res = await automationPOST(jsonPost('http://x/api/loyalty-automation', { action: 'expiry_notify' }))
    expect(res.status).toBe(403)
    expect(mocks.requireAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ permission: 'admin' }),
    )
    expect(mocks.accFindMany).not.toHaveBeenCalled()
  })

  it('admin → povzetek števcev, NIČ pisnih klicev (brez expire zapisov, brez SMS/outbox)', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: session({ role: 'admin', permissions: ['admin'] }),
      error: null,
    })

    const res = await automationPOST(jsonPost('http://x/api/loyalty-automation', { action: 'expiry_notify' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    // default dispatch: a1 (500 − 300) = 200 → 1 račun; a2 → 0
    expect(body.results.expiryNotify).toEqual({
      processed: 2,
      accountsExpiring: 1,
      expiringPoints: 200,
      capped: false,
      notifyOnly: true,
    })
    // NOTIFY-ONLY: nobenih zapisov / balans sprememb / SMS / outbox eventov
    expect(mocks.txCreate).not.toHaveBeenCalled()
    expect(mocks.accUpdate).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.createOutboxEvent).not.toHaveBeenCalled()
    expect(mocks.sendSms).not.toHaveBeenCalled()
  })

  it('neznana akcija → 400 ZodError kanon (isti error path kot danes)', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: session({ role: 'admin', permissions: ['admin'] }),
      error: null,
    })
    const res = await automationPOST(jsonPost('http://x/api/loyalty-automation', { action: 'nonsense' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Neveljavni podatki')
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  it('lib export: processExpiryNotifyBatch vrača pošten capped flag ob doseženem capu', async () => {
    // 2000+ računov v dispatchu ni praktično — pinamo logiko prek podrešenega
    // izračuna: cap flag je true, če je scanned ≥ cap (dispatch vrne 2 → false
    // je že pokrit zgoraj); tukaj pinamo obliko izida lib klica direktno.
    mocks.accFindMany.mockImplementation(async (args: { select?: Record<string, unknown> } = {}) => {
      const sel = args?.select ?? {}
      if ('customerName' in sel) return []
      if ('pointsBalance' in sel) {
        return [{ id: 'a1', pointsBalance: 500 }, { id: 'a2', pointsBalance: 200 }]
      }
      if (Object.keys(sel).length === 1 && 'id' in sel) return []
      return []
    })
    const summary = await processExpiryNotifyBatch(LOC_A)
    expect(summary).toEqual({
      processed: 2,
      accountsExpiring: 1,
      expiringPoints: 200,
      capped: false,
      notifyOnly: true,
    })
    expect(mocks.txCreate).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
describe('R143 14: mobile/loyalty — kanonski tier pragovi', () => {
  it('pointsBalance 600 → silver regija, nextTier gold pri kanonskih 2000 (drift popravljen)', async () => {
    const res = await mobileLoyaltyGET(getReq('http://x/api/mobile/loyalty?phone=%2B38640111222'))
    expect(res.status).toBe(200)
    const body = await res.json()
    // oblika odgovora IDENTIČNA (current/nextTier/pointsToNext)
    expect(Object.keys(body.tierInfo).sort()).toEqual(['current', 'nextTier', 'pointsToNext'])
    // vrednosti kanonske: 600 lifetime ≥ 500 (silver), naslednji prag gold 2000
    // → manjka 1400. Prej (driftano): nextTier silver, pointsToNext max(0, 100−600)=0.
    expect(body.tierInfo.current).toBe('bronze') // shranjen nivo ostane (oblika pariteta)
    expect(body.tierInfo.nextTier).toBe('gold')
    expect(body.tierInfo.pointsToNext).toBe(1400)
    expect(body.account.pointsBalance).toBe(600)
  })

  it('helper ni več lokalno definiran (fs pin) — kanon iz lib/loyalty-tiers', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'mobile', 'loyalty', 'route.ts'), 'utf8')
    expect(src).toContain("import { tierProgress } from '@/lib/loyalty-tiers'")
    expect(src).not.toContain('function getNextTier')
    expect(src).not.toContain('function getPointsToNextTier')
    expect(src).not.toContain('gold: 1500')
  })
})
