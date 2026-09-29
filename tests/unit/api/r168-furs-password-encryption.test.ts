// ============================================
// R168 F8 — FURS GESLA ŠIFRIRANJE AT-REST (issue #143 P2, R166-F8)
// ============================================
// Prej: locations POST/PUT je pisal fursCertPassword PLAINTEXT v DB
// (ensureEncrypted 0 klicalcev); cert-status + build-config sta brala RAW
// (brez ensureDecrypted). .env.example:194 je trdil šifriranje — nasprotje.
//
// Fix R168:
//   1. write-path: POST + PUT locations skozi ensureEncrypted (AES-256-GCM)
//   2. read-path: cert-status + build-config skozi ensureDecrypted
//   3. backfill: scripts/migrate-encrypt-secrets.ts (obstajal je NE-dokumentiran;
//      R168 ga wire-a v package.json db:encrypt-secrets) — idempotenten
//
// Konvencija r125/r166: trap DB + mockana mejna vrata (auth, rate-limit);
// crypto/secrets teče REALNO (tests/setup.ts:9 nastavi ENCRYPTION_KEY pred
// importi, P0-C5) → round-trip dokaz: captured value je enc:v1:... IN se
// decrypta nazaj v original plaintext.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const captured = vi.hoisted(() => ({
  create: [] as Array<{ data: Record<string, unknown> }>,
  update: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
  findUnique: [] as Array<Record<string, unknown>>,
}))

// Overridable findUnique (T7/T8: encrypted / legacy plaintext vrstica)
const ref = vi.hoisted(() => ({ findUniqueOverride: null as null | ((args: { where: Record<string, unknown> }) => Promise<unknown>) }))

const LOCATION_ROW = {
  id: 'loc-1',
  name: 'Glavna lokacija',
  code: 'LOC1',
  type: 'restaurant',
  isActive: true,
  subscriptionId: null,
  fursCertPath: '/certs/test.p12',
  fursCertPassword: '',
  fursEnvironment: 'test',
  businessId: 'B12345678',
  taxId: 'SI12345678',
  registerNumber: 'BLG-001',
  premisesId: 'P001',
}

const m = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  checkRateLimitAsync: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    location: {
      findUnique: async (args: { where: Record<string, unknown> }) => {
        if (ref.findUniqueOverride) return ref.findUniqueOverride(args)
        captured.findUnique.push(args.where)
        const w = args.where as { id?: string; code?: string }
        if (w.id) return w.id === 'loc-1' ? { ...LOCATION_ROW } : null
        if (w.code) return w.code === LOCATION_ROW.code ? { ...LOCATION_ROW } : null
        return null
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        captured.create.push({ data })
        return { ...LOCATION_ROW, ...data, id: 'loc-new' }
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        captured.update.push(args)
        return { ...LOCATION_ROW, ...args.data }
      },
    },
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: (...args: unknown[]) => m.requireAuth(...args),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: (...args: unknown[]) => m.checkRateLimitAsync(...args),
  checkRateLimit: () => ({ allowed: true, remaining: 10 }),
  getClientIp: () => '127.0.0.1',
  AUTHENTICATED_LIMIT: {},
}))

// api-utils REALNO, samo handleApiError poenostavljen (r125 vzorec)
vi.mock('@/lib/api-utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>()
  return {
    ...actual,
    handleApiError: (e: unknown) => ({
      json: async () => ({ error: String(e) }),
      status: 500,
    }),
  }
})

import { POST as locationsPOST } from '@/app/api/locations/route'
import { PUT as locationPUT } from '@/app/api/locations/[id]/route'
import { buildFursConfigFromSettings } from '@/app/api/furs/helpers/build-config'
import { ensureDecrypted, encrypt } from '@/lib/crypto/secrets'

const SESSION = { employeeId: 'emp-1', role: 'admin', locationId: null, permissions: ['admin'] }

function jsonReq(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  ref.findUniqueOverride = null
  captured.create.length = 0
  captured.update.length = 0
  captured.findUnique.length = 0
  m.requireAuth.mockResolvedValue({ session: { ...SESSION } })
  m.checkRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterMs: 60 })
})

