// ============================================
// R151-c — FU-1/FU-3 UI: driver poll backoff (60 s/15 s) + useDriverWs
// onConnectionChange + app-level ping
// ============================================
// Pokritje:
//   A) konstante + pure interval odločitev: DRIVER_POLL_ACTIVE_MS=60_000 /
//      DRIVER_POLL_FALLBACK_MS=15_000 (R139 kontrakt), DRIVER_WS_PING_
//      INTERVAL_MS=25_000, zastareli DRIVER_POLL_INTERVAL_MS alias pin
//   B) useDriverWs na FakeWebSocket (ws-reconnect-p21.test.ts vzorec):
//      onConnectionChange(true) ŠELE po AUTH_SUCCESS, false ob close;
//      app-level JSON ping vsakih 25 s med povezavo (strežnik ponga —
//      server.js:547-549, pingMessageSchema v server-ws-core.js:67-79),
//      ping ustavljen ob close/unmount; onSignal whitelist 100 % nespremenjen
//   C) dev guard: NODE_ENV!=='production' → brez instanciacije, callback tiho
//   D) useDriverAssignments pollIntervalMs: default 15 s / 60 s ob wsLive;
//      focus refetch nespremenjen
//   E) fs-pin: DriverApp drži wsLive state in poda onConnectionChange +
//      poll interval odločitev
//
// Odločitev o pingu (iz kode, ne domnev): server.js ima DVA srčna utripa —
// protokolni ping (heartbeatCheck :303-312, smer strežnik→klient, 30 s) IN
// app-level JSON ping/pong (server.js:547-549). Protokolni ping pokrije samo
// strežnikovo stran pol-odprte TCP povezave; voznik na mobilni mreži ne
// zazna mrtve poti, dokler NEKAJ ne pošlje (TCP retransmisija → close →
// reconnect). Kanon: src/lib/websocket-client/use-heartbeat.ts:24.
// ============================================

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import type { Root } from 'react-dom/client'
import { readFileSync } from 'fs'
import { join } from 'path'

import {
  DRIVER_WS_PING_INTERVAL_MS,
  WS_RECONNECT_BASE_MS,
  WS_RECONNECT_MAX_MS,
  isDriverRelevantEvent,
  useDriverWs,
} from '@/app/driver/useDriverWs'
import {
  DRIVER_POLL_ACTIVE_MS,
  DRIVER_POLL_FALLBACK_MS,
  DRIVER_POLL_INTERVAL_MS,
  useDriverAssignments,
} from '@/app/driver/useDriverAssignments'

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

// ── harnessi (brez @testing-library — hišni kanon) ──
function DriverWsHarness(props: {
  onSignal: () => void
  enabled: boolean
  onConnectionChange?: (connected: boolean) => void
}) {
  useDriverWs(props)
  return null
}

function DriverAssignmentsHarness({ pollIntervalMs }: { pollIntervalMs?: number }) {
  useDriverAssignments(pollIntervalMs)
  return null
}

const mounted: { root: Root; container: HTMLElement }[] = []

function mountPlain(ui: ReactElement): void {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(ui)
  })
  mounted.push({ root, container })
}

/** Flush: microtask verige pod fake timers. */
async function flush(rounds = 2): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
  }
}

// ── fetch stub za useDriverAssignments (authFetch → global fetch) ──
const fetchMock = vi.fn()

function jsonResponse(payload: unknown): Response {
  return { ok: true, status: 200, json: async () => payload } as unknown as Response
}

function assignmentCalls(): string[] {
  return fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.includes('/api/delivery/assignments'))
}

/** vsa poslana 'ping' sporočila na instanci */
function sentPings(ws: FakeWebSocket): unknown[] {
  return ws.send.mock.calls
    .map(([raw]) => JSON.parse(String(raw)))
    .filter((m) => (m as { type?: string }).type === 'ping')
}

