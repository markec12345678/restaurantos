// ============================================
// R147-c (epic #115 #34 Data portability) — UI: DataPortabilityModule +
// registracija (navItems/module-registry/i18n/query-keys)
//
// Pokritost (r146-export-report hišni kanon):
//   A) statika: header 'Prenos podatkov' + intro ('Kaj je vključeno') +
//      izključitvena opomba (skrivnosti/PII — pin besedila)
//   B) parity sekcij: PORTABILITY_UI_SECTIONS == PORTABILITY_SECTIONS
//      (server konstanta — test konzumira izvoz iz _helpers); števila tabel
//      in records iz MOCK MANIFEST (realna R147-b shape — counts-only)
//   C) MODEL A: admin/super_admin vidi Lokacija select + /api/locations;
//      manager/waiter ne; 'all' → manifest URL BREZ locationId, izbrana
//      lokacija → encodeURIComponent(locId)
//   D) query-key unifikacija: portabilityKeys (EN koren ['portability']) +
//      fs-pin ['portability','form-locations'] v komponenti
//   E) checksum: countsChecksum (64 hex) prikazan; Kopiraj → clipboard +
//      toast 'Natočnica kopirana'
//   F) download: mode=full/manifest → blob path (createObjectURL stub) +
//      toast 'Prenos pripravljen'; napaka → toast.error s TOČNO body.error
//      (403 NO_LOCATION_MESSAGE iz tenant-scope.ts; 400 neznan način)
//   G) fs-pin: navItems vnos (adminOnly), SISTEM skupina, module-registry,
//      i18n vseh 5 jezikov, query-keys barrel, brez blue/indigo +
//      brez grid-cols-14 (R146-final lekcija), UI ne uvaža server helperja
//      (samo import type — client bundle smešen)
//
// Tehnične opombe (r96/r142/r143/r144/r145/r146 kanon):
//   - unit-vm pool = vmThreads + jsdom; @testing-library NI v devDeps →
//     createRoot + act (IS_REACT_ACT_ENVIRONMENT).
//   - '@/components/pos/PinLogin' = CELOTEN mock (authFetch + getCurrentUser);
//     getCurrentUser kontrolira vlogo (useAuthUser bere iz njega).
//   - Radix Select 2.x: popper potrebuje ResizeObserver + scrollIntoView
//     (jsdom ju nima → stub); odpiranje prek KeyboardEvent('ArrowDown'),
//     izbira prek KeyboardEvent('Enter') na [role="option"].
//   - URL.createObjectURL/revokeObjectURL: jsdom ju ne implementira →
//     per-test stub (descriptor se obnovi v afterEach).
//   - '@/lib/db' je globalno mockan v tests/setup.ts → parity import
//     _helpers/portability-sections (vleče db) je v testih varen.
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
  DataPortabilityModule,
  ALL_LOCATIONS_VALUE,
  PORTABILITY_UI_SECTIONS,
  buildPortabilityUrl,
  filenameFromDisposition,
} from '@/components/pos/portability/DataPortabilityModule'
import { portabilityKeys } from '@/lib/query-keys/portability'
import {
  PORTABILITY_SECTIONS,
  PORTABILITY_NOTES,
  PORTABILITY_TABLES,
} from '@/app/api/export/portability/_helpers/portability-sections'
import { NO_LOCATION_MESSAGE } from '@/lib/tenant-scope'
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
// Fixture — vloge + lokacije + manifest (realna R147-b shape)
// ============================================