describe('R168 F8: write-path — locations POST/PUT encrypta fursCertPassword', () => {
  it('T1: POST z geslom → DB dobi enc:v1 vrednost, ki se decrypta nazaj; odgovor maskiran', async () => {
    const res = await locationsPOST(jsonReq('http://localhost/api/locations', {
      name: 'Nova lokacija', code: 'NEW1', fursCertPassword: 'mojGeslo123',
    }))
    expect(res.status).toBe(201)
    expect(captured.create).toHaveLength(1)
    const stored = String(captured.create[0].data.fursCertPassword)
    expect(stored.startsWith('enc:v1:')).toBe(true)
    expect(ensureDecrypted(stored)).toBe('mojGeslo123')
    const body = await res.json()
    expect(body.fursCertPassword).toBe('****') // maska ostaja — API kontrakt nespremenjen
  })

  it('T2: POST s praznim geslom → DB dobi "" (ensureEncrypted praznega = "")', async () => {
    const res = await locationsPOST(jsonReq('http://localhost/api/locations', {
      name: 'Nova lokacija', code: 'NEW2',
    }))
    expect(res.status).toBe(201)
    expect(captured.create[0].data.fursCertPassword).toBe('')
  })

  it('T3: PUT z novim geslom → update dobi enc:v1 vrednost, decryptabilno; odgovor maskiran', async () => {
    const res = await locationPUT(jsonReq('http://localhost/api/locations/loc-1', {
      fursCertPassword: 'novoGeslo99',
    }), { params: Promise.resolve({ id: 'loc-1' }) } as unknown as Parameters<typeof locationPUT>[1])
    expect(res.status).toBe(200)
    expect(captured.update).toHaveLength(1)
    const stored = String(captured.update[0].data.fursCertPassword)
    expect(stored.startsWith('enc:v1:')).toBe(true)
    expect(ensureDecrypted(stored)).toBe('novoGeslo99')
    const body = await res.json()
    expect(body.fursCertPassword).toBe('****')
  })

  it('T4: PUT mask-keep — "****" NE prepisuje skrivnosti (nič ničesar ne encrypta)', async () => {
    const res = await locationPUT(jsonReq('http://localhost/api/locations/loc-1', {
      fursCertPassword: '****',
    }), { params: Promise.resolve({ id: 'loc-1' }) } as unknown as Parameters<typeof locationPUT>[1])
    expect(res.status).toBe(200)
    expect(captured.update[0].data.fursCertPassword).toBeUndefined()
  })

  it('T5: PUT "" brez _clear → ohrani staro (nič v update); "" z _clear → "" (prazno, NE enc:v1)', async () => {
    await locationPUT(jsonReq('http://localhost/api/locations/loc-1', { fursCertPassword: '' }),
      { params: Promise.resolve({ id: 'loc-1' }) } as unknown as Parameters<typeof locationPUT>[1])
    expect(captured.update[0].data.fursCertPassword).toBeUndefined()

    await locationPUT(jsonReq('http://localhost/api/locations/loc-1', { fursCertPassword: '', _clearCertPassword: true }),
      { params: Promise.resolve({ id: 'loc-1' }) } as unknown as Parameters<typeof locationPUT>[1])
    expect(captured.update[1].data.fursCertPassword).toBe('')
  })

  it('T6: PUT z že-encryptano vrednostjo → idempotent (BREZ dvojnega šifriranja)', async () => {
    const preEncrypted = encrypt('zeStaroGeslo')
    await locationPUT(jsonReq('http://localhost/api/locations/loc-1', { fursCertPassword: preEncrypted }),
      { params: Promise.resolve({ id: 'loc-1' }) } as unknown as Parameters<typeof locationPUT>[1])
    expect(captured.update[0].data.fursCertPassword).toBe(preEncrypted) // isti string, ni nested enc
    expect(ensureDecrypted(String(captured.update[0].data.fursCertPassword))).toBe('zeStaroGeslo')
  })
})

describe('R168 F8: read-path — build-config decrypta encrypted vrstico', () => {
  it('T7: encrypted fursCertPassword v Location → FursConfig.certPassword = plaintext', async () => {
    const enc = encrypt('gesloIzDB')
    ref.findUniqueOverride = async () => ({ ...LOCATION_ROW, fursCertPassword: enc })
    const config = await buildFursConfigFromSettings(
      { businessId: 'B12345678', taxId: 'SI12345678', registerNumber: 'BLG-001' },
      'loc-1',
    )
    expect(config.certPassword).toBe('gesloIzDB')
  })

  it('T8: legacy plaintext vrstica → passthrough (idempotentna bralna migracija)', async () => {
    ref.findUniqueOverride = async () => ({ ...LOCATION_ROW, fursCertPassword: 'staroPlaintext' })
    const config = await buildFursConfigFromSettings(
      { businessId: 'B12345678', taxId: 'SI12345678', registerNumber: 'BLG-001' },
      'loc-1',
    )
    expect(config.certPassword).toBe('staroPlaintext')
  })
})

describe('R168 F8: cert-status + backfill skripta (source pini)', () => {
  it('T9: cert-status bere geslo skozi ensureDecrypted (bralni kanon)', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'furs', 'cert-status', 'route.ts'), 'utf8')
    expect(src).toContain("import { ensureDecrypted } from '@/lib/crypto/secrets'")
    expect(src).toContain('certPassword = ensureDecrypted(location.fursCertPassword)')
  })

  it('T10: backfill skripta obstaja, pokriva Location.fursCertPassword in je idempotentna (isEncrypted skip)', () => {
    const src = readFileSync(join(process.cwd(), 'scripts', 'migrate-encrypt-secrets.ts'), 'utf8')
    expect(src).toContain('Location.fursCertPassword')
    expect(src).toContain('migrateTable(\'Location\', \'id\', \'fursCertPassword\'')
    expect(src).toContain('if (isEncrypted(currentValue))') // idempotencija — re-runnable
    expect(src).toContain('ensureEncrypted(currentValue)')
  })

  it('T11: package.json wire-a db:encrypt-secrets (dokumentiran vstop)', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
    expect(pkg.scripts['db:encrypt-secrets']).toBe('bun run scripts/migrate-encrypt-secrets.ts')
  })
})
