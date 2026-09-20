// ============================================
// R85-FINAL — FIX WAVE 2 (final-auditor najdbe)
// ============================================
// REGRESIJA za 4 HIGH + 2 MEDIUM (R85-FINAL-2 read-only auditor, file:line):
//   H1 expenses GET  — auditLog.findMany brez locationId (stroški vseh tenantov)
//   H2 expenses POST — body locationId brez kontrole (details-only žig)
//   H3 guests GET    — db.guest.findMany({}) = celoten gost CRM vseh tenantov
//   H4 mobile/loyalty — verifyApiKey subscriptionId nikoli uporabljen
//                      (kateri koli ključ prebere loyalty račun kateri koli
//                      naročnine po telefonu/emailu)
//   M3 mobile/menu   — poljuben ?locationId + globalni prva-aktivna fallback
//   M1 checks PUT    — validateDiscount globalen findUnique (tuj popust na
//                      lasten ček + cross-tenant currentUses increment)
//
// Vzorec: realen tenant-scope resolver + pinanje where-clavzov. null scope
// (super-admin) = PRAZEN filter, NIKOLI { locationId: null }.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  verifyApiKey: vi.fn(),
  auditLogFindMany: vi.fn(),
  guestFindMany: vi.fn(),
  guestCount: vi.fn(),
  guestCreate: vi.fn(),
  emitEvent: vi.fn(),
  loyaltyAccountFindFirst: vi.fn(),
  loyaltyTransactionFindMany: vi.fn(),
  locationFindFirst: vi.fn(),
  menuItemFindMany: vi.fn(),
  categoryFindMany: vi.fn(),
  checkFindFirst: vi.fn(),
  checkUpdate: vi.fn(),
  discountFindUnique: vi.fn(),
  discountUpdate: vi.fn(),
  discountUpdateMany: vi.fn(),
}))

// Auth middleware: mock requireAuth, REALNI tenant-scope resolver
vi.mock('@/lib/auth-middleware', async () => {
  const tenantScope = await import('@/lib/auth-middleware/tenant-scope')
  return {
    requireAuth: mocks.requireAuth,
    resolveTenantLocationId: tenantScope.resolveTenantLocationId,
    resolveTenantLocationIdOrThrow: tenantScope.resolveTenantLocationIdOrThrow,
    tenantScopeToWhere: tenantScope.tenantScopeToWhere,
  }
})

vi.mock('@/lib/api-security', () => ({
  verifyApiKey: mocks.verifyApiKey,
}))

vi.mock('@/lib/event-emitter', () => ({
  emitEvent: mocks.emitEvent,
}))

vi.mock('@/lib/db', () => ({
  db: {
    auditLog: { findMany: mocks.auditLogFindMany },
    guest: { findMany: mocks.guestFindMany, count: mocks.guestCount, create: mocks.guestCreate },
    loyaltyAccount: { findFirst: mocks.loyaltyAccountFindFirst },
    loyaltyTransaction: { findMany: mocks.loyaltyTransactionFindMany },
    location: { findFirst: mocks.locationFindFirst },
    menuItem: { findMany: mocks.menuItemFindMany },
    category: { findMany: mocks.categoryFindMany },
    check: { findFirst: mocks.checkFindFirst, update: mocks.checkUpdate },
    discount: { findUnique: mocks.discountFindUnique, update: mocks.discountUpdate, updateMany: mocks.discountUpdateMany },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      check: { update: mocks.checkUpdate },
      discount: { findUnique: mocks.discountFindUnique, update: mocks.discountUpdate, updateMany: mocks.discountUpdateMany },
    })),
  },
  // createAuditLog je TOP-LEVEL export iz '@/lib/db' (ne lastnost db klienta)
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

import { GET as expensesGET, POST as expensesPOST } from '@/app/api/expenses/route'
import { GET as guestsGET } from '@/app/api/guests/route'
import { GET as mobileLoyaltyGET } from '@/app/api/mobile/loyalty/route'
import { GET as mobileMenuGET } from '@/app/api/mobile/menu/route'
import { PUT as checkPUT } from '@/app/api/checks/[id]/route'
import { validateDiscount } from '@/app/api/checks/[id]/_helpers'

// Utišaj logger
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'
const SUB_A = 'sub-tenant-a'

function mockSession(overrides: Record<string, unknown> = {}) {
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A, ...overrides },
    error: null,
  })
}

function mockApiKey(overrides: Record<string, unknown> = {}) {
  mocks.verifyApiKey.mockResolvedValue({
    valid: true,
    apiKey: { id: 'key-1', scopes: ['admin'], isActive: true, ...overrides },
    subscriptionId: 'sub-tenant-a',
    ...overrides,
  })
}

