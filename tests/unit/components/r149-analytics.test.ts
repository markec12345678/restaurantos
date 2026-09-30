// ============================================
// R149-c (epic #115 #36 Advanced analytics) — UI: AdvancedAnalyticsModule +
// registracija (navItems / module-registry / i18n / query-keys)
//
// Pokritost (r146-export-report + r147-portability hišni kanon):
//   A) KPI izris iz fixture (StatsCard kanon) + comparison badges
//      (deltaPct puščica: gor emerald / dol rdeča / null nevtralno — NIKOLI NaN)
//   B) grafi in sekcije: BarChart (series), 2× PieChart (kategorije +
//      plačilna mešanica), 24-urni hourly vektor, top artikli, tipi naročil,
//      staff tabela z '(neimenovan)' fallbackom, meta (rowCap/prev okno)
//   C) MODEL A: admin/super_admin vidi Lokacija select + /api/locations klic;
//      manager/waiter NE — a overview query TEEKE naprej (brez locationId);
//      'all' → URL brez locationId, izbrana lokacija → encodeURIComponent;
//      neaktivna lokacija disabled
//   D) preseti 7/30/90 (start = end − (N−1), LJ kanon) + granularnost
//      day→month refetch (URL/queryKey)
//   E) stanja: skeleton (aria-busy), Alert destructive + 'Poskusi znova'
//      (refetch), prazno stanje 'Ni podatkov za izbrano obdobje', toast.error
//      passthrough TOČNO body.error (403 NO_LOCATION_MESSAGE)
//   F) pure helperji: buildOverviewUrl + shiftDateStr (DST-varen koledarski
//      subtract) + analyticsKeys oblika (EN koren ['analytics'])
//   G) fs-pini: navItems vnos v 'analytics' grupi (permission view_reports,
//      NI adminOnly), module-registry dynamic path (ssr:false), i18n ×5
//      (navigation/*.ts kanon R147-c — messages sloj izbrisan R167), query-keys barrel,
//      brez blue/indigo, brez grid-cols-14
//
// Tehnične opombe (r96/r142–r147 kanon):
//   - unit-vm pool = vmThreads + jsdom; @testing-library NI v devDeps →
//     createRoot + act (IS_REACT_ACT_ENVIRONMENT).
//   - '@/components/pos/PinLogin' = CELOTEN mock; getCurrentUser kontrolira
//     vlogo (useAuthUser bere iz njega).
//   - recharts: CELOTEN mock z DOM stubi (data-chart/data-length attribute) —
//     ResponsiveContainer v jsdom ne meri layouta; stub dokazuje data flow
//     (dolžina serije/dataKey) brez risanja. ResizeObserver vseeno stuban za
//     Radix Select popper.
//   - Radix Select 2.x: odpiranje prek KeyboardEvent('ArrowDown') na
//     [data-slot="select-trigger"], izbira prek KeyboardEvent('Enter') na
//     [role="option"].
// ============================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// R174 IA: navItems je deriviran iz registerja — pin prenesen na register
import { MODULE_REGISTRY } from '@/lib/modules/registry'
import { navGroups } from '@/components/pos/sidebar/navItems'
import { createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import type { Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync } from 'fs'
import { join } from 'path'

import { authFetch, getCurrentUser } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import {
  AdvancedAnalyticsModule,
  ALL_LOCATIONS_VALUE,
  buildOverviewUrl,
  shiftDateStr,
} from '@/components/pos/analytics/AdvancedAnalyticsModule'
import { queryKeys } from '@/lib/query-keys'
import { NO_LOCATION_MESSAGE } from '@/lib/tenant-scope'
import type { AuthUser } from '@/components/pos/pin-login/constants'
import type { AnalyticsOverviewResponse } from '@/components/pos/analytics/AdvancedAnalyticsModule'

vi.mock('@/components/pos/PinLogin', () => ({
  authFetch: vi.fn(),
  getCurrentUser: vi.fn(() => null),
  setCurrentUser: vi.fn(),
  getAuthToken: vi.fn(() => 'test-token'),
  setAuthToken: vi.fn(),
  hasPermission: vi.fn(() => true),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

// recharts → DOM stubi (glej tehnične opombe): data-chart/data-length/data-*key.
vi.mock('recharts', async () => {
  const { createElement } = await import('react')
  function stub(tag: string) {
    const Stub = (props: Record<string, unknown>) =>
      createElement('div', {
        'data-chart': tag,
        'data-length': Array.isArray(props['data']) ? String((props['data'] as unknown[]).length) : undefined,
        'data-datakey': typeof props['dataKey'] === 'string' ? props['dataKey'] : undefined,
        'data-namekey': typeof props['nameKey'] === 'string' ? props['nameKey'] : undefined,
      }, (props['children'] ?? null) as never)
    return Stub
  }
  return {
    ResponsiveContainer: stub('ResponsiveContainer'),
    BarChart: stub('BarChart'),
    Bar: stub('Bar'),
    XAxis: stub('XAxis'),
    YAxis: stub('YAxis'),
    CartesianGrid: stub('CartesianGrid'),
    Tooltip: stub('Tooltip'),
    PieChart: stub('PieChart'),
    Pie: stub('Pie'),
    Cell: stub('Cell'),
  }
})

const authFetchMock = vi.mocked(authFetch)
const getCurrentUserMock = vi.mocked(getCurrentUser)
const toastSuccessMock = vi.mocked(toast.success)
const toastErrorMock = vi.mocked(toast.error)

// React 19 act okolje (jsdom) — potrebno za createRoot render v testih
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// --- jsdom pomanjkljivosti za Radix Select (popper) ---
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
;(globalThis as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverStub
Element.prototype.scrollIntoView = function scrollIntoViewStub(): void {}

// ============================================
// Fixture — vloge + lokacije + overview odgovor (realna R149-b shape)
// ============================================

const AUTH_USER_BASE = {
  id: 'emp-r149',
  name: 'Ana Testna',
  email: 'ana.testna@restavracija.si',
  primaryJob: null,
  permissions: [] as string[],
}

function authUserWithRole(role: string): AuthUser {
  return { ...AUTH_USER_BASE, role } as AuthUser
}

// 'loc-b 2&3' vsebuje posebne znake → asertira encodeURIComponent na URL-ju.
const LOCATIONS = [
  { id: 'loc-a', name: 'Gostilna Štefan', isActive: true },
  { id: 'loc-b 2&3', name: 'Bistro Mestna', isActive: true },
  { id: 'loc-c', name: 'Zaprta poslovalnica', isActive: false },
]

const KPI_FIXTURE = { revenue: 12345.67, tax: 2286.94, tips: 456.78, discounts: 123.45, orders: 321, avgOrderValue: 38.46 }

function makeSeries(start: string, end: string): AnalyticsOverviewResponse['series'] {
  const s = new Date(`${start}T00:00:00Z`).getTime()
  const n = Math.round((new Date(`${end}T00:00:00Z`).getTime() - s) / 86_400_000) + 1
  return Array.from({ length: n }, (_, i) => ({
    bucket: `dan ${i + 1}`,
    start,
    end,
    revenue: 100 + i,
    orders: i + 1,
    avgOrderValue: 10 + i / 10,
  }))
}

function overviewFixture(start: string, end: string, granularity = 'day'): AnalyticsOverviewResponse {
  return {
    window: { start, end, granularity, prevStart: shiftDateStr(start, -30), prevEnd: shiftDateStr(start, -1) },
    kpis: { ...KPI_FIXTURE },
    series: makeSeries(start, end),
    comparison: {
      revenue: { current: 12345.67, previous: 11000, deltaPct: 12.2 },
      orders: { current: 321, previous: 338, deltaPct: -5 },
      avgOrderValue: { current: 38.46, previous: 32.5, deltaPct: null },
    },
    topItems: [
      { menuItemId: 'mi-1', name: 'Pizza Margherita', quantity: 42, revenue: 512.4 },
      { menuItemId: 'mi-2', name: 'Zelo dolgo ime artikla ki se mora odrezati na 390px', quantity: 18, revenue: 198 },
    ],
    categoryBreakdown: [
      { category: 'Jedi', quantity: 120, revenue: 800 },
      { category: 'Pijače', quantity: 200, revenue: 400 },
    ],
    hourlyProfile: Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${String(h).padStart(2, '0')}:00`,
      revenue: h === 19 ? 500 : h % 3 === 0 ? 100 : 0,
      orders: h === 19 ? 20 : h % 3 === 0 ? 4 : 0,
    })),
    paymentMix: [
      { type: 'cash', amount: 800, tips: 20, count: 50 },
      { type: 'card', amount: 600.5, tips: 12, count: 40 },
    ],
    orderTypeMix: [
      { type: 'dine-in', revenue: 900.25, orders: 200 },
      { type: 'takeout', revenue: 300.17, orders: 80 },
    ],
    staffPerformance: [
      { employeeId: 'emp-1', name: 'Ana Testna', revenue: 700, orders: 30 },
      { employeeId: 'emp-2', name: '', revenue: 300, orders: 12 },
    ],
    meta: { rowCap: 50_000, windowDays: 30 },
  }
}

function emptyOverviewFixture(start: string, end: string): AnalyticsOverviewResponse {
  return {
    window: { start, end, granularity: 'day', prevStart: start, prevEnd: end },
    kpis: { revenue: 0, tax: 0, tips: 0, discounts: 0, orders: 0, avgOrderValue: 0 },
    series: makeSeries(start, end).map((s) => ({ ...s, revenue: 0, orders: 0, avgOrderValue: 0 })),
    comparison: {
      revenue: { current: 0, previous: 0, deltaPct: null },
      orders: { current: 0, previous: 0, deltaPct: null },
      avgOrderValue: { current: 0, previous: 0, deltaPct: null },
    },
    topItems: [],
    categoryBreakdown: [],
    hourlyProfile: Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${String(h).padStart(2, '0')}:00`, revenue: 0, orders: 0 })),
    paymentMix: [],
    orderTypeMix: [],
    staffPerformance: [],
    meta: { rowCap: 50_000, windowDays: 30 },
  }
}

function jsonResponse(payload: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => payload } as unknown as Response
}

function errorResponse(status: number, error: string): Response {
  return { ok: false, status, json: async () => ({ error }) } as unknown as Response
}

/** Router: GET /api/locations + GET /api/analytics/overview?* (odgovor povožljiv per test). */
let overviewResponder: ((url: string) => Response) | null = null

function routeApi(): void {
  overviewResponder = (url) => {
    const u = new URL(url, 'http://localhost')
    return jsonResponse(overviewFixture(u.searchParams.get('start') ?? '', u.searchParams.get('end') ?? '', u.searchParams.get('granularity') ?? 'day'))
  }
  authFetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : String(input)
    if (url === '/api/locations') return jsonResponse(LOCATIONS)
    if (url.startsWith('/api/analytics/overview?')) return overviewResponder!(url)
    throw new Error(`Nepričakovan klic: ${url}`)
  })
}

