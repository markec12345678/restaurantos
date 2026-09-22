// ============================================
// WS AUDIT 2026-09-09 — WEBSOCKET VARNOSTNI REGRESIJSKI TESTI
//
// Preverjamo varnostni model WebSocket strežnika (server.js + server-ws-core.js):
//   1. Token se NE pošilja v URL-ju (handshake ga zavrne)
//   2. Klient NE more broadcastati dogodkov drugim klientom
//      (NEW_ORDER/ORDER_UPDATED/ORDER_CANCELLED poskusi → zavrnjeni)
//   3. Vsa inbound sporočila so Zod-validirana (oblika, dolžine, tip)
//   4. SUBSCRIBE_OUTBOX (finančni podatki) je rezerviran za manager/admin
//   5. Server-side broadcast poteka DIREKTNO (globalThis.__wsBroadcast),
//      ne prek HTTP /api/ws-broadcast (ruta izbrisana)
//   6. Session.locationId se obnovi iz Employee zapisa (multi-tenant WS filter
//      ne more biti bypassan z izgubo locationId po restartu/cold-start)
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import crypto from 'crypto'
import { createRequire } from 'module'

// server-ws-core.js je CJS modul v root-u (izvleček iz server.js za testabilnost)
const require_ = createRequire(import.meta.url)
const wsCore = require_('../../../server-ws-core') as {
  parseInboundMessage: (raw: string | Buffer) =>
    | { ok: true; message: { type: string; payload?: unknown } }
    | { ok: false; reason: string }
  detectTokenInHandshakeUrl: (url: string) => { tokenInUrl: boolean }
  isOutboxRoleAllowed: (role: string | null | undefined) => boolean
  isValidOutboundEvent: (type: string, payload: unknown) => boolean
  OUTBOX_ALLOWED_ROLES: string[]
  MAX_INBOUND_MESSAGE_BYTES: number
  TOKEN_PATTERN: RegExp
}

type MockFn = ReturnType<typeof vi.fn>

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({
  db: {
    session: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    employee: {
      findUnique: vi.fn().mockResolvedValue({ status: 'active', locationId: null }),
    },
  },
}))

const sha256 = (t: string) => crypto.createHash('sha256').update(t, 'utf8').digest('hex')
const TOKEN = crypto.randomBytes(32).toString('hex')

const getMocks = async () => {
  const { db } = (await import('@/lib/db')) as unknown as {
    db: {
      session: { findUnique: MockFn; deleteMany: MockFn }
      employee: { findUnique: MockFn }
    }
  }
  return db
}

// ============================================
// 1. INBOUND SPOROČILA — ZOD VALIDACIJA
// ============================================
describe('WS AUDIT: inbound sporočila (Zod validacija)', () => {
  it('sprejme veljavno AUTH sporočilo ({ type: "AUTH", payload: { token } })', () => {
    const res = wsCore.parseInboundMessage(JSON.stringify({ type: 'AUTH', payload: { token: TOKEN } }))
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.message.type).toBe('AUTH')
      expect((res.message.payload as { token: string }).token).toBe(TOKEN)
    }
  })

  it('ZAVRNE stari AUTH format { type: "AUTH", token } (kds-session bug)', () => {
    // Prej je use-kds-session poslal token na top-level — server je vedno
    // odgovoril 4002 "Manjka žeton". Pravilen format je payload.token.
    const res = wsCore.parseInboundMessage(JSON.stringify({ type: 'AUTH', token: TOKEN }))
    expect(res.ok).toBe(false)
  })

  it('ZAVRNE AUTH z neveljavnim formatom tokena (ne 64 hex)', () => {
    const res = wsCore.parseInboundMessage(JSON.stringify({ type: 'AUTH', payload: { token: 'xyz' } }))
    expect(res.ok).toBe(false)
  })

  it('ZAVRNE neveljaven JSON', () => {
    const res = wsCore.parseInboundMessage('ni json {{{')
    expect(res.ok).toBe(false)
  })

  it('ZAVRNE sporočilo, ki presega 16KB (flooding vektor)', () => {
    const big = JSON.stringify({ type: 'AUTH', payload: { token: TOKEN }, extra: 'x'.repeat(20 * 1024) })
    const res = wsCore.parseInboundMessage(big)
    expect(res.ok).toBe(false)
  })

  it('ZAVRNE sporočila z nepoznanimi polji (strict shema — prepreči injection)', () => {
    const res = wsCore.parseInboundMessage(JSON.stringify({ type: 'ping', payload: {}, evil: true }))
    expect(res.ok).toBe(false)
  })

  it('sprejme ping (aplikacijski heartbeat → server odgovori pong)', () => {
    expect(wsCore.parseInboundMessage(JSON.stringify({ type: 'ping' })).ok).toBe(true)
    expect(wsCore.parseInboundMessage(JSON.stringify({ type: 'ping', payload: {} })).ok).toBe(true)
  })

  it('sprejme IDENTIFY z omejenimi dolžinami', () => {
    const res = wsCore.parseInboundMessage(JSON.stringify({
      type: 'IDENTIFY', payload: { clientType: 'kds', clientName: 'kuhinja-1' },
    }))
    expect(res.ok).toBe(true)
  })

  it('ZAVRNE IDENTIFY z predskočno dolžino (DoS prek ogromnih nizov)', () => {
    const res = wsCore.parseInboundMessage(JSON.stringify({
      type: 'IDENTIFY', payload: { clientType: 'x'.repeat(500) },
    }))
    expect(res.ok).toBe(false)
  })
})