const AUTH_USER_BASE = {
  id: 'emp-r147',
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

/** Manifest counts — REALNA shape iz R147-b route.ts (counts-only, 5 sekcij). */
const MANIFEST_COUNTS: Record<string, Record<string, number>> = {
  customers: { Guest: 12, GuestVisit: 20, LoyaltyAccount: 8, LoyaltyTransaction: 30, Reservation: 15, WaitlistEntry: 5, GuestFeedback: 10 },
  menu: { Menu: 2, Category: 6, MenuItem: 40, ModifierGroup: 4, Modifier: 12, TaxRate: 3 },
  recipes: { RecipeItem: 25 },
  inventory: { InventoryItem: 18, StockTransaction: 60 },
  audit: { AuditLog: 100 },
}
// 12+20+8+30+15+5+10 + 2+6+40+4+12+3 + 25 + 18+60 + 100 = 370 zapisov / 17 tabel
const MANIFEST_TOTAL = 370

const MANIFEST = {
  format: 'restaurantos-portability',
  version: 1,
  generatedAt: '2026-03-15T10:00:00.000Z',
  schemaStamp: 'a'.repeat(64),
  scope: { locationId: null, locationName: null },
  counts: MANIFEST_COUNTS,
  countsChecksum: 'b'.repeat(64),
  checksum: '',
  notes: PORTABILITY_NOTES,
}

/** Prazni manifest: iste tabele (iz server konstante), vsi števci 0. */
const ZERO_MANIFEST = {
  ...MANIFEST,
  counts: Object.fromEntries(
    PORTABILITY_SECTIONS.map((section) => [
      section,
      Object.fromEntries(
        PORTABILITY_TABLES.filter((t) => t.section === section).map((t) => [t.model, 0]),
      ),
    ]),
  ) as Record<string, Record<string, number>>,
}

const FULL_DISPOSITION = 'attachment; filename="prenos-podatkov-20260315-100000.json"'

function jsonResponse(payload: unknown, status = 200): Response {
  const body = JSON.stringify(payload)
  return {
    ok: status < 400,
    status,
    json: async () => payload,
    blob: async () => new Blob([body], { type: 'application/json' }),
    headers: { get: () => null },
  } as unknown as Response
}

// blob prek vi.fn → test asertira, da UI odziv res konzumira kot blob (download kanon)
let blobSpy: ReturnType<typeof vi.fn> = vi.fn(async () => new Blob(['{}']))
let manifestFixture: Response = jsonResponse(MANIFEST)
let fullFixture: Response = jsonResponse(MANIFEST)

/** Router: GET /api/locations + GET /api/export/portability?mode=… (fixture povožljiv). */
function routeApi(locationsPayload: unknown = LOCATIONS): void {
  manifestFixture = jsonResponse(MANIFEST)
  blobSpy = vi.fn(async () => new Blob(['{}']))
  fullFixture = {
    ok: true,
    status: 200,
    json: async () => MANIFEST,
    blob: blobSpy,
    headers: { get: (key: string) => (key === 'Content-Disposition' ? FULL_DISPOSITION : null) },
  } as unknown as Response
  authFetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : String(input)
    if (url === '/api/locations') return jsonResponse(locationsPayload)
    if (url.includes('mode=manifest')) return manifestFixture
    if (url.includes('mode=full')) return fullFixture
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

async function mountDataPortability(): Promise<HTMLElement> {
  const container = mountWithProviders(createElement(DataPortabilityModule))
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

function manifestCalls(): string[] {
  return authFetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.includes('mode=manifest'))
}

function fullCalls(): string[] {
  return authFetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.includes('mode=full'))
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

// --- URL.createObjectURL stub (jsdom ne implementira) + clipboard stub ---
let originalCreateObjectURL: PropertyDescriptor | undefined
let originalRevokeObjectURL: PropertyDescriptor | undefined
const createObjectURLMock = vi.fn(() => 'blob:mock-url')
const revokeObjectURLMock = vi.fn()
const writeTextMock = vi.fn(async () => undefined)

beforeEach(() => {
  authFetchMock.mockReset()
  getCurrentUserMock.mockReset()
  getCurrentUserMock.mockReturnValue(null)
  toastSuccessMock.mockClear()
  toastErrorMock.mockClear()
  blobSpy = vi.fn(async () => new Blob(['{}']))
  originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
  originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURLMock, configurable: true, writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURLMock, configurable: true, writable: true })
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: writeTextMock }, configurable: true })
  createObjectURLMock.mockClear()
  revokeObjectURLMock.mockClear()
  writeTextMock.mockClear()
})

afterEach(() => {
  if (originalCreateObjectURL) Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL)
  else delete (URL as unknown as Record<string, unknown>).createObjectURL
  if (originalRevokeObjectURL) Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectURL)
  else delete (URL as unknown as Record<string, unknown>).revokeObjectURL
  delete (navigator as unknown as Record<string, unknown>).clipboard
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
// A) Statika + manifest KPI
// ============================================