function overviewCalls(): string[] {
  return authFetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.startsWith('/api/analytics/overview?'))
}

// --- Render helperji (brez @testing-library — hišni minimalen pristop) ---
const mounted: { root: Root; container: HTMLElement }[] = []

function mountWithProviders(ui: ReactElement): HTMLElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 }, mutations: { retry: false } },
  })
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(createElement(QueryClientProvider, { client: queryClient }, ui))
  })
  mounted.push({ root, container })
  return container
}

/** Flush: react-query microtask verige + setTimeout(0). */
async function flush(rounds = 2): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
  }
}

async function mountModule(role?: string): Promise<HTMLElement> {
  if (role) getCurrentUserMock.mockReturnValue(authUserWithRole(role))
  routeApi()
  const container = mountWithProviders(createElement(AdvancedAnalyticsModule))
  await flush(3)
  return container
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    (Array.from(container.querySelectorAll('button')).find(
      (b) => (b.textContent ?? '').includes(text),
    ) as HTMLButtonElement | null) ?? null
  )
}

function click(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

// --- Radix Select pomočniki (keyboard pot — glej tehnične opombe) ---
function openSelectAt(container: HTMLElement, index: number): void {
  const triggers = container.querySelectorAll('[data-slot="select-trigger"]')
  const trigger = triggers[index] as HTMLElement | undefined
  expect(trigger, `select trigger #${index} NI prisoten`).toBeDefined()
  act(() => {
    trigger!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
  })
}

function pickOption(label: string): void {
  const options = Array.from(document.body.querySelectorAll('[role="option"]'))
  const target = options.find((o) => (o.textContent ?? '').includes(label))
  expect(target, `opcija "${label}" NI v odprtem selectu`).toBeDefined()
  act(() => {
    ;(target as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  })
}

beforeEach(() => {
  authFetchMock.mockReset()
  getCurrentUserMock.mockReset()
  getCurrentUserMock.mockReturnValue(null)
  toastSuccessMock.mockClear()
  toastErrorMock.mockClear()
  overviewResponder = null
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
})

// ============================================
// A) KPI izris + comparison badges
// ============================================

describe('AdvancedAnalyticsModule — KPI izris (R149-c)', () => {
  it('izriše 6 KPI StatsCards iz fixture (SI eur format — formatEUR kanon)', async () => {
    const container = await mountModule('super_admin')
    expect(container.textContent).toContain('Prihodek')
    expect(container.textContent).toContain('12.345,67 €')
    expect(container.textContent).toContain('Naročila')
    expect(container.textContent).toContain('321')
    expect(container.textContent).toContain('Povprečni račun')
    expect(container.textContent).toContain('38,46 €')
    expect(container.textContent).toContain('Napitnine')
    expect(container.textContent).toContain('456,78 €')
    expect(container.textContent).toContain('DDV')
    expect(container.textContent).toContain('2.286,94 €')
    expect(container.textContent).toContain('Popusti')
    expect(container.textContent).toContain('123,45 €')
    // comparison subtitle na primerjanih karticah
    expect(container.textContent).toContain('prejšnje obdobje: 11.000,00 €')
  })

  it('comparison badges: deltaPct > 0 emerald puščica gor, < 0 rdeča dol, null nevtralno "brez primerjave" (nikoli NaN)', async () => {
    const container = await mountModule('admin')
    const up = container.querySelector('[data-testid="analytics-delta-up"]')
    const down = container.querySelector('[data-testid="analytics-delta-down"]')
    const neutral = container.querySelector('[data-testid="analytics-delta-neutral"]')
    expect(up?.textContent).toBe('Prihodek: +12,2 %')
    expect(down?.textContent).toBe('Naročila: -5,0 %')
    expect(neutral?.textContent).toBe('Povprečni račun: brez primerjave')
    expect(container.textContent).not.toContain('NaN')
    // barve: emerald/red/zinc — brez blue/indigo (DOM pin)
    expect(up?.className).toContain('emerald')
    expect(down?.className).toContain('red')
    expect(neutral?.className).toContain('zinc')
  })

  it('okno opomba: obdobje (LJ) + prejšnje primerjalno okno + rowCap meta', async () => {
    const container = await mountModule('admin')
    const note = container.querySelector('[data-testid="analytics-window-note"]')?.textContent ?? ''
    expect(note).toMatch(/Obdobje \d{4}-\d{2}-\d{2} — \d{4}-\d{2}-\d{2} \(Europe\/Ljubljana\)/)
    expect(note).toMatch(/prejšnje okno \d{4}-\d{2}-\d{2} — \d{4}-\d{2}-\d{2}/)
    expect(note).toContain('omejitev 50.000 naročil')
  })
})

// ============================================
// B) Grafi, sekcije, tabela
// ============================================

describe('AdvancedAnalyticsModule — grafi in sekcije (R149-c)', () => {
  it('BarChart (series, dataKey revenue) s fiksno dolžino okna + 2× PieChart (nameKey name)', async () => {
    const container = await mountModule('super_admin')
    const barChart = container.querySelector('[data-chart="BarChart"]')
    expect(barChart).not.toBeNull()
    expect(barChart!.getAttribute('data-length')).toBe('30') // privzeti preset 30 dni
    expect(container.querySelector('[data-chart="Bar"]')!.getAttribute('data-datakey')).toBe('revenue')
    const pies = container.querySelectorAll('[data-chart="PieChart"]')
    expect(pies).toHaveLength(2) // kategorije + plačilna mešanica
    expect(container.querySelectorAll('[data-namekey="name"]').length).toBeGreaterThanOrEqual(2)
  })

  it('legende kategorij in plačil + tipi naročil (SI oznake) so v izrisu', async () => {
    const container = await mountModule('admin')
    expect(container.textContent).toContain('Jedi')
    expect(container.textContent).toContain('800,00 €')
    expect(container.textContent).toContain('Pijače')
    expect(container.textContent).toContain('Gotovina')
    expect(container.textContent).toContain('600,50 €')
    expect(container.textContent).toContain('Na mestu')
    expect(container.textContent).toContain('200 naročil')
    expect(container.textContent).toContain('Za s seboj')
  })

  it('hourlyProfile: točno 24 celic (data-hour 0–23) iz fiksne serije', async () => {
    const container = await mountModule('admin')
    const cells = container.querySelectorAll('[data-testid="analytics-hourly-cell"]')
    expect(cells).toHaveLength(24)
    const hours = Array.from(cells).map((c) => Number(c.getAttribute('data-hour')))
    expect(hours).toEqual(Array.from({ length: 24 }, (_, h) => h))
    expect(container.textContent).toContain('19:00')
  })

  it('top artikli + staff tabela z "(neimenovan)" fallbackom za prazno ime', async () => {
    const container = await mountModule('admin')
    expect(container.textContent).toContain('Pizza Margherita')
    expect(container.textContent).toContain('×42')
    expect(container.textContent).toContain('512,40 €')
    expect(container.textContent).toContain('Ana Testna')
    expect(container.textContent).toContain('(neimenovan)')
    expect(container.textContent).toContain('700,00 €')
    expect(container.textContent).toContain('300,00 €')
  })
})

// ============================================
// C) MODEL A lokacijski select
// ============================================

describe('MODEL A lokacijski select (R149-c)', () => {
  it.each(['super_admin', 'admin'])('skrbnik (%s) vidi Lokacija select, naloži /api/locations in overview brez locationId', async (role) => {
    const container = await mountModule(role)
    expect(container.querySelector('[data-slot="select-trigger"]')).not.toBeNull()
    expect(container.textContent).toContain('Lokacija')
    expect(container.textContent).toContain('Vse lokacije (globalno)')
    expect(container.querySelector('[aria-label="Izbira lokacije za analitiko"]')).not.toBeNull()
    expect(authFetchMock.mock.calls.filter(([url]) => String(url) === '/api/locations').length).toBeGreaterThanOrEqual(1)
    const calls = overviewCalls()
    expect(calls.length).toBeGreaterThanOrEqual(1)
    expect(new URL(calls[0], 'http://localhost').searchParams.has('locationId')).toBe(false)
  })

  it.each(['manager', 'waiter'])('ne-skrbnik (%s) NE vidi lokacijskega selecta, NE kliče /api/locations — overview pa TEEKE naprej (brez locationId)', async (role) => {
    const container = await mountModule(role)
    // enotni trigger = granularnost (lokacijski select NI prisoten)
    expect(container.querySelectorAll('[data-slot="select-trigger"]')).toHaveLength(1)
    expect(container.querySelector('[aria-label="Izbira lokacije za analitiko"]')).toBeNull()
    expect(container.textContent).not.toContain('Vse lokacije (globalno)')
    expect(container.querySelector('[aria-label="Združevanje po obdobjih"]')).not.toBeNull()
    expect(authFetchMock.mock.calls.filter(([url]) => String(url) === '/api/locations')).toHaveLength(0)
    const calls = overviewCalls()
    expect(calls.length).toBeGreaterThanOrEqual(1)
    expect(new URL(calls[0], 'http://localhost').searchParams.has('locationId')).toBe(false)
    expect(container.textContent).toContain('12.345,67 €')
  })

  it('odprti select: aktivni lokaciji omogočeni, neaktivna disabled z " (neaktivna)" suffixom', async () => {
    const container = await mountModule('admin')
    openSelectAt(container, 0)
    await flush(2)
    const options = Array.from(document.body.querySelectorAll('[role="option"]'))
    const labels = options.map((o) => o.textContent ?? '')
    expect(labels).toEqual(
      expect.arrayContaining(['Vse lokacije (globalno)', 'Gostilna Štefan', 'Bistro Mestna', 'Zaprta poslovalnica (neaktivna)']),
    )
    const inactive = options.find((o) => (o.textContent ?? '').includes('Zaprta poslovalnica'))
    expect(inactive!.hasAttribute('data-disabled')).toBe(true)
    const active = options.find((o) => (o.textContent ?? '').includes('Bistro Mestna'))
    expect(active!.hasAttribute('data-disabled')).toBe(false)
  })

  it('MODEL A tok: \'all\' → brez locationId; izbira lokacije → encodeURIComponent; nazaj na \'all\' → nov klic brez (staleTime 0)', async () => {
    const container = await mountModule('super_admin')
    expect(overviewCalls()).toHaveLength(1)

    openSelectAt(container, 0)
    await flush(2)
    pickOption('Bistro Mestna')
    await flush(3)
    expect(container.querySelector('[data-slot="select-trigger"]')?.textContent).toContain('Bistro Mestna')
    expect(overviewCalls()).toHaveLength(2)
    expect(overviewCalls()[1]).toContain('locationId=loc-b%202%263')
    expect(new URL(overviewCalls()[1], 'http://localhost').searchParams.get('locationId')).toBe('loc-b 2&3')

    openSelectAt(container, 0)
    await flush(2)
    pickOption('Vse lokacije (globalno)')
    await flush(3)
    expect(overviewCalls()).toHaveLength(3)
    expect(new URL(overviewCalls()[2], 'http://localhost').searchParams.has('locationId')).toBe(false)
  })
})

// ============================================
// D) Preseti 7/30/90 + granularnost
// ============================================

describe('Obdobje preseti in granularnost (R149-c)', () => {
  it('privzeto 30 dni + granularity=day; preset 7 → start = end − 6 dni in serija 7 točk; 90 → − 89 dni', async () => {
    const container = await mountModule('super_admin')
    const end = new URL(overviewCalls()[0], 'http://localhost').searchParams.get('end')!
    expect(end).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(new URL(overviewCalls()[0], 'http://localhost').searchParams.get('start')).toBe(shiftDateStr(end, -29))
    expect(new URL(overviewCalls()[0], 'http://localhost').searchParams.get('granularity')).toBe('day')

    const preset7 = findButton(container, '7 dni')!
    expect(preset7.getAttribute('aria-pressed')).toBe('false')
    click(preset7)
    await flush(3)
    expect(new URL(overviewCalls()[1], 'http://localhost').searchParams.get('start')).toBe(shiftDateStr(end, -6))
    expect(container.querySelector('[data-chart="BarChart"]')!.getAttribute('data-length')).toBe('7')

    click(findButton(container, '90 dni')!)
    await flush(3)
    expect(new URL(overviewCalls()[2], 'http://localhost').searchParams.get('start')).toBe(shiftDateStr(end, -89))
    expect(container.querySelector('[data-chart="BarChart"]')!.getAttribute('data-length')).toBe('90')
    expect(findButton(container, '90 dni')!.getAttribute('aria-pressed')).toBe('true')
  })

  it('granularnost Dan → Mesec sproži refetch z granularity=month', async () => {
    const container = await mountModule('super_admin')
    // 2 select triggerja za skrbnika: [0] lokacija, [1] granularnost
    expect(container.querySelectorAll('[data-slot="select-trigger"]')).toHaveLength(2)
    openSelectAt(container, 1)
    await flush(2)
    pickOption('Mesec')
    await flush(3)
    const calls = overviewCalls()
    expect(calls).toHaveLength(2)
    expect(new URL(calls[1], 'http://localhost').searchParams.get('granularity')).toBe('month')
  })
})

// ============================================
// E) Stanja: napaka + retry, 403 passthrough, prazno, skeleton
// ============================================

describe('Stanja (R149-c)', () => {
  it('error Alert destructive + toast.error passthrough + "Poskusi znova" refetch uspešen', async () => {
    const container = await mountModule('manager')
    overviewResponder = () => errorResponse(500, 'Napaka pri izračunu analitike')
    // sproži nov request (preset sprememba → nov queryKey) → query pade v napako (retry:1 → 2 klica)
    click(findButton(container, '7 dni')!)
    await flush(4)
    expect(container.textContent).toContain('Napaka pri nalaganju analitike')
    expect(container.textContent).toContain('Napaka pri izračunu analitike')
    expect(toastErrorMock).toHaveBeenCalledWith('Napaka pri izračunu analitike')

    // retry: responder popravljen → refetch uspešen, napaka izgine
    overviewResponder = (url) => {
      const u = new URL(url, 'http://localhost')
      return jsonResponse(overviewFixture(u.searchParams.get('start') ?? '', u.searchParams.get('end') ?? ''))
    }
    click(findButton(container, 'Poskusi znova')!)
    await flush(4)
    expect(container.textContent).toContain('12.345,67 €')
    expect(container.querySelector('[data-chart="BarChart"]')).not.toBeNull()
  })

  it('403 NO_LOCATION_MESSAGE: toast.error s TOČNO body.error sporočilom (passthrough), Alert izpiše isto', async () => {
    const container = await mountModule('manager')
    overviewResponder = () => errorResponse(403, NO_LOCATION_MESSAGE)
    click(findButton(container, '7 dni')!)
    await flush(4)
    expect(toastErrorMock).toHaveBeenCalledWith(NO_LOCATION_MESSAGE)
    expect(toastErrorMock).toHaveBeenCalledTimes(1) // retry:1 → error settle → EN toast
    expect(container.textContent).toContain(NO_LOCATION_MESSAGE)
  })

  it('prazno stanje (kpis.orders === 0): "Ni podatkov za izbrano obdobje", brez grafov', async () => {
    const container = await mountModule('manager')
    overviewResponder = (url) => {
      const u = new URL(url, 'http://localhost')
      return jsonResponse(emptyOverviewFixture(u.searchParams.get('start') ?? '', u.searchParams.get('end') ?? ''))
    }
    click(findButton(container, '7 dni')!)
    await flush(4)
    expect(container.textContent).toContain('Ni podatkov za izbrano obdobje')
    expect(container.querySelector('[data-chart="BarChart"]')).toBeNull()
    expect(container.querySelector('[data-testid="analytics-hourly-cell"]')).toBeNull()
  })

  it('skeleton med nalaganjem: aria-busy + aria-label (prvi render pred flushom)', async () => {
    routeApi()
    authFetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input)
      if (url === '/api/locations') return jsonResponse(LOCATIONS)
      if (url.startsWith('/api/analytics/overview?')) {
        await new Promise((resolve) => setTimeout(resolve, 15))
        return jsonResponse(overviewFixture('2026-01-01', '2026-01-30'))
      }
      throw new Error(`Nepričakovan klic: ${url}`)
    })
    getCurrentUserMock.mockReturnValue(authUserWithRole('admin'))
    const container = mountWithProviders(createElement(AdvancedAnalyticsModule))
    const busy = container.querySelector('[aria-busy="true"]')
    expect(busy).not.toBeNull()
    expect(busy!.getAttribute('aria-label')).toBe('Analitika se nalaga')
    await flush(10)
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
  })
})

