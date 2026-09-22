// ============================================
// KDS READY SHELF — API route test (runda 26-b)
// ============================================
// Testira GET /api/kitchen pogodbo za Toast-style "pick-up shelf":
//  - aktivna naročila (pending/in-progress) kot prej
//  - NOVO: readyOrders — naročila statusa 'ready' ostanejo vidna na KDS,
//    dokler kuhar/jata ne Bump-a (display akcija na odjemalcu)
//  - stats.readyOrdersCount za header badge + filter tab
//  - enrichOrder za obe množici (waitMinutes, urgency, števci artiklov)
// Route handler se pokliče DIREKTNO (brez HTTP strežnika) — deluje v 4 GB
// sandboxu, kjer je dev-server QA nad 4 GB cgroup limito blokiran (runda 26).

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocki PRED importom route-a ---
const findManyMock = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findMany: (args: { where: { status?: unknown } }) => findManyMock(args),
    },
  },
}))

vi.mock('@/lib/auth-middleware', async () => {
  // FIX R85-4a: route zdaj importira tudi resolveTenantLocationIdOrThrow —
  // re-export REALNEGA resolverja (isti vzorec kot r84/r85 security testi).
  const tenantScope = await import('@/lib/auth-middleware/tenant-scope')
  return {
    requireAuth: vi.fn(async () => ({
      session: { employeeId: 'emp-1', locationId: 'loc-1', role: 'admin' },
    })),
    resolveTenantLocationId: tenantScope.resolveTenantLocationId,
    resolveTenantLocationIdOrThrow: tenantScope.resolveTenantLocationIdOrThrow,
    tenantScopeToWhere: tenantScope.tenantScopeToWhere,
  }
})

import { GET } from '@/app/api/kitchen/route'

// --- Fixture pomočniki ---
const DAY = 24 * 60 * 60 * 1000

const makeItem = (id: string, status: string) => ({
  id,
  status,
  quantity: 1,
  price: 9.5,
  notes: '',
  modifiersJson: '[]',
  menuItem: {
    id: `mi-${id}`,
    name: `Artikel ${id}`,
    prepStation: { id: 'ps1', name: 'Kuhinja', type: 'kitchen' },
    category: { id: 'c1', name: 'Hrana', menu: { id: 'm1', name: 'Glavni meni' } },
  },
})

const makeOrder = (id: string, status: string, minutesAgo: number, items: string[]) => ({
  id,
  orderNumber: 42,
  type: 'dine-in',
  status,
  customerName: '',
  notes: '',
  createdAt: new Date(Date.now() - minutesAgo * 60 * 1000),
  table: { id: 't1', number: 5, area: 'Glavna dvorana' },
  orderItems: items.map(itemId => makeItem(itemId, status === 'ready' ? 'ready' : 'pending')),
})

/**
 * findMany po pogojih: prvi klic (aktivna: pending/in-progress),
 * drugi klic (ready shelf). Vrača fixture množici.
 */
function setupDb({ active = [], ready = [] }: { active?: ReturnType<typeof makeOrder>[]; ready?: ReturnType<typeof makeOrder>[] }) {
  findManyMock.mockImplementation((args: { where: { status?: unknown } }) => {
    const status = args.where?.status
    if (status === 'ready') return Promise.resolve(ready)
    return Promise.resolve(active)
  })
}

beforeEach(() => {
  findManyMock.mockReset()
})

describe('GET /api/kitchen — ready shelf (runda 26-b)', () => {
  it('vrne readyOrders poleg orders + stats.readyOrdersCount', async () => {
    setupDb({
      active: [makeOrder('a1', 'pending', 5, ['i1'])],
      ready: [makeOrder('r1', 'ready', 8, ['i2', 'i3'])],
    })
    const res = await GET(new Request('http://localhost/api/kitchen'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.orders).toHaveLength(1)
    expect(data.orders[0].id).toBe('a1')
    expect(Array.isArray(data.readyOrders)).toBe(true)
    expect(data.readyOrders).toHaveLength(1)
    expect(data.readyOrders[0].id).toBe('r1')
    expect(data.stats.readyOrdersCount).toBe(1)
    expect(data.stats.totalActive).toBe(2) // 1 aktivno + 1 ready
  })

  it('ready množica je poizvedena z where status=ready, orderBy createdAt asc, take 10', async () => {
    setupDb({ ready: [] })
    await GET(new Request('http://localhost/api/kitchen'))
    const calls = findManyMock.mock.calls.map(c => c[0])
    const readyCall = calls.find(c => c.where?.status === 'ready')
    expect(readyCall).toBeDefined()
    // FIX R85-4a M1: where nosi tudi tenant scope (session lokacija 'loc-1')
    expect(readyCall.where).toEqual({ status: 'ready', locationId: 'loc-1' })
    expect(readyCall.orderBy).toEqual({ createdAt: 'asc' })
    expect(readyCall.take).toBe(10)
    // Aktivna poizvedba se NI spremenila (regresija)
    const activeCall = calls.find(c => c.where?.status?.in)
    expect(activeCall.where.status.in).toEqual(['pending', 'in-progress'])
  })

  it('ready naročila so enrichirana (waitMinutes, urgency, readyCount, totalItems)', async () => {
    setupDb({
      ready: [makeOrder('r1', 'ready', 25, ['i1', 'i2', 'i3'])],
    })
    const res = await GET(new Request('http://localhost/api/kitchen'))
    const data = await res.json()
    const ready = data.readyOrders[0]
    expect(ready.waitMinutes).toBeGreaterThanOrEqual(24)
    expect(ready.urgency).toBe('critical') // ≥ 20 min
    expect(ready.readyCount).toBe(3)
    expect(ready.pendingCount).toBe(0)
    expect(ready.preparingCount).toBe(0)
    expect(ready.totalItems).toBe(3)
    expect(ready.table.number).toBe(5)
  })

  it(' urgency praga: 10–19 min = warning, < 10 min = normal', async () => {
    setupDb({
      ready: [
        makeOrder('r-warn', 'ready', 12, ['i1']),
        makeOrder('r-norm', 'ready', 3, ['i1']),
      ],
    })
    const res = await GET(new Request('http://localhost/api/kitchen'))
    const data = await res.json()
    const byId = Object.fromEntries(data.readyOrders.map((o: { id: string; urgency: string }) => [o.id, o.urgency]))
    expect(byId['r-warn']).toBe('warning')
    expect(byId['r-norm']).toBe('normal')
  })

  it('prazna baza → prazni seznam + stats nič (brez crasha)', async () => {
    setupDb({})
    const res = await GET(new Request('http://localhost/api/kitchen'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.orders).toEqual([])
    expect(data.readyOrders).toEqual([])
    expect(data.stats.totalActive).toBe(0)
    expect(data.stats.readyOrdersCount).toBe(0)
    expect(data.stats.avgWaitTime).toBe(0)
  })

  it('pageSize limit param vpliva SAMO na aktivna naročila (ready shelf fixed take 10)', async () => {
    setupDb({})
    await GET(new Request('http://localhost/api/kitchen?limit=5'))
    const calls = findManyMock.mock.calls.map(c => c[0])
    const activeCall = calls.find(c => c.where?.status?.in)
    expect(activeCall.take).toBe(5)
    const readyCall = calls.find(c => c.where?.status === 'ready')
    expect(readyCall.take).toBe(10)
  })
})

// Kratka smoke zaveza: DAY konstanta uporabljena v fixture (nit guard)
void DAY