const txMock = { discount: { findUnique: mocks.discountFindUnique } }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auditLogFindMany.mockResolvedValue([])
  mocks.guestFindMany.mockResolvedValue([])
  mocks.guestCount.mockResolvedValue(0)
  mocks.guestCreate.mockResolvedValue({ id: 'g-1', firstName: 'A', lastName: 'B', email: '', phone: '' })
  mocks.emitEvent.mockResolvedValue(undefined)
  mocks.loyaltyAccountFindFirst.mockResolvedValue(null)
  mocks.loyaltyTransactionFindMany.mockResolvedValue([])
  mocks.locationFindFirst.mockResolvedValue({ id: LOC_A })
  mocks.menuItemFindMany.mockResolvedValue([])
  mocks.categoryFindMany.mockResolvedValue([])
  mocks.checkFindFirst.mockResolvedValue(null)
  mocks.checkUpdate.mockResolvedValue({ id: 'chk-1' })
  mocks.discountFindUnique.mockResolvedValue(null)
  mocks.discountUpdate.mockResolvedValue({ id: 'disc-1', currentUses: 1 })
  mocks.discountUpdateMany.mockResolvedValue({ count: 0 })
})

// ══════════════════════════════════════════════════════════════════
// A. EXPENSES (H1 + H2)
// ══════════════════════════════════════════════════════════════════
describe('R85-FINAL A: /api/expenses — tenant scope', () => {
  it('GET: loc-bound admin → auditLog.findMany where.locationId', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await expensesGET(new Request('http://localhost:3000/api/expenses'))
    expect(res.status).toBe(200)
    expect(mocks.auditLogFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('GET: super-admin → brez locationId ključa (nikoli { locationId: null })', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await expensesGET(new Request('http://localhost:3000/api/expenses'))
    expect(Object.prototype.hasOwnProperty.call(mocks.auditLogFindMany.mock.calls[0][0].where, 'locationId')).toBe(false)
  })

  it('GET: regular user brez lokacije → 403, NI poizvedb', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await expensesGET(new Request('http://localhost:3000/api/expenses'))
    expect(res.status).toBe(403)
    expect(mocks.auditLogFindMany).not.toHaveBeenCalled()
  })

  it('POST: loc-bound admin — body locationId (LOC_B) je IGNORIRAN, žig je LOC_A', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await expensesPOST(new Request('http://localhost:3000/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'food', description: 'Test', amount: 10, locationId: LOC_B }),
    }))
    expect(res.status).toBe(201)
    const { createAuditLog } = await import('@/lib/db')
    const entry = (createAuditLog as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(entry.locationId).toBe(LOC_A)
    expect(entry.details.locationId).toBe(LOC_A)
  })

  it('POST: super-admin brez body locationId → 400 fail-closed, NI zapisa', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await expensesPOST(new Request('http://localhost:3000/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'food', description: 'Test', amount: 10 }),
    }))
    expect(res.status).toBe(400)
    const { createAuditLog } = await import('@/lib/db')
    expect(createAuditLog).not.toHaveBeenCalled()
  })

  it('POST: super-admin z izrecnim body locationId → žigosan', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await expensesPOST(new Request('http://localhost:3000/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'food', description: 'Test', amount: 10, locationId: LOC_B }),
    }))
    expect(res.status).toBe(201)
    const { createAuditLog } = await import('@/lib/db')
    const entry = (createAuditLog as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(entry.locationId).toBe(LOC_B)
  })
})

