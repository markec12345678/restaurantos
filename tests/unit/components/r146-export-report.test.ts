// ============================================
// R146-c (epic #115 #33 Accounting exports) — UI: 6 novih računovodskih
// izvozov (payments/refunds/purchases/expenses/daily-close/journal — samo
// CSV) + MODEL A lokacijski select za skrbnike
//
// Pokritost (r145-tip-payout/r144-gift-card-liability hišni stil):
//   A) konfiguracija:
//      - EXPORT_TYPES: 6 novih tipov z nativnimi SI imeni, formats ['csv']
//      - obstoječi 6 tipov NESPREMENJENI (orders/items/vat/employees/shifts/
//        inventory z obstoječimi formati)
//      - fs-pin: vrstice novih tipov na disku NISO povezane z pdf/excel/xml/
//        ubl; queryKey ['reports','form-locations'] + 'Vse lokacije
//        (globalno)' na disku; ni blue-/indigo- razredov
//   B) buildExportUrl (pure): locationId SAMO ko izbran (prazen = globalno);
//      posebni znaki → encodeURIComponent
//   C) MODEL A: admin ('admin'/'super_admin') vidi Lokacija select + fetch
//      /api/locations; manager/waiter NE (enabled: isTenantAdmin); prazen
//      seznam → select viden NI (pariteta NewCardDialog); neaktivna lokacija
//      disabled + ' (neaktivna)' suffix
//   D) download tok: brez lokacije → URL BREZ ?locationId, odziv v blob,
//      toast uspeha; novi tip → type=payments&format=csv; izbrana lokacija →
//      URL vsebuje encodeURIComponent(locId); napaka → toast.error s
//      strežnikovim sporočilom (body.error passthrough); PII iz locations
//      odgovora NIKOLI v izrisu
//
// Tehnične opombe (r96/r142/r143/r144/r145 kanon):
//   - unit-vm pool = vmThreads + jsdom; @testing-library NI v devDeps →
//     createRoot + act (IS_REACT_ACT_ENVIRONMENT).
//   - '@/components/pos/PinLogin' = CELOTEN mock (authFetch + getCurrentUser);
//     getCurrentUser kontrolira vlogo (useAuthUser bere iz njega).
//   - Radix Select 2.x: popper potrebuje ResizeObserver + scrollIntoView
//     (jsdom ju nima → stub); odpiranje prek KeyboardEvent('ArrowDown') na
//     triggerju, izbira prek KeyboardEvent('Enter') na [role="option"]
//     (pointer pot v jsdom nima pointerType → keyboard pot je zanesljiva).
//   - URL.createObjectURL/revokeObjectURL: jsdom ju ne implementira →
//     per-test stub (definirani descriptor se obnovi v afterEach).
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

import { authFetch, getCurrentUser } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import {
  ExportReport,
  EXPORT_TYPES,
  ALL_LOCATIONS_VALUE,
  buildExportUrl,
} from '@/components/pos/reports/ExportReport'
import type { AuthUser } from '@/components/pos/pin-login/constants'

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
// Fixture — vloge (AuthUser kontrakt iz pin-login/constants)
// ============================================

const AUTH_USER_BASE = {
  id: 'emp-r146',
  name: 'Ana Testna',
  email: 'ana.testna@restavracija.si',
  primaryJob: null,
  permissions: [] as string[],
}

function authUserWithRole(role: string): AuthUser {
  return { ...AUTH_USER_BASE, role } as AuthUser
}

// --- Fixture — GET /api/locations (hook išče samo id/name/isActive) ---
// 'loc-b 2&3' vsebuje posebne znake → asertira encodeURIComponent na URL-ju.
const LOCATIONS = [
  { id: 'loc-a', name: 'Gostilna Štefan', isActive: true },
  { id: 'loc-b 2&3', name: 'Bistro Mestna', isActive: true },
  { id: 'loc-c', name: 'Zaprta poslovalnica', isActive: false },
]

