// ============================================
// R96-a — Health deploy forenzika (version + commit)
// ============================================
// Produkcija je teko R95 kodo, /api/health pa je poročal zastarelo verzijo:
// legacy fallback '1.0.13' (hardcodiran ×4) je preživel bumpanje package.json
// (1.11.0). Poleg tega health NI izpostavljal commit SHA — deploy forenzika
// ("ali je produkcija sinhronizirana?") ni bila odgovorljiva z enim curl-om.
//
// Kanon te runde:
//   - NOV src/lib/app-info.ts: getAppVersion() (APP_VERSION, ki ga next.config
//     inlinira ob buildu) + getAppCommit() (VERCEL_GIT_COMMIT_SHA > GIT_COMMIT
//     > COMMIT_SHA > null — Vercel injicira prvega samodejno).
//   - health route: 4× version: getAppVersion() + 4× sestra commit:
//     getAppCommit() (ok/error/degraded/catch root — vsi konsistentni).
//   - Check logika (database/furs/stripe/sentry, $queryRawUnsafe) NESPREMENJENA.
//
// Hišni vzorec (r92/r93/r95): vi.hoisted + vi.mock tovarne + mockResolvedValue
// (nikoli .Once), zero-klic asserti na zavrnitvah, fs-guard za vir kanona.
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const mocks = vi.hoisted(() => ({
  queryRawUnsafe: vi.fn(),
  loggerError: vi.fn(),
  checkFursBootReadiness: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    $queryRawUnsafe: mocks.queryRawUnsafe,
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: mocks.loggerError },
}))

vi.mock('@/lib/furs/boot-guard', () => ({
  checkFursBootReadiness: mocks.checkFursBootReadiness,
}))

// Importi PO mockih
import { GET } from '@/app/api/health/route'
import { getAppVersion, getAppCommit } from '@/lib/app-info'

const makeReq = (path = '/api/health') =>
  new Request(`http://localhost${path}`, { method: 'GET' })

const readSrc = (relPath: string) =>
  readFileSync(join(process.cwd(), ...relPath.split('/')), 'utf-8')

/** Deterministično testno okolje: brez commit envov in brez optional servisov. */
const stubNoOptionalServices = () => {
  vi.stubEnv('APP_VERSION', undefined)
  vi.stubEnv('VERCEL_GIT_COMMIT_SHA', undefined)
  vi.stubEnv('GIT_COMMIT', undefined)
  vi.stubEnv('COMMIT_SHA', undefined)
  vi.stubEnv('REDIS_URL', undefined)
  vi.stubEnv('FURS_ENVIRONMENT', undefined)
  vi.stubEnv('FURS_ALLOW_SIMULATION', undefined)
  vi.stubEnv('FURS_CERT_PATH', undefined)
  vi.stubEnv('FURS_CERT_BASE64', undefined)
  vi.stubEnv('STRIPE_PUBLISHABLE_KEY', undefined)
  vi.stubEnv('STRIPE_SECRET_KEY', undefined)
  vi.stubEnv('SENTRY_DSN', undefined)
}

describe('R96-a: getAppVersion', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('A1: env override prevlada (runtime/Docker > inline)', () => {
    vi.stubEnv('APP_VERSION', '1.11.0')
    expect(getAppVersion()).toBe('1.11.0')
  })

  it('A2: brez APP_VERSION → "dev" (legacy "1.0.13" je ubit)', () => {
    vi.stubEnv('APP_VERSION', undefined)
    expect(getAppVersion()).toBe('dev')
  })

  it('A3: prazen APP_VERSION → "dev" (|| semantika)', () => {
    vi.stubEnv('APP_VERSION', '')
    expect(getAppVersion()).toBe('dev')
  })
})

describe('R96-a: getAppCommit — prioriteta VERCEL_GIT_COMMIT_SHA > GIT_COMMIT > COMMIT_SHA > null', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('B1: samo VERCEL_GIT_COMMIT_SHA → ta (Vercel deploy)', () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234')
    expect(getAppCommit()).toBe('abc1234')
  })

  it('B2: samo GIT_COMMIT → ta (Docker/CI brez Vercela)', () => {
    vi.stubEnv('GIT_COMMIT', 'def5678')
    expect(getAppCommit()).toBe('def5678')
  })

  it('B3: samo COMMIT_SHA → ta (tretja platforma)', () => {
    vi.stubEnv('COMMIT_SHA', 'feed0001')
    expect(getAppCommit()).toBe('feed0001')
  })

  it('B4: vsi trije → VERCEL_GIT_COMMIT_SHA zmaga (strožja prioriteta)', () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234')
    vi.stubEnv('GIT_COMMIT', 'def5678')
    vi.stubEnv('COMMIT_SHA', 'feed0001')
    expect(getAppCommit()).toBe('abc1234')
  })

  it('B5: GIT_COMMIT + COMMIT_SHA → GIT_COMMIT zmaga', () => {
    vi.stubEnv('GIT_COMMIT', 'def5678')
    vi.stubEnv('COMMIT_SHA', 'feed0001')
    expect(getAppCommit()).toBe('def5678')
  })

  it('B6: noben → null (lokalni dev — klicatelj odloči, kako prikaže)', () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', undefined)
    vi.stubEnv('GIT_COMMIT', undefined)
    vi.stubEnv('COMMIT_SHA', undefined)
    expect(getAppCommit()).toBeNull()
  })
})