// ══════════════════════════════════════════════════════════════════
// B. GUESTS (H3)
// ══════════════════════════════════════════════════════════════════
describe('R85-FINAL B: GET /api/guests — tenant scope (izpeljava prek order zveze)', () => {
  it('loc-bound admin → where.orders.some.locationId', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await guestsGET(new Request('http://localhost:3000/api/guests'))
    expect(res.status).toBe(200)
    expect(mocks.guestFindMany.mock.calls[0][0].where.orders.some.locationId).toBe(LOC_A)
    expect(mocks.guestCount.mock.calls[0][0].where.orders.some.locationId).toBe(LOC_A)
  })

  it('super-admin → brez orders ključa', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await guestsGET(new Request('http://localhost:3000/api/guests'))
    expect(Object.prototype.hasOwnProperty.call(mocks.guestFindMany.mock.calls[0][0].where, 'orders')).toBe(false)
  })

  it('?locationId bypass ignoriran za lokacijskega admina', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await guestsGET(new Request(`http://localhost:3000/api/guests?locationId=${LOC_B}`))
    expect(mocks.guestFindMany.mock.calls[0][0].where.orders.some.locationId).toBe(LOC_A)
  })

  it('regular user brez lokacije → 403, NI poizvedb', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await guestsGET(new Request('http://localhost:3000/api/guests'))
    expect(res.status).toBe(403)
    expect(mocks.guestFindMany).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// C. MOBILE LOYALTY (H4) + MOBILE MENU (M3)
// ══════════════════════════════════════════════════════════════════
describe('R85-FINAL C: mobile/loyalty + mobile/menu — subscription binding', () => {
  it('loyalty: ključ brez subscriptionId → 403, NI poizvedb', async () => {
    mockApiKey({ subscriptionId: null })
    mocks.verifyApiKey.mockResolvedValue({ valid: true, apiKey: { id: 'key-1', scopes: ['admin'] }, subscriptionId: null })
    const res = await mobileLoyaltyGET(new Request('http://localhost:3000/api/mobile/loyalty?phone=040123456'))
    expect(res.status).toBe(403)
    expect(mocks.loyaltyAccountFindFirst).not.toHaveBeenCalled()
  })

  it('loyalty: ključ naročnine A → findFirst where.location.subscriptionId', async () => {
    mockApiKey({})
    const res = await mobileLoyaltyGET(new Request('http://localhost:3000/api/mobile/loyalty?phone=040123456'))
    expect(res.status).toBe(404) // račun ni najden (mock null) — AMPAK query je scoped
    expect(mocks.loyaltyAccountFindFirst.mock.calls[0][0].where.location.subscriptionId).toBe(SUB_A)
  })

  it('menu: brez ?locationId → fallback prva aktivna lokacija NAROČNINE', async () => {
    mockApiKey({})
    const res = await mobileMenuGET(new Request('http://localhost:3000/api/mobile/menu'))
    expect(res.status).toBe(200)
    expect(mocks.locationFindFirst.mock.calls[0][0].where.subscriptionId).toBe(SUB_A)
  })

  it('menu: tuj ?locationId → 403, NI menu poizvedbe', async () => {
    mockApiKey({})
    mocks.locationFindFirst.mockResolvedValue(null) // lokacija NI last naročnine
    const res = await mobileMenuGET(new Request(`http://localhost:3000/api/mobile/menu?locationId=${LOC_B}`))
    expect(res.status).toBe(403)
    expect(mocks.menuItemFindMany).not.toHaveBeenCalled()
  })

  it('menu: ključ brez subscriptionId → 403', async () => {
    mocks.verifyApiKey.mockResolvedValue({ valid: true, apiKey: { id: 'key-1', scopes: ['admin'] }, subscriptionId: null })
    const res = await mobileMenuGET(new Request('http://localhost:3000/api/mobile/menu'))
    expect(res.status).toBe(403)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// D. CHECKS PUT — DISCOUNT OWNERSHIP (M1)
// ══════════════════════════════════════════════════════════════════
describe('R85-FINAL D: PUT /api/checks/[id] — discount ownership guard', () => {
  it('helper: tuj popust → "Popust ni najden" (isti odgovor kot neobstoječ)', async () => {
    mocks.discountFindUnique.mockResolvedValue({ id: 'disc-b', locationId: LOC_B, isActive: true })
    const res = await validateDiscount(txMock as never, 'disc-b', LOC_A)
    expect(res.valid).toBe(false)
    expect(res.error).toBe('Popust ni najden')
  })

  it('helper: lasten popust → valid', async () => {
    mocks.discountFindUnique.mockResolvedValue({ id: 'disc-a', locationId: LOC_A, isActive: true })
    const res = await validateDiscount(txMock as never, 'disc-a', LOC_A)
    expect(res.valid).toBe(true)
  })

  it('route: ček na LOC_A + tuj popust (LOC_B) → transakcija abortira, check.update NI klican', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.checkFindFirst.mockResolvedValue({
      id: 'chk-1', subtotal: 100, tax: 22, serviceCharge: 0, tip: 0, appliedDiscountId: null,
      orderItems: [], order: { locationId: LOC_A },
    })
    mocks.discountFindUnique.mockResolvedValue({ id: 'disc-b', locationId: LOC_B, isActive: true, amount: 10, type: 'fixed_amount' })

    const res = await checkPUT(
      new Request('http://localhost:3000/api/checks/chk-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appliedDiscountId: 'disc-b' }),
      }),
      { params: Promise.resolve({ id: 'chk-1' }) },
    )
    // Error v transakciji → route catch; pomembno: NI zapisan update
    expect(mocks.checkUpdate).not.toHaveBeenCalled()
    // validateDiscount je dobil check lokacijo (klic z 3. argumentom)
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('route: lasten popust → transakcija izvede check.update', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.checkFindFirst.mockResolvedValue({
      id: 'chk-1', subtotal: 100, tax: 22, serviceCharge: 0, tip: 0, appliedDiscountId: null,
      orderItems: [], order: { locationId: LOC_A },
    })
    mocks.discountFindUnique.mockResolvedValue({
      id: 'disc-a', locationId: LOC_A, isActive: true, amount: 10, type: 'fixed_amount',
      validFrom: null, validTo: null, maxUses: null, currentUses: 0,
    })

    const res = await checkPUT(
      new Request('http://localhost:3000/api/checks/chk-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appliedDiscountId: 'disc-a' }),
      }),
      { params: Promise.resolve({ id: 'chk-1' }) },
    )
    expect(res.status).toBe(200)
    expect(mocks.checkUpdate).toHaveBeenCalled()
  })
})