const CSV_BLOB = new Blob(['Datum;Metoda;Znesek (EUR)\n2026-03-15;Gotovina;100,00'], { type: 'text/csv' })

function jsonResponse(payload: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => payload } as unknown as Response
}

// blob prek vi.fn → test asertira, da UI odziv res konsumira kot blob (download kanon)
let blobSpy: ReturnType<typeof vi.fn> = vi.fn(async () => CSV_BLOB)
let exportFixture: Response = jsonResponse({}, 200)

function csvResponse(): Response {
  return { ok: true, status: 200, blob: blobSpy, json: async () => ({}) } as unknown as Response
}

/** Router: GET /api/locations + GET /api/reports/export?* (fixture povožljiv). */
function routeApi(locationsPayload: unknown = LOCATIONS): void {
  exportFixture = csvResponse()
  authFetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : String(input)
    if (url === '/api/locations') return jsonResponse(locationsPayload)
    if (url.startsWith('/api/reports/export?')) return exportFixture
    throw new Error(`Nepričakovan klic: ${url}`)
  })
}

// --- Render helperji (brez @testing-library — house minimalen pristop) ---
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

function click(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

/** Flush: react-query microtask verige + setTimeout(0). */
async function flush(rounds = 2): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
  }
}

async function mountExportReport(): Promise<HTMLElement> {
  const container = mountWithProviders(createElement(ExportReport))
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

// --- Radix Select pomočniki (keyboard pot — glej tehnične opombe) ---
function openLocationSelect(container: HTMLElement): void {
  const trigger = container.querySelector('[data-slot="select-trigger"]') as HTMLElement
  act(() => {
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
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

// --- URL.createObjectURL stub (jsdom ne implementira) ---
let originalCreateObjectURL: PropertyDescriptor | undefined
let originalRevokeObjectURL: PropertyDescriptor | undefined
const createObjectURLMock = vi.fn(() => 'blob:mock-url')
const revokeObjectURLMock = vi.fn()

beforeEach(() => {
  authFetchMock.mockReset()
  getCurrentUserMock.mockReset()
  getCurrentUserMock.mockReturnValue(null)
  toastSuccessMock.mockClear()
  toastErrorMock.mockClear()
  blobSpy = vi.fn(async () => CSV_BLOB)
  originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
  originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURLMock, configurable: true, writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURLMock, configurable: true, writable: true })
  createObjectURLMock.mockClear()
  revokeObjectURLMock.mockClear()
})

afterEach(() => {
  if (originalCreateObjectURL) Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL)
  else delete (URL as unknown as Record<string, unknown>).createObjectURL
  if (originalRevokeObjectURL) Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectURL)
  else delete (URL as unknown as Record<string, unknown>).revokeObjectURL
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
// A) Konfiguracija novih tipov
// ============================================

/** Novi računovodski tipi (kontrakt R146-c): [value, SI label]. */
const NEW_TYPES: Array<[string, string]> = [
  ['payments', 'Plačila'],
  ['refunds', 'Povračila'],
  ['purchases', 'Nabava'],
  ['expenses', 'Stroški'],
  ['daily-close', 'Dnevni zaključek'],
  ['journal', 'Dnevnik'],
]

/** Obstoječi tipi s formati PRED R146-c (regresijski pin — nespremenjeni). */
const EXISTING_TYPES: Array<[string, string[]]> = [
  ['orders', ['csv', 'pdf', 'excel']],
  ['items', ['csv', 'pdf', 'excel']],
  ['vat', ['csv', 'pdf', 'excel', 'xml']],
  ['employees', ['csv', 'pdf', 'excel']],
  ['shifts', ['csv', 'pdf', 'excel']],
  ['inventory', ['csv', 'pdf', 'excel']],
]

describe('EXPORT_TYPES konfiguracija (R146-c)', () => {
  it('vsebuje 6 novih računovodskih tipov z nativnimi SI imeni', () => {
    expect(EXPORT_TYPES).toHaveLength(12)
    for (const [value, label] of NEW_TYPES) {
      const cfg = EXPORT_TYPES.find((t) => t.value === value)
      expect(cfg, `manjka tip ${value}`).toBeDefined()
      expect(cfg!.label).toBe(label)
      expect(cfg!.description.length).toBeGreaterThan(0)
    }
  })

  it('novi tipi imajo formats točno ["csv"]; obstoječi 6 tipov ohranijo obstoječe formate', () => {
    for (const [value] of NEW_TYPES) {
      expect(EXPORT_TYPES.find((t) => t.value === value)!.formats).toEqual(['csv'])
    }
    for (const [value, formats] of EXISTING_TYPES) {
      expect(EXPORT_TYPES.find((t) => t.value === value)!.formats).toEqual(formats)
    }
  })

  it('fs-pin: novi tipi na disku samo-csv (brez pdf/excel/xml/ubl); queryKey + globalna opcija + brez blue/indigo', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'components', 'pos', 'reports', 'ExportReport.tsx'), 'utf8')
    for (const [value] of NEW_TYPES) {
      const line = src.split('\n').find((l) => l.includes(`value: '${value}'`))
      expect(line, `vrstica tipa ${value} NI na disku`).toBeDefined()
      expect(line).toMatch(/formats: \['csv'\]/)
      // novi tipi NISO povezani z pdf/excel/xml/ubl (R146-b: format≠csv → 400)
      expect(line).not.toMatch(/pdf|excel|xml|ubl/)
    }
    // MODEL A: queryKey ['reports','form-locations'] + globalna opcija na disku
    expect(src).toContain("queryKey: ['reports', 'form-locations']")
    expect(src).toContain('Vse lokacije (globalno)')
    // BUG-04 hišno pravilo: NIKOLI modri/indigo akcenti
    expect(src).not.toMatch(/blue-|indigo-/)
  })
})