describe('DataPortabilityModule statika + manifest KPI (R147-c)', () => {
  it('izriše header, intro sekcije in izključitveno opombo (pin besedil)', async () => {
    getCurrentUserMock.mockReturnValue(authUserWithRole('admin'))
    routeApi()
    const container = await mountDataPortability()

    expect(container.textContent).toContain('Prenos podatkov')
    expect(container.textContent).toContain('Izvoz svojih podatkov v preverljivem JSON formatu (tenant-scoped)')
    expect(container.textContent).toContain('Kaj je vključeno')
    // izključitvena opomba (statična, PII/skrivnosti — sme omenjati PIN-i)
    expect(container.textContent).toContain(
      'Ni vključeno: gesla in PIN-i, seje, API ključi, biometrija, skrivne nastavitve, IP naslovi v revizijski sledi.',
    )
    // cross-referenci (epic #33 + GDPR Art. 15)
    expect(container.textContent).toContain('Poročila → Izvoz')
    expect(container.textContent).toContain('/api/gdpr/export/[id]')
  })

  it('parity: PORTABILITY_UI_SECTIONS == PORTABILITY_SECTIONS; 5 sekcij z številom tabel iz manifesta', async () => {
    // parity proti server konstanti (test konzumira izvoz iz _helpers — R147-b)
    expect([...PORTABILITY_UI_SECTIONS]).toEqual([...PORTABILITY_SECTIONS])
    getCurrentUserMock.mockReturnValue(authUserWithRole('admin'))
    routeApi()
    const container = await mountDataPortability()

    const text = container.textContent ?? ''
    expect(text).toContain('Stranke & zvestoba')
    expect(text).toContain('Meni & cene')
    expect(text).toContain('Recepture')
    expect(text).toContain('Zaloga & premiki')
    expect(text).toContain('Revizijska sled')
    // 'N tabel' izvirajo iz mock manifest counts (7/6/1/2/1 tabel) — slovensko sklanjanje
    expect(text).toContain('7 tabel')
    expect(text).toContain('6 tabel')
    expect(text).toContain('1 tabela')
    expect(text).toContain('2 tabeli')
  })

  it('manifest success → KPI counts izrisani (per sekcija + skupno "zapisov skupaj")', async () => {
    getCurrentUserMock.mockReturnValue(authUserWithRole('admin'))
    routeApi()
    const container = await mountDataPortability()

    const text = container.textContent ?? ''
    expect(text).toContain(String(MANIFEST_TOTAL))
    expect(text).toContain('zapisov skupaj')
    expect(text).toContain('17 tabel')
    // per-sekcija counts iz mock manifesta (customers 100, audit 100)
    expect(text).toContain('100')
    // opombe arhiva konzumirane iz manifest.notes (= PORTABILITY_NOTES s strežnika)
    expect(text).toContain(`Opombe arhiva (${PORTABILITY_NOTES.length})`)
    for (const note of PORTABILITY_NOTES) {
      expect(text).toContain(note)
    }
  })

  it('prazno stanje: vsi counts 0 → "Ni podatkov za izvoz"', async () => {
    getCurrentUserMock.mockReturnValue(authUserWithRole('admin'))
    routeApi()
    manifestFixture = jsonResponse(ZERO_MANIFEST)
    const container = await mountDataPortability()

    expect(container.textContent).toContain('Ni podatkov za izvoz')
    expect(container.textContent).not.toContain('zapisov skupaj')
  })
})

// ============================================
// B) MODEL A lokacijski select
// ============================================

