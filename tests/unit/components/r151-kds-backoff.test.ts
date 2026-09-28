// ============================================
// R151-c — FU-1/FU-3 UI: KDS poll backoff + useKDSWebSocket hardening
// ============================================
// Pokritje:
//   A) čiste konstante + pure interval odločitev: KDS_POLL_ACTIVE_MS/
//      KDS_POLL_FALLBACK_MS (30 s/5 s — KitchenDisplay precedent :57),
//      KDS_WS_RECONNECT_* + kdsWsBackoffDelayMs progresija 1s→2s→4s→30s cap
//   B) shouldConnectKdsWs matrika — dev guard (runda 12 kanon) + Vercel +
//      NEXT_PUBLIC_WS_DISABLED (useDriverWs.shouldConnectWs vzorec)
//   C) useKDSWebSocket na FakeWebSocket (ws-reconnect-p21.test.ts vzorec):
//      eksponentni backoff v hook zanki (prej fiksni 3 s), AUTH_SUCCESS
//      reset števca, dev guard brez instanciacije + stabilen disconnected
//      state, ohranjeno vedenje (AUTH format, ['kds-orders'] invalidacija,
//      new_order → zvok), omejitev 30 poskusov
//   D) useKDSOrders refetchInterval: 5 s brez WS / 30 s z WS (fake timers)
//   E) fs-pin: useKDSPage prenese wsConnected v useKDSOrders
//
// Tehnične opombe (r149/r96–r148 kanon):
//   - unit-vm pool = vmThreads + jsdom; @testing-library NI v devDeps →
//     createRoot + act (IS_REACT_ACT_ENVIRONMENT).
//   - FakeWebSocket prek vi.stubGlobal (ws-reconnect-p21.test.ts:23-70).
//   - NODE_ENV runtime mutacija = tests/setup.ts:11-12 kanon (hook bere
//     process.env.NODE_ENV ob zagonu efekta, ne na importu).
//   - fake timers za backoff in refetchInterval; sonner mock (kanon).
// ============================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import type { Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync } from 'fs'
import { join } from 'path'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

import {
  KDS_WS_RECONNECT_BASE_MS,
  KDS_WS_RECONNECT_MAX_ATTEMPTS,
  KDS_WS_RECONNECT_MAX_MS,
  kdsWsBackoffDelayMs,
  shouldConnectKdsWs,
  useKDSWebSocket,
} from '@/app/kds/use-kds-page/use-kds-session'
import { KDS_POLL_ACTIVE_MS, KDS_POLL_FALLBACK_MS, useKDSOrders } from '@/app/kds/use-kds-page/use-kds-orders'

// React 19 act okolje (jsdom) — potrebno za createRoot render v testih
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// ── Fake WebSocket (ws-reconnect-p21.test.ts:23-46 vzorec) ──
class FakeWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  url: string
  readyState = FakeWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onclose: ((_ev: { code: number; reason?: string }) => void) | null = null
  onmessage: ((_ev: { data: string }) => void) | null = null
  onerror: ((_ev: unknown) => void) | null = null
  send = vi.fn()
  close = vi.fn(() => {
    this.readyState = FakeWebSocket.CLOSED
  })

  constructor(url: string) {
    this.url = url
    instances.push(this)
  }
}

const instances: FakeWebSocket[] = []

/** Konstruktor-bomba: dokaz dev guarda — vsaka instanciacija mori test */
class BombWebSocket {
  constructor() {
    throw new Error('WS instanciran kljub dev guardu!')
  }
}

// ── fiksni harness podatkovi (referenčno stabilni — effect se ne ponavlja) ──
const EMPLOYEE = { id: 'emp-r151', name: 'Kuhar Testni', role: 'kuhar' }
const playSound = vi.fn()

function KdsWsHarness({ employee, sound }: { employee: typeof EMPLOYEE | null; sound: () => void }) {
  const s = useKDSWebSocket(employee, sound)
  // stanje v DOM atribut — brez mutacije zunanje spremenljivke (immutability kanon)
  return createElement('div', { 'data-ws-connected': String(s.wsConnected) })
}

function domWsConnected(container: HTMLElement): boolean {
  return container.querySelector('[data-ws-connected]')?.getAttribute('data-ws-connected') === 'true'
}

function KdsOrdersHarness({ employee, wsConnected }: { employee: typeof EMPLOYEE | null; wsConnected: boolean }) {
  useKDSOrders(employee, [], 'all', () => {}, wsConnected)
  return null
}

// ── mount helperji (r149-analytics kanon: brez @testing-library) ──
const mounted: { root: Root; container: HTMLElement }[] = []
let lastQueryClient: QueryClient | null = null

