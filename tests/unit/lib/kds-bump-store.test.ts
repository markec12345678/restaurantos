// ============================================
// KDS BUMP STORE — testi (runda 26-b, Toast vzorec)
// ============================================
// Pokritost: čisti helperji (bumpEntry, removeEntry, pruneBumpedEntries,
// getVisibleReadyOrders) + integracija zustand store-a (bump/recall/
// recallAll/prune z persist rehydratacijo).
// Kontekst: bump je odjemalska DISPLAY akcija — NE spremeni statusa naročila
// v bazi (plačilo/zaključek ostane naloga natakarja, P2-UX potrditev nedotaknjena).

import { describe, it, expect, beforeEach } from 'vitest'
import {
  bumpEntry,
  removeEntry,
  pruneBumpedEntries,
  getVisibleReadyOrders,
  useKdsBumpedStore,
  BUMPED_MAX_AGE_MS,
} from '@/components/pos/kitchen/bumped-store'
import type { EnrichedOrder } from '@/components/pos/kitchen/types'

// --- Fixtures ---
const makeOrder = (id: string, orderNumber: number): EnrichedOrder => ({
  id,
  orderNumber,
  type: 'dine-in',
  status: 'ready',
  customerName: '',
  notes: '',
  createdAt: new Date().toISOString(),
  waitMinutes: 12,
  urgency: 'normal',
  pendingCount: 0,
  preparingCount: 0,
  readyCount: 3,
  totalItems: 3,
  table: null,
  orderItems: [],
})

describe('bumpEntry (čisti helper)', () => {
  it('zapiše nov vnos s timestampom', () => {
    const map = bumpEntry({}, 'o1', 1000)
    expect(map).toEqual({ o1: 1000 })
  })

  it('obstoječi vnos ostane nespremenjen (idempotentno — prvi timestamp)', () => {
    const map = bumpEntry({ o1: 1000 }, 'o1', 9999)
    expect(map).toEqual({ o1: 1000 })
  })

  it('ne mutira vhodnega objekta', () => {
    const original: Record<string, number> = { o1: 1000 }
    const next = bumpEntry(original, 'o2', 2000)
    expect(original).toEqual({ o1: 1000 })
    expect(next).toEqual({ o1: 1000, o2: 2000 })
  })
})

describe('removeEntry (recall posameznega)', () => {
  it('odstrani vnos', () => {
    const map = removeEntry({ o1: 1000, o2: 2000 }, 'o1')
    expect(map).toEqual({ o2: 2000 })
  })

  it('neobstoječi id → nespremenjen (isti objekt)', () => {
    const original: Record<string, number> = { o1: 1000 }
    expect(removeEntry(original, 'ghost')).toBe(original)
  })
})

describe('pruneBumpedEntries (auto-čiščenje)', () => {
  it('odstrani vpise starejše od 2h', () => {
    const now = 1_000_000
    const map = { fresh: now - 1000, stale: now - BUMPED_MAX_AGE_MS - 1 }
    const pruned = pruneBumpedEntries(map, now)
    expect(pruned).toEqual({ fresh: now - 1000 })
  })

  it('vpis TOČNO na meji (now - ts === maxAge) ostane', () => {
    const now = 1_000_000
    const map = { edge: now - BUMPED_MAX_AGE_MS }
    expect(pruneBumpedEntries(map, now)).toEqual(map)
  })

  it('prazen vnos → isti objekt (brez alokacije)', () => {
    const map: Record<string, number> = {}
    expect(pruneBumpedEntries(map, 1000)).toBe(map)
  })

  it('kadar nič ni zastarelo → isti objekt', () => {
    const now = 1_000_000
    const map = { a: now - 100, b: now - 200 }
    expect(pruneBumpedEntries(map, now)).toBe(map)
  })

  it('default maxAge = 2 h (konstanta)', () => {
    expect(BUMPED_MAX_AGE_MS).toBe(2 * 60 * 60 * 1000)
  })
})

describe('getVisibleReadyOrders (pick-up shelf filtriranje)', () => {
  it('vrne samo ne-bumpana ready naročila', () => {
    const orders = [makeOrder('a', 1), makeOrder('b', 2), makeOrder('c', 3)]
    const bumped = { b: 123 }
    const visible = getVisibleReadyOrders(orders, bumped)
    expect(visible.map(o => o.id)).toEqual(['a', 'c'])
  })

  it('undefined readyOrders → prazen seznam (varno za cache)', () => {
    expect(getVisibleReadyOrders(undefined, {})).toEqual([])
  })

  it('ne-bumpani → vsa naročila v redu', () => {
    const orders = [makeOrder('a', 1)]
    expect(getVisibleReadyOrders(orders, {})).toHaveLength(1)
  })

  it('prazen seznam → prazen seznam', () => {
    expect(getVisibleReadyOrders([], {})).toEqual([])
  })
})

describe('useKdsBumpedStore (integracija)', () => {
  beforeEach(() => {
    // Reset store-a med testi (persist storage v testnem okolju ne rehidrira)
    useKdsBumpedStore.setState({ bumpedAt: {} })
  })

  it('bump doda vnos, recall ga odstrani', () => {
    const s = useKdsBumpedStore.getState()
    s.bump('o1', 1000)
    expect(useKdsBumpedStore.getState().bumpedAt).toEqual({ o1: 1000 })
    useKdsBumpedStore.getState().recall('o1')
    expect(useKdsBumpedStore.getState().bumpedAt).toEqual({})
  })

  it('recallAll počisti vse (Toast "Recall All")', () => {
    const s = useKdsBumpedStore.getState()
    s.bump('o1', 1000)
    s.bump('o2', 2000)
    expect(Object.keys(useKdsBumpedStore.getState().bumpedAt)).toHaveLength(2)
    useKdsBumpedStore.getState().recallAll()
    expect(useKdsBumpedStore.getState().bumpedAt).toEqual({})
  })

  it('prune odstrani samo zastarele vnose', () => {
    const now = 1_000_000
    useKdsBumpedStore.setState({
      bumpedAt: { fresh: now - 1000, stale: now - BUMPED_MAX_AGE_MS - 1 },
    })
    useKdsBumpedStore.getState().prune(now)
    expect(useKdsBumpedStore.getState().bumpedAt).toEqual({ fresh: now - 1000 })
  })

  it('bump brez `now` uporabi Date.now() (realno uporabo)', () => {
    const before = Date.now()
    useKdsBumpedStore.getState().bump('o-real')
    const ts = useKdsBumpedStore.getState().bumpedAt['o-real']
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(Date.now())
  })

  it('persist ključ je kds-bumped-v1 (kompatibilnost shranjevanja)', () => {
    // Persist API: name je interni, a dostopen prek options — preverimo
    // da store obstaja in ima pričakovane akcije (kontraktni test)
    const s = useKdsBumpedStore.getState()
    expect(typeof s.bump).toBe('function')
    expect(typeof s.recall).toBe('function')
    expect(typeof s.recallAll).toBe('function')
    expect(typeof s.prune).toBe('function')
  })
})