// ============================================
// 2. KJENT NE MORE BROADCASTATI (jedro audita)
// ============================================
describe('WS AUDIT: klient ne more broadcastati dogodkov', () => {
  // Točno vzorec iz uporabniškega audita: client → ORDER_CANCELLED → broadcast
  const CLIENT_BROADCAST_ATTEMPTS = [
    'NEW_ORDER', 'ORDER_UPDATED', 'ITEM_STATUS_CHANGED', 'ORDER_CANCELLED',
    'ORDER_FIRED', 'ITEM_STATUS_UPDATE', 'STOCK_LOW', 'CALL_WAITER', 'LOW_STOCK',
    'order_ready', 'OUTBOX_UPDATE', 'AUTH_SUCCESS', 'CONNECTED',
  ]

  it.each(CLIENT_BROADCAST_ATTEMPTS)('ZAVRNE poskus klienta broadcastati %s', (eventType) => {
    const res = wsCore.parseInboundMessage(JSON.stringify({
      type: eventType,
      payload: { orderId: 'order-1', locationId: 'loc-B', total: 999 },
    }))
    expect(res.ok).toBe(false)
  })

  it('ZAVRNE poskus z lažnim locationId (cross-tenant ciljanje)', () => {
    // Klient lokacije A poskuša broadcastati dogodek z locationId lokacije B —
    // Zod union dovoli samo kontrolne tipe, dogodki niso klientu dostopni.
    const res = wsCore.parseInboundMessage(JSON.stringify({
      type: 'ORDER_CANCELLED', payload: { orderId: 'x', locationId: 'loc-žrtev' },
    }))
    expect(res.ok).toBe(false)
  })
})

// ============================================
// 3. TOKEN V URL-JU — PREPOVEDAN
// ============================================
describe('WS AUDIT: token v URL-ju je prepovedan', () => {
  it('detektira ?token= v handshake URL-ju', () => {
    expect(wsCore.detectTokenInHandshakeUrl('/ws?token=abcdef123').tokenInUrl).toBe(true)
    expect(wsCore.detectTokenInHandshakeUrl('/ws?token=').tokenInUrl).toBe(true)
  })

  it('čist /ws handshake brez tokena je dovoljen', () => {
    expect(wsCore.detectTokenInHandshakeUrl('/ws').tokenInUrl).toBe(false)
  })

  it('URL z drugimi query parametri (brez tokena) je dovoljen', () => {
    expect(wsCore.detectTokenInHandshakeUrl('/ws?client=kds').tokenInUrl).toBe(false)
  })

  it('handlestita zaščiten tudi proti ne-URL vhodu', () => {
    expect(wsCore.detectTokenInHandshakeUrl('').tokenInUrl).toBe(false)
    expect(wsCore.detectTokenInHandshakeUrl(null as unknown as string).tokenInUrl).toBe(false)
  })
})

