// ============================================
// P1-21: TESTNA MATRIKA — WebSocket reconnect
// ============================================
// Zahteva (uporabnik): test za "WebSocket reconnect".
//
// createWSConnection (src/lib/websocket-client/use-kitchen-websocket/useWSConnect.ts):
//   - onclose (code ≠ 1000) → eksponentni backoff: min(1000 * 2^attempt, 30s)
//   - maxReconnectAttempts (default 10) → konča poskuse
//   - onopen → reset števca poskusov
//   - close(1000) = klientova namera → NO reconnect
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { createWSConnection } from '@/lib/websocket-client/use-kitchen-websocket/useWSConnect'

vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'log').mockImplementation(() => {})

// ── Fake WebSocket ──
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

function makeCallbacks(overrides: Record<string, unknown> = {}) {
  return {
    setConnected: vi.fn(),
    setLastEvent: vi.fn(),
    invalidateRelevantQueries: vi.fn(),
    startHeartbeat: vi.fn(),
    stopHeartbeat: vi.fn(),
    handlePong: vi.fn(),
    onEventRef: { current: undefined },
    tokenRef: { current: null },
    autoReconnectRef: { current: true },
    maxReconnectAttemptsRef: { current: 3 },
    reconnectAttemptsRef: { current: 0 },
    reconnectTimerRef: { current: null as ReturnType<typeof setTimeout> | null },
    connectFnRef: { current: vi.fn() },
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  instances.length = 0
  vi.stubGlobal('WebSocket', FakeWebSocket)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// ─────────────────────────────────────────────
// 15. WEBSOCKET RECONNECT
// ─────────────────────────────────────────────
describe('P1-21 #15: WebSocket reconnect z eksponentnim backoffom', () => {
  it('nenamerna prekinitev (code 1006) → reconnect po 1s (prvi poskus)', () => {
    const cb = makeCallbacks()
    const ws = createWSConnection(cb) as unknown as FakeWebSocket
    expect(ws).toBeInstanceOf(FakeWebSocket)

    ws.onclose!({ code: 1006 })

    // Še ni reconnectan — čaka 1s backoff
    expect(cb.connectFnRef.current).not.toHaveBeenCalled()
    vi.advanceTimersByTime(999)
    expect(cb.connectFnRef.current).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(cb.connectFnRef.current).toHaveBeenCalledTimes(1)
  })

  it('backoff se EKSPONENTNO povečuje: 1s → 2s → 4s (min(1000·2^n, 30s))', () => {
    const cb = makeCallbacks({ maxReconnectAttemptsRef: { current: 10 } })
    const ws = createWSConnection(cb) as unknown as FakeWebSocket

    // 1. poskus: delay 1s
    ws.onclose!({ code: 1006 })
    vi.advanceTimersByTime(1000)
    expect(cb.connectFnRef.current).toHaveBeenCalledTimes(1)
    cb.reconnectAttemptsRef.current = 1

    // 2. poskus: delay 2s
    ws!.onclose!({ code: 1006 })
    vi.advanceTimersByTime(1999)
    expect(cb.connectFnRef.current).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(cb.connectFnRef.current).toHaveBeenCalledTimes(2)
    cb.reconnectAttemptsRef.current = 2

    // 3. poskus: delay 4s
    ws!.onclose!({ code: 1006 })
    vi.advanceTimersByTime(3999)
    expect(cb.connectFnRef.current).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(1)
    expect(cb.connectFnRef.current).toHaveBeenCalledTimes(3)
  })

  it('cap na 30s — delay ne presega 30 tisoč ms', () => {
    const cb = makeCallbacks({ maxReconnectAttemptsRef: { current: 10 } })
    const ws = createWSConnection(cb) as unknown as FakeWebSocket

    // attempts = 6 → 1000·2^6 = 64s → cap na 30s
    cb.reconnectAttemptsRef.current = 6
    ws.onclose!({ code: 1006 })

    vi.advanceTimersByTime(29_999)
    expect(cb.connectFnRef.current).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(cb.connectFnRef.current).toHaveBeenCalledTimes(1)
  })

  it('maxReconnectAttempts dosežen (3) → NEHA s poskusi (ne loop v večnost)', () => {
    const cb = makeCallbacks({ maxReconnectAttemptsRef: { current: 3 } })
    const ws = createWSConnection(cb) as unknown as FakeWebSocket

    // Trije dovoljeni poskusi (attempts 0, 1, 2)
    for (let i = 0; i < 3; i++) {
      ws.onclose!({ code: 1006 })
      vi.advanceTimersByTime(30_000)
      cb.reconnectAttemptsRef.current = i + 1
    }
    expect(cb.connectFnRef.current).toHaveBeenCalledTimes(3)

    // 4. prekinitev — attempts (3) ni več < max (3) → brez novega timer-ja
    ws.onclose!({ code: 1006 })
    vi.advanceTimersByTime(120_000)
    expect(cb.connectFnRef.current).toHaveBeenCalledTimes(3)
    // nova povezava se NI razporedila (edino behavioral zagotovilo:
    // connect ni bil klican 4. krat tudi po 120s)
  })

  it('close(1000) = klientova namera (disconnect/logout) → BREZ reconnecta', () => {
    const cb = makeCallbacks()
    const ws = createWSConnection(cb) as unknown as FakeWebSocket

    ws.onclose!({ code: 1000 })
    vi.advanceTimersByTime(60_000)
    expect(cb.connectFnRef.current).not.toHaveBeenCalled()
    expect(cb.reconnectTimerRef.current).toBeNull()
  })

  it('uspešna povezava (onopen) resetira števec poskusov → naslednji backoff spet 1s', () => {
    const cb = makeCallbacks({ maxReconnectAttemptsRef: { current: 10 } })
    const ws = createWSConnection(cb) as unknown as FakeWebSocket

    // Trije neuspešni poskusi
    for (let i = 0; i < 3; i++) {
      ws.onclose!({ code: 1006 })
      vi.advanceTimersByTime(30_000)
      cb.reconnectAttemptsRef.current = i + 1
    }
    expect(cb.connectFnRef.current).toHaveBeenCalledTimes(3)
    expect(cb.reconnectAttemptsRef.current).toBe(3)

    // Uspešna reconnect povezava
    const ws2 = instances[instances.length - 1]
    ws2.readyState = FakeWebSocket.OPEN
    ws2.onopen!()
    expect(cb.reconnectAttemptsRef.current).toBe(0)
    expect(cb.setConnected).toHaveBeenCalledWith(true)

    // Nova prekinitev → spet 1s backoff (ne 8s kot bi bil pri attempt=3)
    ws2.onclose!({ code: 1006 })
    vi.advanceTimersByTime(999)
    expect(cb.connectFnRef.current).toHaveBeenCalledTimes(3)
    vi.advanceTimersByTime(1)
    expect(cb.connectFnRef.current).toHaveBeenCalledTimes(4)
  })

  it('onopen pošlje AUTH + IDENTIFY sporočilo (token NI v URL-ju — FIX HIGH)', () => {
    const cb = makeCallbacks({ tokenRef: { current: 'tok-p21' } })
    const ws = createWSConnection(cb) as unknown as FakeWebSocket
    expect(ws.url).not.toContain('tok-p21')
    expect(ws.url).not.toContain('?')
    expect(ws.url.startsWith('ws')).toBe(true)

    ws.readyState = FakeWebSocket.OPEN
    ws.onopen!()
    const sent = ws.send.mock.calls.map((c) => JSON.parse(c[0] as string))
    expect(sent.some((m) => m.type === 'AUTH' && m.payload.token === 'tok-p21')).toBe(true)
    expect(sent.some((m) => m.type === 'IDENTIFY')).toBe(true)
  })
})