describe('MODEL A lokacijski select (R147-c)', () => {
  it.each(['super_admin', 'admin'])('skrbnik (%s) vidi Lokacija select in naloži /api/locations', async (role) => {
    getCurrentUserMock.mockReturnValue(authUserWithRole(role))
    routeApi()
    const container = await mountDataPortability()
    expect(container.querySelector('[data-slot="select-trigger"]')).not.toBeNull()
    expect(container.textContent).toContain('Lokacija')
    expect(container.textContent).toContain('Vse lokacije (globalno)')
    const locationCalls = authFetchMock.mock.calls.filter(([url]) => String(url) === '/api/locations')
    expect(locationCalls.length).toBeGreaterThanOrEqual(1)
  })

  it.each(['manager', 'waiter'])('ne-skrbnik (%s) NE vidi selecta, NE kliče /api/locations; manifest 403 → brez crasha', async (role) => {
    getCurrentUserMock.mockReturnValue(authUserWithRole(role))
    routeApi()
    // manager brez lokacije → server 403 NO_LOCATION_MESSAGE (R147-b MODEL A)
    manifestFixture = jsonResponse({ error: NO_LOCATION_MESSAGE }, 403)
    const container = await mountDataPortability()

    expect(container.querySelector('[data-slot="select-trigger"]')).toBeNull()
    expect(authFetchMock.mock.calls.some(([url]) => String(url) === '/api/locations')).toBe(false)
    // error stanje (Alert + retry), NE crash — header ostane izrisan
    expect(container.textContent).toContain('Napaka pri nalaganju manifesta')
    expect(container.textContent).toContain('Prenos podatkov')
  })

  it("select: 'all' privzeto → manifest URL BREZ locationId; izbrana lokacija → encodeURIComponent; nazaj → brez", async () => {
    getCurrentUserMock.mockReturnValue(authUserWithRole('super_admin'))
    routeApi()
    const container = await mountDataPortability()

    // 1. privzeto ('all' sentinel) → manifest brez ?locationId
    expect(manifestCalls()).toHaveLength(1)
    expect(new URL(manifestCalls()[0]!, 'http://localhost').searchParams.has('locationId')).toBe(false)

    // 2. izberi 'Bistro Mestna' (id 'loc-b 2&3' → encoded) — queryKey se spremeni → refetch
    openLocationSelect(container)
    await flush(2)
    pickOption('Bistro Mestna')
    await flush(3)
    expect(container.querySelector('[data-slot="select-trigger"]')?.textContent).toContain('Bistro Mestna')
    expect(manifestCalls()).toHaveLength(2)
    const rawUrl = manifestCalls()[1]!
    expect(rawUrl).toContain('locationId=loc-b%202%263')
    expect(new URL(rawUrl, 'http://localhost').searchParams.get('locationId')).toBe('loc-b 2&3')

    // 3. nazaj na 'Vse lokacije (globalno)' → spet brez parametra
    openLocationSelect(container)
    await flush(2)
    pickOption('Vse lokacije (globalno)')
    await flush(3)
    expect(manifestCalls()).toHaveLength(3)
    expect(new URL(manifestCalls()[2]!, 'http://localhost').searchParams.has('locationId')).toBe(false)
  })
})

// ============================================
// C) URL builder + query keys (unifikacija kanon R145-c)
// ============================================

describe('buildPortabilityUrl + portabilityKeys (R147-c)', () => {
  it('brez lokacije / prazen / null → URL brez locationId; z lokacijo → encodeURIComponent; mode manifest|full', () => {
    expect(buildPortabilityUrl('manifest')).toBe('/api/export/portability?mode=manifest')
    expect(buildPortabilityUrl('manifest', '')).toBe('/api/export/portability?mode=manifest')
    expect(buildPortabilityUrl('manifest', null)).toBe('/api/export/portability?mode=manifest')
    expect(buildPortabilityUrl('manifest', 'loc-a')).toBe('/api/export/portability?mode=manifest&locationId=loc-a')
    expect(buildPortabilityUrl('full', 'loc-b 2&3')).toBe('/api/export/portability?mode=full&locationId=loc-b%202%263')
  })

  it('portabilityKeys: EN koren ["portability"]; manifest(loc) trojček + fs-pin barrel', () => {
    expect(portabilityKeys.all).toEqual(['portability'])
    expect(portabilityKeys.manifest('all')).toEqual(['portability', 'manifest', 'all'])
    expect(portabilityKeys.manifest('loc-a')).toEqual(['portability', 'manifest', 'loc-a'])

    const portabilitySrc = readFileSync(join(process.cwd(), 'src', 'lib', 'query-keys', 'portability.ts'), 'utf8')
    expect(portabilitySrc).toContain("all: ['portability'] as const")
    expect(portabilitySrc).toContain("manifest: (loc: string) => ['portability', 'manifest', loc] as const")
    const barrelSrc = readFileSync(join(process.cwd(), 'src', 'lib', 'query-keys', 'index.ts'), 'utf8')
    expect(barrelSrc).toContain("import { portabilityKeys } from './portability'")
    expect(barrelSrc).toContain('portability: portabilityKeys,')
  })
})

// ============================================
// D) Checksum + Kopiraj
// ============================================