// ============================================
// 4. OUTBOX SUBSCRIPTION — ROLE GATE
// ============================================
describe('WS AUDIT: SUBSCRIBE_OUTBOX role gate (finančni podatki)', () => {
  it('dovoli admin, super_admin, manager', () => {
    expect(wsCore.isOutboxRoleAllowed('admin')).toBe(true)
    expect(wsCore.isOutboxRoleAllowed('super_admin')).toBe(true)
    expect(wsCore.isOutboxRoleAllowed('manager')).toBe(true)
  })

  it('ZAVRNE waiter, staff, natakarja in vse ostale vloge', () => {
    expect(wsCore.isOutboxRoleAllowed('waiter')).toBe(false)
    expect(wsCore.isOutboxRoleAllowed('staff')).toBe(false)
    expect(wsCore.isOutboxRoleAllowed('cook')).toBe(false)
  })

  it('ZAVRNE manjkajočo/neveljavno vlogo (fail-closed)', () => {
    expect(wsCore.isOutboxRoleAllowed(undefined)).toBe(false)
    expect(wsCore.isOutboxRoleAllowed(null)).toBe(false)
    expect(wsCore.isOutboxRoleAllowed('')).toBe(false)
  })
})

// ============================================
// 5. OUTBOUND EVENT ENVELOPE
// ============================================
describe('WS AUDIT: outbound event envelope validacija', () => {
  it('sprejme veljaven tip + objektni payload', () => {
    expect(wsCore.isValidOutboundEvent('NEW_ORDER', { orderId: '1', locationId: 'loc-1' })).toBe(true)
    expect(wsCore.isValidOutboundEvent('STOCK_LOW', { alerts: [] })).toBe(true)
  })

  it('sprejme payload brez podatkov (backward compat)', () => {
    expect(wsCore.isValidOutboundEvent('ORDER_FIRED', undefined)).toBe(true)
    expect(wsCore.isValidOutboundEvent('ORDER_FIRED', null)).toBe(true)
  })

  it('ZAVRNE prazen tip (neveljaven envelope se ne dostavi)', () => {
    expect(wsCore.isValidOutboundEvent('', {})).toBe(false)
    expect(wsCore.isValidOutboundEvent(null as unknown as string, {})).toBe(false)
  })

  it('ZAVRNE predolg tip dogodka', () => {
    expect(wsCore.isValidOutboundEvent('X'.repeat(100), {})).toBe(false)
  })
})