// ============================================
// F) Pure helperji + query keys
// ============================================

describe('Pure helperji + query keys (R149-c)', () => {
  it('buildOverviewUrl: brez lokacije / prazen string / null → URL brez locationId', () => {
    const base = '/api/analytics/overview?start=2026-01-01&end=2026-01-07&granularity=day'
    expect(buildOverviewUrl('2026-01-01', '2026-01-07', 'day')).toBe(base)
    expect(buildOverviewUrl('2026-01-01', '2026-01-07', 'day', '')).toBe(base)
    expect(buildOverviewUrl('2026-01-01', '2026-01-07', 'day', null)).toBe(base)
  })

  it('buildOverviewUrl: lokacija → &locationId= z encodeURIComponent (posebni znaki)', () => {
    expect(buildOverviewUrl('2026-01-01', '2026-01-07', 'week', 'loc-b 2&3')).toBe(
      '/api/analytics/overview?start=2026-01-01&end=2026-01-07&granularity=week&locationId=loc-b%202%263',
    )
  })

  it('shiftDateStr: DST-varen koledarski subtract/add (mesec + leto meja)', () => {
    expect(shiftDateStr('2026-03-15', -6)).toBe('2026-03-09')
    expect(shiftDateStr('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDateStr('2026-01-01', -1)).toBe('2025-12-31')
    expect(shiftDateStr('2024-02-28', 1)).toBe('2024-02-29') // prestopno leto
    expect(shiftDateStr('2026-02-28', 1)).toBe('2026-03-01') // neprestopno
  })

  it('analyticsKeys: EN koren [\'analytics\'] + overview(params) tuple oblika', () => {
    expect(queryKeys.analytics.all).toEqual(['analytics'])
    const params = { start: '2026-01-01', end: '2026-01-07', granularity: 'day', locationId: null }
    expect(queryKeys.analytics.overview(params)).toEqual(['analytics', 'overview', params])
    expect(queryKeys.analytics.overview()).toEqual(['analytics', 'overview', null])
  })
})

// ============================================
// G) fs-pini — registracija modula
// ============================================

describe('Registracija modula (fs-pin, R149-c)', () => {
  it('register: vnos advanced-analytics v \'analytics\' grupi (za reports), permission view_reports, NI adminOnly', () => {
    // R174 IA: pin prenesen z navItems (deriviran) na register (vir resnice)
    const meta = MODULE_REGISTRY.find((m) => m.id === 'advanced-analytics')
    expect(meta, 'register vnos advanced-analytics').toBeDefined()
    expect(meta?.labelKey).toBe('nav.advancedAnalytics')
    expect(meta?.icon).toBe('TrendingUp')
    expect(meta?.permission).toBe('view_reports')
    expect(meta?.adminOnly).toBeUndefined()
    // 'analytics' grupa: takoj za 'reports' (kontrakt R149-a; R174 groupOrder sodba)
    const analyticsIds = navGroups.find((g) => g.id === 'analytics')?.itemIds ?? []
    expect(analyticsIds.indexOf('advanced-analytics')).toBe(analyticsIds.indexOf('reports') + 1)
  })

  it('module-registry: dynamic import (ssr:false + loadingFallback) + map vnos', () => {
    const registrySrc = readFileSync(join(process.cwd(), 'src', 'app', 'components', 'module-registry.tsx'), 'utf8')
    expect(registrySrc).toContain("'advanced-analytics': AdvancedAnalyticsModule,")
    expect(registrySrc).toContain("import('@/components/pos/analytics/AdvancedAnalyticsModule')")
    const dynamicLine = registrySrc.split('\n').find((l) => l.includes("import('@/components/pos/analytics/AdvancedAnalyticsModule')"))
    expect(dynamicLine).toContain('ssr: false')
    expect(dynamicLine).toContain('loadingFallback')
  })

  it('i18n: nav.advancedAnalytics v vseh 5 jezikih (navigation/*.ts kanon — messages sloj izbrisan R167)', () => {
    const translations: Array<[string, string]> = [
      ['sl', 'Napredna analitika'],
      ['en', 'Advanced analytics'],
      ['de', 'Erweiterte Analysen'],
      ['hr', 'Napredna analitika'],
      ['it', 'Analisi avanzata'],
    ]
    for (const [lang, translation] of translations) {
      const navSrc = readFileSync(join(process.cwd(), 'src', 'lib', 'i18n', 'navigation', `${lang}.ts`), 'utf8')
      expect(navSrc, `nav.advancedAnalytics manjka v navigation/${lang}.ts`).toContain(`'nav.advancedAnalytics': '${translation}'`)
    }
  })

  it('query-keys barrel: analytics import + vnos (R149-b že final — regresijski pin)', () => {
    const barrelSrc = readFileSync(join(process.cwd(), 'src', 'lib', 'query-keys', 'index.ts'), 'utf8')
    expect(barrelSrc).toContain("import { analyticsKeys } from './analytics'")
    expect(barrelSrc).toContain('analytics: analyticsKeys')
    const analyticsSrc = readFileSync(join(process.cwd(), 'src', 'lib', 'query-keys', 'analytics.ts'), 'utf8')
    expect(analyticsSrc).toContain("all: ['analytics'] as const")
    expect(analyticsSrc).toContain('overview:')
  })

  it('komponenta: brez blue/indigo, brez grid-cols-14, empty state + (neimenovan) + form-locations queryKey na disku', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'components', 'pos', 'analytics', 'AdvancedAnalyticsModule.tsx'), 'utf8')
    // BUG-04 hišno pravilo: NIKOLI modri/indigo akcenti; R146-final: brez grid-cols-14
    expect(src).not.toMatch(/blue-|indigo-/)
    expect(src).not.toContain('grid-cols-14')
    // kontrakt besedila
    expect(src).toContain('Ni podatkov za izbrano obdobje')
    expect(src).toContain('(neimenovan)')
    expect(src).toContain('Poskusi znova')
    // MODEL A form-locations queryKey (domenski koren ['analytics'])
    expect(src).toContain("queryKey: ['analytics', 'form-locations']")
    // aria kanon
    expect(src).toContain('aria-label="Izbira lokacije za analitiko"')
    expect(src).toContain('aria-busy="true"')
  })
})