describe('countsChecksum prikaz + kopiranje (R147-c)', () => {
  it('64 hex prikazan (monospace); Kopiraj → clipboard + toast Natočnica kopirana', async () => {
    getCurrentUserMock.mockReturnValue(authUserWithRole('admin'))
    routeApi()
    const container = await mountDataPortability()

    const checksumEl = container.querySelector('[data-testid="portability-counts-checksum"]')
    expect(checksumEl).not.toBeNull()
    expect(checksumEl!.textContent).toMatch(/^[0-9a-f]{64}$/)
    expect(checksumEl!.textContent).toBe(MANIFEST.countsChecksum)

    click(findButton(container, 'Kopiraj')!)
    await flush(2)
    expect(writeTextMock).toHaveBeenCalledWith(MANIFEST.countsChecksum)
    expect(toastSuccessMock).toHaveBeenCalledWith('Natočnica kopirana')
    expect(toastErrorMock).not.toHaveBeenCalled()
  })
})

// ============================================
// E) Download tok
// ============================================

describe('DataPortabilityModule download tok (R147-c)', () => {
  it('full download: authFetch mode=full (privzeto brez locationId), blob path, toast Prenos pripravljen', async () => {
    getCurrentUserMock.mockReturnValue(authUserWithRole('admin'))
    routeApi()
    const container = await mountDataPortability()

    click(findButton(container, 'Prenesi celotne podatke (JSON)')!)
    await flush(3)

    expect(fullCalls()).toHaveLength(1)
    expect(new URL(fullCalls()[0]!, 'http://localhost').searchParams.has('locationId')).toBe(false)
    // download mehanika: odziv podan v blob → objectURL → revoke
    expect(blobSpy).toHaveBeenCalledTimes(1)
    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1)
    expect(toastSuccessMock).toHaveBeenCalledWith('Prenos pripravljen')
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it('MODEL A download: izbrana lokacija → full URL z encodeURIComponent(locationId)', async () => {
    getCurrentUserMock.mockReturnValue(authUserWithRole('super_admin'))
    routeApi()
    const container = await mountDataPortability()

    openLocationSelect(container)
    await flush(2)
    pickOption('Bistro Mestna')
    await flush(3)

    click(findButton(container, 'Prenesi celotne podatke (JSON)')!)
    await flush(3)

    expect(fullCalls()).toHaveLength(1)
    const rawUrl = fullCalls()[0]!
    expect(rawUrl).toContain('locationId=loc-b%202%263')
    expect(new URL(rawUrl, 'http://localhost').searchParams.get('locationId')).toBe('loc-b 2&3')
  })

  it('manifest download: mode=manifest (poleg manifest poizvedbe) + toast uspeha', async () => {
    getCurrentUserMock.mockReturnValue(authUserWithRole('admin'))
    routeApi()
    const container = await mountDataPortability()

    expect(manifestCalls()).toHaveLength(1) // samo query
    // download konzumira blob — fixture s spy (query porabi json, download blob)
    manifestFixture = {
      ok: true,
      status: 200,
      json: async () => MANIFEST,
      blob: blobSpy,
      headers: { get: () => null },
    } as unknown as Response
    click(findButton(container, 'Prenesi manifest (JSON)')!)
    await flush(3)

    expect(manifestCalls()).toHaveLength(2) // query + download
    expect(new URL(manifestCalls()[1]!, 'http://localhost').searchParams.get('mode')).toBe('manifest')
    expect(blobSpy).toHaveBeenCalledTimes(1)
    expect(toastSuccessMock).toHaveBeenCalledWith('Prenos pripravljen')
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it('filenameFromDisposition: ime iz Content-Disposition; null → fallback prenos-podatkov.json', () => {
    expect(filenameFromDisposition(FULL_DISPOSITION)).toBe('prenos-podatkov-20260315-100000.json')
    expect(filenameFromDisposition(null)).toBe('prenos-podatkov.json')
    expect(filenameFromDisposition('attachment; filename="neveljavno')).toBe('prenos-podatkov.json')
  })

  it('napaka 403 (NO_LOCATION_MESSAGE) pri full downloadu → toast.error TOČNO sporočilo, brez uspeha, brez crasha', async () => {
    getCurrentUserMock.mockReturnValue(authUserWithRole('admin'))
    routeApi()
    fullFixture = jsonResponse({ error: NO_LOCATION_MESSAGE }, 403)
    const container = await mountDataPortability()

    click(findButton(container, 'Prenesi celotne podatke (JSON)')!)
    await flush(3)

    expect(toastErrorMock).toHaveBeenCalledWith(NO_LOCATION_MESSAGE)
    expect(toastErrorMock).toHaveBeenCalledTimes(1)
    expect(toastSuccessMock).not.toHaveBeenCalled()
    expect(blobSpy).not.toHaveBeenCalled()
    expect(createObjectURLMock).not.toHaveBeenCalled()
    // brez crasha — modul še vedno izrisan
    expect(container.textContent).toContain('Prenos podatkov')
  })

  it('napaka 400 (neznan način) pri downloadu → toast.error TOČNO strežnikovo sporočilo', async () => {
    getCurrentUserMock.mockReturnValue(authUserWithRole('admin'))
    routeApi()
    fullFixture = jsonResponse({ error: 'Neznan način. Dovoljeno: manifest, full' }, 400)
    const container = await mountDataPortability()

    click(findButton(container, 'Prenesi celotne podatke (JSON)')!)
    await flush(3)

    expect(toastErrorMock).toHaveBeenCalledWith('Neznan način. Dovoljeno: manifest, full')
    expect(toastSuccessMock).not.toHaveBeenCalled()
    expect(blobSpy).not.toHaveBeenCalled()
  })
})

// ============================================
// F) Registracija modula (fs-pin)
// ============================================

describe('Registracija modula (fs-pin, R147-c)', () => {
  it('navItems: vnos data-portability (adminOnly, DatabaseBackup) + SISTEM skupina + module-registry', () => {
    const navSrc = readFileSync(join(process.cwd(), 'src', 'components', 'pos', 'sidebar', 'navItems.ts'), 'utf8')
    const entryLine = navSrc.split('\n').find((l) => l.includes("id: 'data-portability'"))
    expect(entryLine, 'navItems vnos data-portability NI na disku').toBeDefined()
    expect(entryLine).toContain("labelKey: 'nav.dataPortability'")
    expect(entryLine).toContain('DatabaseBackup')
    expect(entryLine).toContain('adminOnly: true')
    // SISTEM skupina vsebuje 'data-portability' (poleg devices)
    expect(navSrc).toMatch(/'configuration', 'settings', 'locations', 'devices', 'data-portability'/)

    const registrySrc = readFileSync(join(process.cwd(), 'src', 'app', 'components', 'module-registry.tsx'), 'utf8')
    expect(registrySrc).toContain("'data-portability': DataPortabilityModule,")
    expect(registrySrc).toContain("import('@/components/pos/portability/DataPortabilityModule')")
  })

  it('i18n: nav.dataPortability v vseh 5 jezikih (sinonim, nič hardcodea v modulu)', () => {
    const translations: Array<[string, string]> = [
      ['sl', 'Prenos podatkov'],
      ['en', 'Data portability'],
      ['de', 'Datenübertragbarkeit'],
      ['hr', 'Prenos podataka'],
      ['it', 'Portabilità dei dati'],
    ]
    for (const [lang, translation] of translations) {
      const src = readFileSync(join(process.cwd(), 'src', 'lib', 'i18n', 'navigation', `${lang}.ts`), 'utf8')
      expect(src, `nav.dataPortability manjka v ${lang}.ts`).toContain(`'nav.dataPortability': '${translation}'`)
    }
  })

  it('komponenta: brez blue/indigo, brez grid-cols-14, izključitvena opomba na disku, helper samo import type, form-locations queryKey', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'components', 'pos', 'portability', 'DataPortabilityModule.tsx'), 'utf8')
    // BUG-04 hišno pravilo: NIKOLI modri/indigo akcenti; R146-final: brez grid-cols-14
    expect(src).not.toMatch(/blue-|indigo-/)
    expect(src).not.toContain('grid-cols-14')
    // izključitvena opomba je del komponente (PII pin)
    expect(src).toContain('Ni vključeno: gesla in PIN-i, seje, API ključi, biometrija, skrivne nastavitve, IP naslovi v revizijski sledi.')
    // server helper vleče db → client sme konzumirati SAMO import type (erased)
    const importLines = src.split('\n').filter((l) => l.includes('from \'@/app/api/export/portability/_helpers/portability-sections\''))
    expect(importLines.length).toBeGreaterThanOrEqual(1)
    for (const line of importLines) {
      expect(line.trim().startsWith('import type')).toBe(true)
    }
    // query-key pin: ['portability','form-locations'] (R147-c kontrakt)
    expect(src).toContain("queryKey: ['portability', 'form-locations']")
  })
})