// ============================================
// 6. SERVER-SIDE BROADCAST — DIREKTEN KLIC
// ============================================
describe('WS AUDIT: server-side broadcast poteka direktno (ne prek HTTP)', () => {
  beforeEach(() => {
    delete (globalThis as Record<string, unknown>).__wsBroadcast
  })

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__wsBroadcast
  })

  it('wsBroadcastEvent pokliče globalThis.__wsBroadcast z (type, payload)', async () => {
    const broadcastFn = vi.fn()
    ;(globalThis as Record<string, unknown>).__wsBroadcast = broadcastFn

    const { wsBroadcastEvent } = await import('@/lib/ws-server-broadcast')
    wsBroadcastEvent('NEW_ORDER', { orderId: 'o1', locationId: 'loc-1' })

    expect(broadcastFn).toHaveBeenCalledWith('NEW_ORDER', { orderId: 'o1', locationId: 'loc-1' })
  })

  it('wsBroadcastEvent NE vrže napake, ko WS strežnik ni aktiven (Vercel/dev)', async () => {
    const { wsBroadcastEvent } = await import('@/lib/ws-server-broadcast')
    expect(() => wsBroadcastEvent('NEW_ORDER', { orderId: 'o1' })).not.toThrow()
  })

  it('wsBroadcastEvent preživi napako broadcast funkcije (poslovni tok ne pade)', async () => {
    const broadcastFn = vi.fn(() => { throw new Error('WS internal error') })
    ;(globalThis as Record<string, unknown>).__wsBroadcast = broadcastFn

    const { wsBroadcastEvent } = await import('@/lib/ws-server-broadcast')
    expect(() => wsBroadcastEvent('NEW_ORDER', { orderId: 'o1' })).not.toThrow()
  })

  it('broadcastWSEvent (websocket-client) uporablja isti direktni kanal', async () => {
    const broadcastFn = vi.fn()
    ;(globalThis as Record<string, unknown>).__wsBroadcast = broadcastFn

    const { broadcastWSEvent } = await import('@/lib/websocket-client/broadcast')
    await broadcastWSEvent('ORDER_FIRED', { orderId: 'o2', locationId: 'loc-2' })

    expect(broadcastFn).toHaveBeenCalledWith('ORDER_FIRED', { orderId: 'o2', locationId: 'loc-2' })
  })

  it('broadcastWS (orders _helpers) uporablja isti direktni kanal', async () => {
    const broadcastFn = vi.fn()
    ;(globalThis as Record<string, unknown>).__wsBroadcast = broadcastFn

    const mod = await import('@/app/api/orders/_helpers/broadcast')
    mod.broadcastWS('ORDER_CANCELLED', { orderId: 'o3', locationId: 'loc-3' })

    expect(broadcastFn).toHaveBeenCalledWith('ORDER_CANCELLED', { orderId: 'o3', locationId: 'loc-3' })
  })

  it('broadcastLowStockAlert (stock-deduction) vključi locationId v payload', async () => {
    const broadcastFn = vi.fn()
    ;(globalThis as Record<string, unknown>).__wsBroadcast = broadcastFn

    const { broadcastLowStockAlert } = await import('@/lib/stock-deduction/broadcast')
    broadcastLowStockAlert([
      { inventoryItemId: 'inv-1', name: 'Coca-Cola', currentQty: 2, minQty: 5, locationId: 'loc-1' },
    ])

    expect(broadcastFn).toHaveBeenCalledTimes(1)
    const [type, payload] = broadcastFn.mock.calls[0] as [string, Record<string, unknown>]
    expect(type).toBe('STOCK_LOW')
    expect(payload.locationId).toBe('loc-1')
    expect((payload.alerts as Array<{ locationId: string }>)[0].locationId).toBe('loc-1')
  })
})