function mountWithProviders(ui: ReactElement): HTMLElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 }, mutations: { retry: false } },
  })
  lastQueryClient = queryClient
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(createElement(QueryClientProvider, { client: queryClient }, ui))
  })
  mounted.push({ root, container })
  return container
}

/** Flush: react-query microtask verige + setTimeout(0) pod fake timers. */
async function flush(rounds = 2): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
  }
}

// ── fetch stub za useKDSOrders (3× /api/orders?status=...) ──
const fetchMock = vi.fn()

function jsonResponse(payload: unknown): Response {
  return { ok: true, status: 200, json: async () => payload } as unknown as Response
}

function orderCalls(): string[] {
  return fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.includes('/api/orders?status='))
}

/** n-to poslano JSON sporočilo (AUTH preverjanje) */
function sentJson(ws: FakeWebSocket, index = 0): Record<string, unknown> {
  return JSON.parse(String(ws.send.mock.calls[index][0])) as Record<string, unknown>
}

beforeEach(() => {
  vi.useFakeTimers()
  instances.length = 0
  vi.stubGlobal('WebSocket', FakeWebSocket)
  // NODE_ENV runtime mutacija — tests/setup.ts:11-12 kanon (hook bere NODE_ENV
  // ob zagonu efekta → produkcija simulira WS-available okolje)
  ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
  localStorage.setItem('pos_token', 'tok-r151-kds')
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation(async () => jsonResponse({ orders: [] }))
})

afterEach(() => {
  while (mounted.length) {
    const { root, container } = mounted.pop()!
    act(() => {
      root.unmount()
    })
    container.remove()
  }
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
  // setup.ts privzeto 'test' — brez uhajanja v naslednje testne fajle
  ;(process.env as Record<string, string | undefined>).NODE_ENV = 'test'
})

// ============================================
// A) Konstante + čista backoff progresija
// ============================================
describe('R151-c A: KDS konstante + kdsWsBackoffDelayMs (FU-1/FU-3)', () => {
  it('poll konstanti (KitchenDisplay precedent: 30 s ob WS, 5 s fallback)', () => {
    expect(KDS_POLL_ACTIVE_MS).toBe(30_000)
    expect(KDS_POLL_FALLBACK_MS).toBe(5_000)
    // čista interval odločitev
    expect(true ? KDS_POLL_ACTIVE_MS : KDS_POLL_FALLBACK_MS).toBe(30_000)
    expect(false ? KDS_POLL_ACTIVE_MS : KDS_POLL_FALLBACK_MS).toBe(5_000)
  })

  it('backoff konstante v kanonu (1 s baza, 30 s strop, 30 poskusov)', () => {
    expect(KDS_WS_RECONNECT_BASE_MS).toBe(1000)
    expect(KDS_WS_RECONNECT_MAX_MS).toBe(30_000)
    expect(KDS_WS_RECONNECT_MAX_ATTEMPTS).toBe(30)
  })

  it('eksponentna progresija 1s → 2s → 4s → 8s → 16s → cap 30s', () => {
    expect(kdsWsBackoffDelayMs(0)).toBe(1_000)
    expect(kdsWsBackoffDelayMs(1)).toBe(2_000)
    expect(kdsWsBackoffDelayMs(2)).toBe(4_000)
    expect(kdsWsBackoffDelayMs(3)).toBe(8_000)
    expect(kdsWsBackoffDelayMs(4)).toBe(16_000)
    // 1000·2^5 = 32 s → cap 30 s
    expect(kdsWsBackoffDelayMs(5)).toBe(30_000)
    expect(kdsWsBackoffDelayMs(6)).toBe(30_000)
    expect(kdsWsBackoffDelayMs(29)).toBe(30_000)
    expect(kdsWsBackoffDelayMs(100)).toBe(30_000)
  })
})

// ============================================
// B) shouldConnectKdsWs — dev guard matrika (runda 12 kanon)
// ============================================
describe('R151-c B: shouldConnectKdsWs — produkciski-only', () => {
  const base = { nodeEnv: 'production', isVercelHostname: false, wsDisabledFlag: undefined }

  it('dev/test/undefined NODE_ENV → false (next dev nima WS strežnika)', () => {
    expect(shouldConnectKdsWs({ ...base, nodeEnv: 'development' })).toBe(false)
    expect(shouldConnectKdsWs({ ...base, nodeEnv: 'test' })).toBe(false)
    expect(shouldConnectKdsWs({ ...base, nodeEnv: undefined })).toBe(false)
  })

  it('produkcija → true', () => {
    expect(shouldConnectKdsWs(base)).toBe(true)
  })

  it('Vercel hostname → false (serverless, /ws ne obstaja — FIX NAPAKA 3 ohranjen)', () => {
    expect(shouldConnectKdsWs({ ...base, isVercelHostname: true })).toBe(false)
  })

  it('NEXT_PUBLIC_WS_DISABLED=true → false (KDS izklop kanon ohranjen)', () => {
    expect(shouldConnectKdsWs({ ...base, wsDisabledFlag: 'true' })).toBe(false)
    expect(shouldConnectKdsWs({ ...base, wsDisabledFlag: 'false' })).toBe(true)
  })
})