/** open + AUTH + AUTH_SUCCESS — standardna priprava povezave */
function connectAndAuth(ws: FakeWebSocket): void {
  ws.readyState = FakeWebSocket.OPEN
  ws.onopen!()
  ws.onmessage!({ data: JSON.stringify({ type: 'AUTH_SUCCESS', payload: { role: 'staff', employeeId: 'emp-1' } }) })
}

// R151-d: eksplicitni Mock tipi — ReturnType<typeof vi.fn> (Mock<Procedure |
// Constructable>) ni asignabilen na () => void / (connected: boolean) => void
let onSignal: Mock<() => void>
let onConnChange: Mock<(connected: boolean) => void>

beforeEach(() => {
  vi.useFakeTimers()
  instances.length = 0
  vi.stubGlobal('WebSocket', FakeWebSocket)
  // NODE_ENV runtime mutacija — tests/setup.ts:11-12 kanon (useDriverWs bere
  // process.env.NODE_ENV ob zagonu efekta; shouldConnectWs produkciski-only)
  ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
  localStorage.setItem('pos_token', 'tok-r151-driver') // getStoredToken triple-shramba
  onSignal = vi.fn<() => void>()
  onConnChange = vi.fn<(connected: boolean) => void>()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation(async () =>
    jsonResponse({ mine: [], ready: [], timestamp: '2025-01-01T00:00:00.000Z' }),
  )
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
// A) Konstante + pure interval odločitev
// ============================================
describe('R151-c A: driver konstante (FU-1, R139 kontrakt)', () => {
  it('poll konstanti: 60 s ob živi WS, 15 s fallback', () => {
    expect(DRIVER_POLL_ACTIVE_MS).toBe(60_000)
    expect(DRIVER_POLL_FALLBACK_MS).toBe(15_000)
    // čista interval odločitev (DriverApp wiring)
    expect(true ? DRIVER_POLL_ACTIVE_MS : DRIVER_POLL_FALLBACK_MS).toBe(60_000)
    expect(false ? DRIVER_POLL_ACTIVE_MS : DRIVER_POLL_FALLBACK_MS).toBe(15_000)
  })

  it('zastareli DRIVER_POLL_INTERVAL_MS = fallback (r137-c pin ostane zelen)', () => {
    expect(DRIVER_POLL_INTERVAL_MS).toBe(15_000)
    expect(DRIVER_POLL_INTERVAL_MS).toBe(DRIVER_POLL_FALLBACK_MS)
  })

  it('WS konstante: backoff kanon + ping interval 25 s', () => {
    expect(WS_RECONNECT_BASE_MS).toBe(1000)
    expect(WS_RECONNECT_MAX_MS).toBe(30_000)
    expect(DRIVER_WS_PING_INTERVAL_MS).toBe(25_000)
  })

  it('isDriverRelevantEvent whitelist nespremenjen (regresijski pin)', () => {
    expect(isDriverRelevantEvent('DELIVERY_UPDATED', null)).toBe(true)
    expect(isDriverRelevantEvent('NEW_ORDER', { type: 'delivery' })).toBe(true)
    expect(isDriverRelevantEvent('NEW_ORDER', { type: 'dine_in' })).toBe(false)
    expect(isDriverRelevantEvent('pong', {})).toBe(false)
    expect(isDriverRelevantEvent('AUTH_SUCCESS', {})).toBe(false)
  })
})

// ============================================
// B) useDriverWs — onConnectionChange + ping
// ============================================
describe('R151-c B: useDriverWs onConnectionChange (FU-3)', () => {
  it('onConnectionChange(true) ŠELE po AUTH_SUCCESS (open sam zadošča NE)', () => {
    mountPlain(createElement(DriverWsHarness, { onSignal, enabled: true, onConnectionChange: onConnChange }))
    const inst = instances[0]
    expect(inst.url).not.toContain('tok-r151-driver') // žeton NIKOLI v URL
    expect(inst.url.endsWith('/ws')).toBe(true)

    inst.readyState = FakeWebSocket.OPEN
    inst.onopen!()
    expect(onConnChange).not.toHaveBeenCalled() // prej: samo AUTH poslan

    inst.onmessage!({ data: JSON.stringify({ type: 'AUTH_SUCCESS', payload: { role: 'staff' } }) })
    expect(onConnChange).toHaveBeenCalledTimes(1)
    expect(onConnChange).toHaveBeenCalledWith(true)
  })

  it('onConnectionChange(false) ob close + reconnect po 1 s (AUTH reset ohranjen)', () => {
    mountPlain(createElement(DriverWsHarness, { onSignal, enabled: true, onConnectionChange: onConnChange }))
    const inst = instances[0]
    connectAndAuth(inst)

    inst.onclose!({ code: 1006 })
    expect(onConnChange).toHaveBeenLastCalledWith(false)

    // retries so bili resetirani ob AUTH_SUCCESS → backoff nazaj na 1 s
    vi.advanceTimersByTime(999)
    expect(instances.length).toBe(1)
    vi.advanceTimersByTime(1)
    expect(instances.length).toBe(2)
    // callback ostane false (nova povezava še ni avtenticirana — brez podvojenih true)
    expect(onConnChange).toHaveBeenLastCalledWith(false)
  })

  it('error → close → enojen false (error se izteče v close)', () => {
    mountPlain(createElement(DriverWsHarness, { onSignal, enabled: true, onConnectionChange: onConnChange }))
    const inst = instances[0]
    connectAndAuth(inst)

    inst.onerror!({ message: 'simulirana napaka' }) // hook: ws.close()
    // FakeWebSocket.close ne odpali close eventa samodejno — browser ga
    // odpali asinhrono; simulirajmo zaporedje error → close
    inst.onclose!({ code: 1006 })
    expect(onConnChange).toHaveBeenCalledTimes(2) // true, false
    expect(onConnChange).toHaveBeenNthCalledWith(2, false)
  })

  it('onSignal whitelist 100 % nespremenjen (DELIVERY_UPDATED / NEW_ORDER delivery)', () => {
    mountPlain(createElement(DriverWsHarness, { onSignal, enabled: true, onConnectionChange: onConnChange }))
    const inst = instances[0]
    connectAndAuth(inst)
    expect(onSignal).not.toHaveBeenCalled() // AUTH_SUCCESS NI refetch signal

    inst.onmessage!({ data: JSON.stringify({ type: 'DELIVERY_UPDATED', payload: { deliveryInfoId: 'di-1', reason: 'assigned', status: 'assigned', locationId: 'loc-a' } }) })
    expect(onSignal).toHaveBeenCalledTimes(1)

    inst.onmessage!({ data: JSON.stringify({ type: 'NEW_ORDER', payload: { type: 'delivery', locationId: 'loc-a' } }) })
    expect(onSignal).toHaveBeenCalledTimes(2)

    inst.onmessage!({ data: JSON.stringify({ type: 'NEW_ORDER', payload: { type: 'dine_in' } }) })
    inst.onmessage!({ data: JSON.stringify({ type: 'pong', timestamp: 'x' }) })
    expect(onSignal).toHaveBeenCalledTimes(2) // tuji tipi ignorirani
  })
})

// ============================================
// B2) app-level ping vsakih 25 s (FU-3 odločitev — glej glavo)
// ============================================
describe('R151-c B2: useDriverWs app-level ping', () => {
  it('ping JSON {type:"ping"} vsakih 25 s med povezavo (strežnik ponga)', () => {
    mountPlain(createElement(DriverWsHarness, { onSignal, enabled: true, onConnectionChange: onConnChange }))
    const inst = instances[0]
    connectAndAuth(inst)

    vi.advanceTimersByTime(24_999)
    expect(sentPings(inst).length).toBe(0)
    vi.advanceTimersByTime(1)
    expect(sentPings(inst).length).toBe(1)

    vi.advanceTimersByTime(25_000)
    expect(sentPings(inst).length).toBe(2)
    // ping pade v "nezanimive tipe" vejo → NE sproži onSignal
    expect(onSignal).not.toHaveBeenCalled()
  })

  it('ping se ustavi ob close (brez pingov na novi povezavi pred AUTH)', () => {
    mountPlain(createElement(DriverWsHarness, { onSignal, enabled: true, onConnectionChange: onConnChange }))
    const inst = instances[0]
    connectAndAuth(inst)
    inst.onclose!({ code: 1006 })

    vi.advanceTimersByTime(60_000) // reconnect + 60 s brez AUTH_SUCCESS
    expect(sentPings(inst).length).toBe(0) // stari interval počiščen
    const inst2 = instances[1]
    expect(sentPings(inst2).length).toBe(0) // nova povezava: ping šele po AUTH_SUCCESS
  })

  it('ping se ustavi ob unmountu (cleanup počišči interval)', () => {
    mountPlain(createElement(DriverWsHarness, { onSignal, enabled: true, onConnectionChange: onConnChange }))
    const inst = instances[0]
    connectAndAuth(inst)
    // ročni unmount (afterEach naredi isto)
    while (mounted.length) {
      const { root, container } = mounted.pop()!
      act(() => {
        root.unmount()
      })
      container.remove()
    }
    vi.advanceTimersByTime(60_000)
    expect(sentPings(inst).length).toBe(0)
    expect(instances.length).toBe(1) // brez reconnecta po unmountu
  })
})

// ============================================
// C) dev guard — brez instanciacije v dev/test okolju
// ============================================
describe('R151-c C: useDriverWs dev guard (runda 12 kanon)', () => {
  it('NODE_ENV!==production → brez WebSocket instanciacije, callback tiho', () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'
    vi.stubGlobal('WebSocket', BombWebSocket) // vsaka instanciacija mori test
    mountPlain(createElement(DriverWsHarness, { onSignal, enabled: true, onConnectionChange: onConnChange }))

    vi.advanceTimersByTime(120_000)
    expect(onConnChange).not.toHaveBeenCalled()
    expect(onSignal).not.toHaveBeenCalled()
  })
})

// ============================================
// D) useDriverAssignments — pollIntervalMs (FU-1)
// ============================================
describe('R151-c D: useDriverAssignments pollIntervalMs (FU-1)', () => {
  it('default (brez argumenta): poll vsakih 15 s', async () => {
    mountPlain(createElement(DriverAssignmentsHarness, {}))
    await flush(2)
    expect(assignmentCalls().length).toBe(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })
    expect(assignmentCalls().length).toBe(2)
  })

  it('pollIntervalMs=60_000 (R139 kontrakt): brez refetcha pri 15 s, refetch pri 60 s', async () => {
    mountPlain(createElement(DriverAssignmentsHarness, { pollIntervalMs: DRIVER_POLL_ACTIVE_MS }))
    await flush(2)
    expect(assignmentCalls().length).toBe(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })
    expect(assignmentCalls().length).toBe(1) // stari 15 s poll ni več

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000)
    })
    expect(assignmentCalls().length).toBe(2) // 60 s varovalka
  })

  it('focus refetch ostane nespremenjen (tudi z 60 s pollom)', async () => {
    mountPlain(createElement(DriverAssignmentsHarness, { pollIntervalMs: DRIVER_POLL_ACTIVE_MS }))
    await flush(2)
    expect(assignmentCalls().length).toBe(1)

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await flush(1)
    expect(assignmentCalls().length).toBe(2)
  })
})

// ============================================
// E) fs-pin — DriverApp wiring
// ============================================
describe('R151-c E: DriverApp wsLive wiring', () => {
  it('DriverApp.tsx drži wsLive state + poda onConnectionChange in poll odločitev', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'app', 'driver', 'DriverApp.tsx'), 'utf8')
    expect(src).toContain('const [wsLive, setWsLive] = useState(false)')
    expect(src).toContain('onConnectionChange: setWsLive')
    expect(src).toContain('wsLive ? DRIVER_POLL_ACTIVE_MS : DRIVER_POLL_FALLBACK_MS')
  })
})