// ============================================
// 7. SESSION LOCATIONID OBNOVITEV (multi-tenant WS filter)
// ============================================
describe('WS AUDIT: session.locationId se obnovi iz Employee zapisa', () => {
  beforeEach(async () => {
    vi.resetModules()
    delete (globalThis as Record<string, unknown>).__wsSessionStore
    const db = await getMocks()
    db.session.findUnique.mockResolvedValue(null)
    db.employee.findUnique.mockResolvedValue({ status: 'active', locationId: null })
  })

  it('DB-rekonstruirana seja dobi locationId iz Employee (WS filter ne more biti bypassan)', async () => {
    const db = await getMocks()
    db.session.findUnique.mockResolvedValue({
      token: sha256(TOKEN),
      employeeId: 'emp-1',
      role: 'waiter',
      permissions: JSON.stringify(['take_orders']),
      createdAt: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() + 60_000),
      absoluteExpiry: new Date(Date.now() + 3600_000),
    })
    db.employee.findUnique.mockResolvedValue({ status: 'active', locationId: 'loc-A' })

    const { verifyToken } = await import('@/lib/auth-middleware/session-store')
    const session = await verifyToken(TOKEN)

    expect(session).not.toBeNull()
    // KLJUČNO: locationId mora biti 'loc-A' (iz Employee), ne undefined/null
    expect(session?.locationId).toBe('loc-A')
  })

  it('super admin (Employee.locationId=null) dobi locationId=null — NE globalnega bypassa', async () => {
    const db = await getMocks()
    db.session.findUnique.mockResolvedValue({
      token: sha256(TOKEN),
      employeeId: 'emp-2',
      role: 'super_admin',
      permissions: JSON.stringify(['*']),
      createdAt: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() + 60_000),
      absoluteExpiry: new Date(Date.now() + 3600_000),
    })
    db.employee.findUnique.mockResolvedValue({ status: 'active', locationId: null })

    const { verifyToken } = await import('@/lib/auth-middleware/session-store')
    const session = await verifyToken(TOKEN)

    expect(session?.locationId).toBeNull()
  })

  it('in-memory seja BREZ locationId (naložena iz DB po restartu) se obogati', async () => {
    const db = await getMocks()
    db.employee.findUnique.mockResolvedValue({ status: 'active', locationId: 'loc-B' })

    const { verifyToken } = await import('@/lib/auth-middleware/session-store')
    const { sessions } = await import('@/lib/auth-middleware/session-store/session-cache')

    // Simuliraj sejo iz loadSessionsFromDb (BREZ locationId — kot po restartu)
    sessions.set(sha256(TOKEN), {
      token: sha256(TOKEN),
      employeeId: 'emp-3',
      role: 'waiter',
      permissions: ['take_orders'],
      createdAt: Date.now() - 1000,
      expiresAt: Date.now() + 60_000,
      absoluteExpiry: Date.now() + 3600_000,
      // POVSEMNO brez locationId polja
    })

    const session = await verifyToken(TOKEN)
    expect(session?.locationId).toBe('loc-B')

    // Obogatitev je persistirana v memory mapi (session objekt je mutiran)
    expect(sessions.get(sha256(TOKEN))?.locationId).toBe('loc-B')
    sessions.clear()
  })

  it('veljaven locationId v memory seji SE NE prepiše (null = super admin ostane null)', async () => {
    const db = await getMocks()
    db.employee.findUnique.mockResolvedValue({ status: 'active', locationId: 'loc-C' })

    const { verifyToken } = await import('@/lib/auth-middleware/session-store')
    const { sessions } = await import('@/lib/auth-middleware/session-store/session-cache')

    sessions.set(sha256(TOKEN), {
      token: sha256(TOKEN),
      employeeId: 'emp-4',
      role: 'admin',
      permissions: ['*'],
      createdAt: Date.now() - 1000,
      expiresAt: Date.now() + 60_000,
      absoluteExpiry: Date.now() + 3600_000,
      locationId: null, // super admin — VELJAVNA vrednost
    })

    const session = await verifyToken(TOKEN)
    // null (super admin) NE SME biti prepisan z lokacijo zaposlenega
    expect(session?.locationId).toBeNull()
    sessions.clear()
  })

  it('syncSessionToWs zapiše sejo (z locationId) pod PLAINTEXT ključ v WS store', async () => {
    const wsStore = new Map()
    ;(globalThis as Record<string, unknown>).__wsSessionStore = wsStore

    const { syncSessionToWs } = await import('@/lib/auth-middleware/session-store/session-cache')
    syncSessionToWs(TOKEN, {
      token: sha256(TOKEN),
      employeeId: 'emp-5',
      role: 'waiter',
      permissions: ['take_orders'],
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      absoluteExpiry: Date.now() + 3600_000,
      locationId: 'loc-D',
    })

    // WS store ključen s PLAINTEXT tokenom (server.js verifyWsToken)
    const stored = wsStore.get(TOKEN) as { locationId?: string; employeeId: string } | undefined
    expect(stored).toBeDefined()
    expect(stored?.locationId).toBe('loc-D')

    // Odjava (session=null) izbriše entry
    syncSessionToWs(TOKEN, null)
    expect(wsStore.has(TOKEN)).toBe(false)
  })
})

// ============================================
// 8. KONSTANTE VARNEGA MODELA
// ============================================
describe('WS AUDIT: konstante varnega modela', () => {
  it('outbox dovoljene vloge so točno določene', () => {
    expect(wsCore.OUTBOX_ALLOWED_ROLES).toEqual(['admin', 'super_admin', 'manager'])
  })

  it('inbound sporočila so omejena na 16KB', () => {
    expect(wsCore.MAX_INBOUND_MESSAGE_BYTES).toBe(16 * 1024)
  })

  it('token vzorec zahteva 64 malih hex znakov', () => {
    expect(wsCore.TOKEN_PATTERN.test('a'.repeat(64))).toBe(true)
    expect(wsCore.TOKEN_PATTERN.test('A'.repeat(64))).toBe(false) // samo male črke
    expect(wsCore.TOKEN_PATTERN.test('g'.repeat(64))).toBe(false) // samo hex
    expect(wsCore.TOKEN_PATTERN.test('abc')).toBe(false)
  })
})