// ============================================
// C) useKDSWebSocket — hardening na FakeWebSocket
// ============================================
describe('R151-c C: useKDSWebSocket — eksponentni backoff (FU-3)', () => {
  it('backoff progresija v hook zanki: 1s → 2s → 4s (prej fiksni 3 s)', () => {
    mountWithProviders(createElement(KdsWsHarness, { employee: EMPLOYEE, sound: playSound }))
    expect(instances.length).toBe(1)

    // prekinitev 1 → reconnect po 1 s
    act(() => { instances[0].onclose!({ code: 1006 }) })
    vi.advanceTimersByTime(999)
    expect(instances.length).toBe(1)
    vi.advanceTimersByTime(1)
    expect(instances.length).toBe(2)

    // prekinitev 2 → reconnect po 2 s
    act(() => { instances[1].onclose!({ code: 1006 }) })
    vi.advanceTimersByTime(1_999)
    expect(instances.length).toBe(2)
    vi.advanceTimersByTime(1)
    expect(instances.length).toBe(3)

    // prekinitev 3 → reconnect po 4 s
    act(() => { instances[2].onclose!({ code: 1006 }) })
    vi.advanceTimersByTime(3_999)
    expect(instances.length).toBe(3)
    vi.advanceTimersByTime(1)
    expect(instances.length).toBe(4)
  })

  it('cap na 30 s — delay ne presega 30 tisoč ms', () => {
    mountWithProviders(createElement(KdsWsHarness, { employee: EMPLOYEE, sound: playSound }))
    // 5 prekinitev z 30 s napredkom vsakič → retries=5 → delay = min(32s, 30s)
    for (let i = 0; i < 5; i++) {
      act(() => { instances[instances.length - 1].onclose!({ code: 1006 }) })
      vi.advanceTimersByTime(30_000)
    }
    expect(instances.length).toBe(6)

    // naslednji reconnect šele po 30 s (ne 32 s — cap)
    act(() => { instances[5].onclose!({ code: 1006 }) })
    vi.advanceTimersByTime(29_999)
    expect(instances.length).toBe(6)
    vi.advanceTimersByTime(1)
    expect(instances.length).toBe(7)
  })

  it('omejitev 30 poskusov ohranjena — po 30 reconnectih se ustavi', () => {
    mountWithProviders(createElement(KdsWsHarness, { employee: EMPLOYEE, sound: playSound }))
    let guard = 0
    while (instances.length < 31 && guard++ < 50) {
      act(() => { instances[instances.length - 1].onclose!({ code: 1006 }) })
      vi.advanceTimersByTime(30_000)
    }
    expect(instances.length).toBe(31) // 1 začetna + 30 reconnectov

    // 31. prekinitev — brez novega timerja (ne loop v večnost)
    act(() => { instances[30].onclose!({ code: 1006 }) })
    vi.advanceTimersByTime(10 * 60_000)
    expect(instances.length).toBe(31)
  })

  it('AUTH_SUCCESS resetira števec poskusov → naslednji backoff spet 1 s', () => {
    mountWithProviders(createElement(KdsWsHarness, { employee: EMPLOYEE, sound: playSound }))
    // trije neuspešni poskusi (retries=3 → naslednji delay bi bil 8 s)
    for (let i = 0; i < 3; i++) {
      act(() => { instances[instances.length - 1].onclose!({ code: 1006 }) })
      vi.advanceTimersByTime(30_000)
    }
    expect(instances.length).toBe(4)

    // 4. povezava: open + AUTH + AUTH_SUCCESS
    const inst = instances[3]
    inst.readyState = FakeWebSocket.OPEN
    act(() => {
      inst.onopen!()
    })
    inst.onmessage!({ data: JSON.stringify({ type: 'AUTH_SUCCESS', payload: { role: 'kuhar' } }) })

    // blip sredi seje → backoff nazaj na 1 s (ne 8 s)
    act(() => { inst.onclose!({ code: 1006 }) })
    vi.advanceTimersByTime(999)
    expect(instances.length).toBe(4)
    vi.advanceTimersByTime(1)
    expect(instances.length).toBe(5)
  })

  it('dev guard: NODE_ENV!==production → brez instanciacije + stabilen disconnected state', () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'
    vi.stubGlobal('WebSocket', BombWebSocket) // vsaka instanciacija mori test
    const c1 = mountWithProviders(createElement(KdsWsHarness, { employee: EMPLOYEE, sound: playSound }))

    // brez instanc, brez reconnect poskusov tudi po 2 minutah
    vi.advanceTimersByTime(120_000)
    expect(domWsConnected(c1)).toBe(false)

    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'test'
    const c2 = mountWithProviders(createElement(KdsWsHarness, { employee: EMPLOYEE, sound: playSound }))
    vi.advanceTimersByTime(120_000)
    expect(domWsConnected(c2)).toBe(false)
  })

  it('brez employee → brez povezave (obstoječe vedenje ohranjeno)', () => {
    const container = mountWithProviders(createElement(KdsWsHarness, { employee: null, sound: playSound }))
    vi.advanceTimersByTime(60_000)
    expect(instances.length).toBe(0)
    expect(domWsConnected(container)).toBe(false)
  })

  it('ohranjeno vedenje: AUTH format, invalidacija ["kds-orders"], new_order → zvok', () => {
    const container = mountWithProviders(createElement(KdsWsHarness, { employee: EMPLOYEE, sound: playSound }))
    const inst = instances[0]
    inst.readyState = FakeWebSocket.OPEN
    // onopen pošlje AUTH + setWsConnected(true) → act flusha re-render
    act(() => {
      inst.onopen!()
    })
    // WS AUDIT format ohranjen: { type: 'AUTH', payload: { token } }
    expect(sentJson(inst)).toEqual({ type: 'AUTH', payload: { token: 'tok-r151-kds' } })
    expect(domWsConnected(container)).toBe(true)

    const invSpy = vi.spyOn(lastQueryClient!, 'invalidateQueries')
    // uppercase normalizacija ohranjena (ITEM_STATUS_UPDATE → item_status_update)
    inst.onmessage!({ data: JSON.stringify({ type: 'ITEM_STATUS_UPDATE', payload: { itemId: 'it-1' } }) })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['kds-orders'] })

    inst.onmessage!({ data: JSON.stringify({ type: 'NEW_ORDER', payload: {} }) })
    expect(playSound).toHaveBeenCalled()
    // AUTH_SUCCESS → brez invalidacije (samo reset števca)
    invSpy.mockClear()
    inst.onmessage!({ data: JSON.stringify({ type: 'AUTH_SUCCESS' }) })
    expect(invSpy).not.toHaveBeenCalled()
  })

  it('unmount → brez reconnectov po unmountu (cleanup počišči timer)', () => {
    mountWithProviders(createElement(KdsWsHarness, { employee: EMPLOYEE, sound: playSound }))
    act(() => { instances[0].onclose!({ code: 1006 }) }) // timer na 1 s je razporejen
    // ročni unmount (afterEach naredi isto) — namerni cleanup ne reconnecta
    while (mounted.length) {
      const { root, container } = mounted.pop()!
      act(() => {
        root.unmount()
      })
      container.remove()
    }
    vi.advanceTimersByTime(60_000)
    expect(instances.length).toBe(1) // brez reconnecta po unmountu
  })
})