describe('R96-a: GET /api/health — version + commit v VSEH response-rootih', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    // boot-guard default: ok (check logika nespremenjena — env veje žive naprej)
    mocks.checkFursBootReadiness.mockReturnValue({ ok: true, check: 'none' })
  })
  afterEach(() => vi.unstubAllEnvs())

  it('C1: simple ok → 200, version iz env, commit iz Vercel env, db pin SELECT 1', async () => {
    stubNoOptionalServices()
    vi.stubEnv('APP_VERSION', '1.11.0')
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234')
    mocks.queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }])

    const res = await GET(makeReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.version).toBe('1.11.0')
    expect(body.commit).toBe('abc1234')
    expect(body.database).toBe('connected')
    // check logika nespremenjena: tagged → $queryRawUnsafe('SELECT 1') kanon
    expect(mocks.queryRawUnsafe).toHaveBeenCalledTimes(1)
    expect(mocks.queryRawUnsafe).toHaveBeenCalledWith('SELECT 1')
  })

  it('C2: brez commit envov → commit polje VEDNO prisotno (vrednost null), version "dev"', async () => {
    stubNoOptionalServices()
    mocks.queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }])

    const res = await GET(makeReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    // Forenzika: polje je prisotno TUDI ko je commit neznan (ni ugibanja)
    expect(Object.keys(body)).toContain('commit')
    expect(body.commit).toBeNull()
    expect(body.version).toBe('dev')
  })

  it('C3: detailed ok → status "ok", 5 preverjanj po vrsti, commit prisoten', async () => {
    stubNoOptionalServices()
    vi.stubEnv('APP_VERSION', '1.11.0')
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234')
    mocks.queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }])

    const res = await GET(makeReq('/api/health?detailed=true'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.version).toBe('1.11.0')
    expect(body.commit).toBe('abc1234')
    expect(body.checks.map((c: { name: string }) => c.name)).toEqual([
      'database',
      'redis',
      'furs',
      'stripe',
      'sentry',
    ])
    // env unset v testu → optional servisi not_configured (allOk ostane true)
    expect(
      body.checks.filter((c: { status: string }) => c.status === 'not_configured').length,
    ).toBe(4)
  })

  it('C4: degraded (FURS produkcija brez certifikata) → 200 "degraded" + commit prisoten', async () => {
    stubNoOptionalServices()
    vi.stubEnv('APP_VERSION', '1.11.0')
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234')
    vi.stubEnv('FURS_ENVIRONMENT', 'production')
    mocks.queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }])

    const res = await GET(makeReq('/api/health?detailed=true'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('degraded')
    expect(body.commit).toBe('abc1234')
    const furs = body.checks.find((c: { name: string }) => c.name === 'furs')
    expect(furs.status).toBe('warning')
  })

  it('C5: DB down → 503 "error" + version + commit (GIT_COMMIT fallback), EN db klic', async () => {
    stubNoOptionalServices()
    vi.stubEnv('APP_VERSION', '1.11.0')
    vi.stubEnv('GIT_COMMIT', 'def5678')
    mocks.queryRawUnsafe.mockRejectedValue(new Error('boom'))

    const res = await GET(makeReq())
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.status).toBe('error')
    expect(body.version).toBe('1.11.0')
    expect(body.commit).toBe('def5678')
    expect(body.database.status).toBe('error')
    // 503 takoj — brez detailed preverjanj (samo EN db klic, ni oracleja)
    expect(mocks.queryRawUnsafe).toHaveBeenCalledTimes(1)
  })

  it('C6: zunanji catch (nepričakovana napaka) → 503 "disconnected" + commit + logger.error', async () => {
    stubNoOptionalServices()
    vi.stubEnv('COMMIT_SHA', 'feed0001')
    mocks.queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }])
    mocks.checkFursBootReadiness.mockImplementation(() => {
      throw new Error('boot-guard-exploded')
    })

    const res = await GET(makeReq('/api/health?detailed=true'))
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.status).toBe('error')
    expect(body.database).toBe('disconnected')
    expect(body.version).toBe('dev')
    expect(body.commit).toBe('feed0001')
    expect(body.error).toBe('boot-guard-exploded')
    expect(mocks.loggerError).toHaveBeenCalledTimes(1)
    // db je bil uspešen, pot prekinjena v furs preverjanju — 1 klic skupaj
    expect(mocks.queryRawUnsafe).toHaveBeenCalledTimes(1)
  })
})

describe('R96-a: fs-guard — health/app-info vir kanona', () => {
  it('D1: health route NE vsebuje legacy "1.0.13" fallbacka, kliče helperje (4× version + 4× commit)', () => {
    const src = readSrc('src/app/api/health/route.ts')
    expect(src).not.toContain("APP_VERSION || '1.0.13'")
    expect(src).not.toContain('process.env.APP_VERSION')
    expect(src).toContain("from '@/lib/app-info'")
    expect(src.match(/getAppVersion\(\)/g)?.length).toBe(4)
    expect(src.match(/commit: getAppCommit\(\)/g)?.length).toBe(4)
  })

  it('D2: app-info helper pin — ?? prioriteta veriga (3 operatorji) v viru', () => {
    const src = readSrc('src/lib/app-info.ts')
    expect(src).toContain('VERCEL_GIT_COMMIT_SHA')
    expect(src).toContain('GIT_COMMIT')
    expect(src).toContain('COMMIT_SHA')
    expect(src.match(/\?\?/g)?.length).toBe(3)
    expect(src).toContain("process.env.APP_VERSION || 'dev'")
  })
})