// ============================================
// B) buildExportUrl (pure helper)
// ============================================

describe('buildExportUrl (R146-c MODEL A)', () => {
  it('brez lokacije / prazen string / null → URL BREZ locationId', () => {
    const base = '/api/reports/export?type=orders&format=csv&startDate=2026-01-01&endDate=2026-01-31'
    expect(buildExportUrl('orders', 'csv', '2026-01-01', '2026-01-31')).toBe(base)
    expect(buildExportUrl('orders', 'csv', '2026-01-01', '2026-01-31', '')).toBe(base)
    expect(buildExportUrl('orders', 'csv', '2026-01-01', '2026-01-31', null)).toBe(base)
  })

  it('z lokacijo → &locationId= z encodeURIComponent (posebni znaki)', () => {
    expect(buildExportUrl('payments', 'csv', '2026-01-01', '2026-01-31', 'loc-b 2&3')).toBe(
      '/api/reports/export?type=payments&format=csv&startDate=2026-01-01&endDate=2026-01-31&locationId=loc-b%202%263',
    )
  })
})

// ============================================
// C) MODEL A lokacijski select (vidnost po vlogi)
// ============================================

describe('MODEL A lokacijski select (R146-c)', () => {
  it.each(['super_admin', 'admin'])('skrbnik (%s) vidi Lokacija select in naloži /api/locations', async (role) => {
    getCurrentUserMock.mockReturnValue(authUserWithRole(role))
    routeApi()
    const container = await mountExportReport()
    expect(container.querySelector('[data-slot="select-trigger"]')).not.toBeNull()
    expect(container.textContent).toContain('Lokacija')
    expect(container.textContent).toContain('Vse lokacije (globalno)')
    expect(container.textContent).toContain('Izberite lokacijo za izvoz po posamezni poslovalnici')
    const locationCalls = authFetchMock.mock.calls.filter(([url]) => String(url) === '/api/locations')
    expect(locationCalls.length).toBeGreaterThanOrEqual(1)
  })

  it.each(['manager', 'waiter'])('ne-skrbnik (%s) NE vidi selecta in NE kliče /api/locations (enabled: false)', async (role) => {
    getCurrentUserMock.mockReturnValue(authUserWithRole(role))
    routeApi()
    const container = await mountExportReport()
    expect(container.querySelector('[data-slot="select-trigger"]')).toBeNull()
    expect(container.textContent).not.toContain('Vse lokacije (globalno)')
    expect(container.textContent).not.toContain('Izberite lokacijo za izvoz')
    expect(authFetchMock.mock.calls).toHaveLength(0)
  })

  it('admin + prazen seznam lokacij → select viden NI (pariteta NewCardDialog)', async () => {
    getCurrentUserMock.mockReturnValue(authUserWithRole('super_admin'))
    routeApi([])
    const container = await mountExportReport()
    expect(container.querySelector('[data-slot="select-trigger"]')).toBeNull()
    expect(container.textContent).not.toContain('Vse lokacije (globalno)')
  })

  it('odprti select: aktivni lokaciji omogočeni, neaktivna disabled z " (neaktivna)" suffixom', async () => {
    getCurrentUserMock.mockReturnValue(authUserWithRole('admin'))
    routeApi()
    const container = await mountExportReport()
    openLocationSelect(container)
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
})

// ============================================
// D) Download tok (obstoječi blob mehanizem + MODEL A param)
// ============================================

describe('ExportReport download tok (R146-c)', () => {
  it('srečna pot (globalno): URL brez locationId, odziv konzumiran v blob, toast uspeha', async () => {
    routeApi()
    const container = await mountExportReport()

    click(findButton(container, 'Prenesi')!)
    await flush(3)

    const exportCalls = authFetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/reports/export?'))
    expect(exportCalls).toHaveLength(1)
    const callUrl = new URL(String(exportCalls[0][0]), 'http://localhost')
    expect(callUrl.pathname).toBe('/api/reports/export')
    expect(callUrl.searchParams.get('type')).toBe('orders')
    expect(callUrl.searchParams.get('format')).toBe('csv')
    expect(callUrl.searchParams.get('startDate')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(callUrl.searchParams.get('endDate')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(callUrl.searchParams.has('locationId')).toBe(false)

    // download mehanika: odziv podan v blob → objectURL → revoke
    expect(blobSpy).toHaveBeenCalledTimes(1)
    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1)
    expect(toastSuccessMock).toHaveBeenCalledWith('Poročilo izvoženo v CSV formatu')
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it('novi tip (Plačila): download sproži authFetch type=payments&format=csv; ostali formati disabled', async () => {
    routeApi()
    const container = await mountExportReport()

    click(findButton(container, 'Plačila')!)
    await flush()

    // format kartice: samo CSV na voljo (PDF/Excel/XML disabled za novi tip)
    // ('Excel (XLSX)' točen label — CSV opis 'Excel/Google Sheets' bi ga ujel prej)
    expect(findButton(container, 'PDF')!.disabled).toBe(true)
    expect(findButton(container, 'Excel (XLSX)')!.disabled).toBe(true)
    expect(findButton(container, 'eDavki XML')!.disabled).toBe(true)
    expect(findButton(container, 'CSV')!.disabled).toBe(false)

    click(findButton(container, 'Prenesi')!)
    await flush(3)

    const exportCalls = authFetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/reports/export?'))
    expect(exportCalls).toHaveLength(1)
    const callUrl = new URL(String(exportCalls[0][0]), 'http://localhost')
    expect(callUrl.searchParams.get('type')).toBe('payments')
    expect(callUrl.searchParams.get('format')).toBe('csv')
    expect(toastSuccessMock).toHaveBeenCalledTimes(1)
  })

  it('MODEL A tok: privzeto brez locationId; izbrana lokacija → URL z encodeURIComponent; nazaj na "Vse lokacije" → spet brez', async () => {
    getCurrentUserMock.mockReturnValue(authUserWithRole('super_admin'))
    routeApi()
    const container = await mountExportReport()

    // 1. privzeto ('all' sentinel) → brez parametra
    click(findButton(container, 'Prenesi')!)
    await flush(3)
    let exportCalls = authFetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/reports/export?'))
    expect(exportCalls).toHaveLength(1)
    expect(new URL(String(exportCalls[0][0]), 'http://localhost').searchParams.has('locationId')).toBe(false)

    // 2. izberi 'Bistro Mestna' (id 'loc-b 2&3' → encoded)
    openLocationSelect(container)
    await flush(2)
    pickOption('Bistro Mestna')
    await flush(2)
    expect(container.querySelector('[data-slot="select-trigger"]')?.textContent).toContain('Bistro Mestna')

    click(findButton(container, 'Prenesi')!)
    await flush(3)
    exportCalls = authFetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/reports/export?'))
    expect(exportCalls).toHaveLength(2)
    const rawUrl = String(exportCalls[1][0])
    expect(rawUrl).toContain('locationId=loc-b%202%263')
    expect(new URL(rawUrl, 'http://localhost').searchParams.get('locationId')).toBe('loc-b 2&3')

    // 3. nazaj na 'Vse lokacije (globalno)' → spet brez parametra
    openLocationSelect(container)
    await flush(2)
    pickOption('Vse lokacije (globalno)')
    await flush(2)
    click(findButton(container, 'Prenesi')!)
    await flush(3)
    exportCalls = authFetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/reports/export?'))
    expect(exportCalls).toHaveLength(3)
    expect(new URL(String(exportCalls[2][0]), 'http://localhost').searchParams.has('locationId')).toBe(false)
  })

  it('napaka 400 ("Neznan format. Dovoljeni: csv"): toast.error s strežnikovim sporočilom, brez uspešnega toasta in brez bloba', async () => {
    getCurrentUserMock.mockReturnValue(authUserWithRole('super_admin'))
    routeApi()
    exportFixture = {
      ok: false,
      status: 400,
      json: async () => ({ error: 'Neznan format. Dovoljeni: csv' }),
    } as unknown as Response
    const container = await mountExportReport()

    click(findButton(container, 'Plačila')!)
    await flush()
    click(findButton(container, 'Prenesi')!)
    await flush(3)

    expect(toastErrorMock).toHaveBeenCalledWith('Neznan format. Dovoljeni: csv')
    expect(toastSuccessMock).not.toHaveBeenCalled()
    expect(blobSpy).not.toHaveBeenCalled()
    expect(createObjectURLMock).not.toHaveBeenCalled()
  })

  it('PII kanon: sumljivi ključi v /api/locations odgovoru NIKOLI v izrisu (hook preslika samo id/name/isActive)', async () => {
    getCurrentUserMock.mockReturnValue(authUserWithRole('super_admin'))
    routeApi([
      { id: 'loc-a', name: 'Gostilna Štefan', isActive: true, ownerEmail: 'lastnik@nevarno.si', contactPhone: '+386 40 999 888', cardNumber: 'GC-SECRET-1234' },
      { id: 'loc-b', name: 'Bistro Mestna', isActive: true, ownerEmail: 'bistro@nevarno.si' },
    ])
    const container = await mountExportReport()
    openLocationSelect(container)
    await flush(2)
    const text = (container.textContent ?? '') + (document.body.textContent ?? '')
    expect(text).toContain('Gostilna Štefan')
    expect(text).toContain('Bistro Mestna')
    expect(text).not.toContain('lastnik@nevarno.si')
    expect(text).not.toContain('bistro@nevarno.si')
    expect(text).not.toContain('@nevarno.si')
    expect(text).not.toContain('+386 40 999 888')
    expect(text).not.toContain('GC-SECRET-1234')
  })
})