// ============================================
// D) useKDSOrders — refetchInterval backoff (FU-1)
// ============================================
describe('R151-c D: useKDSOrders refetchInterval (FU-1)', () => {
  it('brez WS (fallback): refetch vsakih 5 s', async () => {
    mountWithProviders(createElement(KdsOrdersHarness, { employee: EMPLOYEE, wsConnected: false }))
    await flush(2)
    expect(orderCalls().length).toBe(3) // pending + in-progress + ready

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(orderCalls().length).toBe(6)
  })

  it('z WS (aktivno): brez refetcha pri 5 s, varovalka šele pri 30 s', async () => {
    mountWithProviders(createElement(KdsOrdersHarness, { employee: EMPLOYEE, wsConnected: true }))
    await flush(2)
    expect(orderCalls().length).toBe(3)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(orderCalls().length).toBe(3) // WS invalidacije pokrijejo svežino

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000)
    })
    expect(orderCalls().length).toBe(6) // 30 s varovalka
  })
})

// ============================================
// E) fs-pin — call site wiring
// ============================================
describe('R151-c E: useKDSPage prenese wsConnected v useKDSOrders', () => {
  it('useKDSPage.ts poda wsConnected kot 5. argument', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'app', 'kds', 'useKDSPage.ts'), 'utf8')
    expect(src).toContain('useKDSOrders(session.employee, bumpedOrders, stationFilter, setBumpedOrders, wsConnected)')
  })
})
