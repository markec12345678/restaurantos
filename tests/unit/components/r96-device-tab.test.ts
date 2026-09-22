// ============================================
// Testi za DeviceTab (R96-b) — admin nastavitev bindinga lokacije naprave
//
// Pokritost (logika, ne piksli):
//   1. Render trenutnega bindinga (localStorage vezana / ni vezana / neznana)
//   2. Shrani: izbira lokacije → persistDeviceLocation(id) + localStorage
//   3. Pobriši binding: clearDeviceLocation() + ključ odstranjen
//   4. Loading (skeleton) in error (notice) stanja fetch-a lokacij
//   5. fs-guard: DeviceTab dejansko uporablja persist/clear izvoze,
//      SettingsManager registrira 'device' tab (r93/r95 hišni stil)
//
// Tehnične opombe (hišni stil, glej pin-login-two-step.test.ts):
//   - unit-vm pool = vmThreads + jsdom → localStorage je NATIVEN (ne stubamo
//     globalov); assertamo BOTH mock klic IN realen localStorage učinek
//     (delni vi.mock z importOriginal = bolj robustno kot goli localStorage
//     opazovanje iz pin-login testov: ulovimo tudi "klic a ne zapisa").
//   - @testing-library NI v devDeps → createRoot + act (IS_REACT_ACT_ENVIRONMENT).
//   - DeviceTab uporablja useQuery → mount znotraj QueryClientProvider
//     (svež QueryClient na mount, retry: false za determinističen error test).
//   - Post-hidracijsko branje bindinga je setTimeout(0) → flush prek realnih
//     timerjev znotraj act (brez fake timers — enako kot pin-login testi).
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

import { authFetch } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import {
  DEVICE_LOCATION_STORAGE_KEY,
  clearDeviceLocation,
  persistDeviceLocation,
} from '@/components/pos/pin-login/resolveDeviceLocation'
import {
  DeviceTab,
  DEVICE_TAB_NOT_BOUND,
  DEVICE_TAB_UNKNOWN_LOCATION,
  DEVICE_TAB_LOAD_ERROR,
} from '@/components/pos/settings/DeviceTab'

// authFetch živi v PinLogin.tsx (re-export usePinAuth) — celoten modul mockamo,
// da test ne vleče usePinLogin/next-dynamic grafa in ne dela realnih klicev.
vi.mock('@/components/pos/PinLogin', () => ({
  authFetch: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

// DELNI mock resolveDeviceLocation: readDeviceLocation ostane REALen (jsdom
// localStorage), persist/clear pa sta opazovana wrapperja, ki pokličeta
// realno implementacijo → assertamo klic IN side-effect.
vi.mock('@/components/pos/pin-login/resolveDeviceLocation', async importOriginal => {
  const actual = await importOriginal<typeof import('@/components/pos/pin-login/resolveDeviceLocation')>()
  return {
    ...actual,
    persistDeviceLocation: vi.fn((locationId: string) => actual.persistDeviceLocation(locationId)),
    clearDeviceLocation: vi.fn(() => actual.clearDeviceLocation()),
  }
})

const authFetchMock = vi.mocked(authFetch)
const persistMock = vi.mocked(persistDeviceLocation)
const clearMock = vi.mocked(clearDeviceLocation)
const toastSuccessMock = vi.mocked(toast.success)

// React 19 act okolje (jsdom) — potrebno za createRoot render v testih
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// --- Fixture: GET /api/locations (polne vrstice, house normalizacija) ---
const MOCK_LOCATIONS = [
  { id: 'loc-1', name: 'Ljubljana Center', isActive: true },
  { id: 'loc-2', name: 'Maribor', isActive: true },
]

function jsonResponse(payload: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => payload } as unknown as Response
}

// --- Render helperji (brez @testing-library — house minimalen pristop) ---
const mounted: { root: Root; container: HTMLElement }[] = []

function mountWithProviders(ui: ReactElement): HTMLElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
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

/** Native <select> sprememba: value prek prototype setterja (React value tracker) + change event. */
function setSelectValue(select: HTMLSelectElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')
  act(() => {
    descriptor?.set?.call(select, value)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

/** Flush: hydration setTimeout(0) (makroteka) + react-query microtask verige. */
async function flush(rounds = 2): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
  }
}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState({}, '', '/')
  authFetchMock.mockReset()
  persistMock.mockClear()
  clearMock.mockClear()
  toastSuccessMock.mockClear()
})

afterEach(() => {
  while (mounted.length) {
    const { root, container } = mounted.pop()!
    act(() => {
      root.unmount()
    })
    container.remove()
  }
  localStorage.clear()
})

// ============================================
// 1) RENDER — trenutni binding
// ============================================
describe('DeviceTab render (R96-b)', () => {
  it('vezana naprava: "Naprava je vezana na: <ime>", select prednastavljen na binding', async () => {
    localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, 'loc-1')
    authFetchMock.mockResolvedValue(jsonResponse(MOCK_LOCATIONS))
    const container = mountWithProviders(createElement(DeviceTab))
    await flush()

    expect(container.textContent).toContain('Naprava je vezana na: Ljubljana Center')
    const select = container.querySelector('select') as HTMLSelectElement
    expect(select.value).toBe('loc-1')
    // gumb Shrani je disabled (izbira == trenutni binding — nič za shranit)
    const save = container.querySelector('button[aria-label="Shrani lokacijo naprave"]') as HTMLButtonElement
    expect(save.disabled).toBe(true)
  })

  it('pre-hidracija: skeleton (post-hidracijsko branje), šele po flushu resnično stanje', async () => {
    authFetchMock.mockResolvedValue(jsonResponse(MOCK_LOCATIONS))
    const container = mountWithProviders(createElement(DeviceTab))
    // tik po mountu: localStorage branje še ni poteklo → skeleton namesto stanja
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
    expect(container.textContent).not.toContain(DEVICE_TAB_NOT_BOUND)
    await flush()
    // brez bindinga → "ni vezana" + skeleton izginjen
    expect(container.textContent).toContain(DEVICE_TAB_NOT_BOUND)
    expect(container.querySelector('p[role="status"]')?.textContent).toContain(DEVICE_TAB_NOT_BOUND)
  })

  it('ni vezana: DEVICE_TAB_NOT_BOUND, "Pobriši binding" disabled, Shrani disabled', async () => {
    authFetchMock.mockResolvedValue(jsonResponse(MOCK_LOCATIONS))
    const container = mountWithProviders(createElement(DeviceTab))
    await flush()

    expect(container.textContent).toContain(DEVICE_TAB_NOT_BOUND)
    const clear = container.querySelector('button[aria-label="Pobriši binding lokacije naprave"]') as HTMLButtonElement
    expect(clear.disabled).toBe(true)
    const save = container.querySelector('button[aria-label="Shrani lokacijo naprave"]') as HTMLButtonElement
    expect(save.disabled).toBe(true)
  })

  it('neznana lokacija: vezani id ni med API lokacijami → "neznana lokacija" + opomba', async () => {
    localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, 'loc-gone')
    authFetchMock.mockResolvedValue(jsonResponse(MOCK_LOCATIONS))
    const container = mountWithProviders(createElement(DeviceTab))
    await flush()

    const status = container.querySelector('p[role="status"]')?.textContent ?? ''
    expect(status).toContain('Naprava je vezana na: neznana lokacija')
    expect(container.textContent).toContain(DEVICE_TAB_UNKNOWN_LOCATION)
  })

  it('URL param ?locationId= prevlada nad localStorage (readDeviceLocation kontrakt)', async () => {
    localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, 'loc-1')
    window.history.replaceState({}, '', '/?locationId=loc-2')
    authFetchMock.mockResolvedValue(jsonResponse(MOCK_LOCATIONS))
    const container = mountWithProviders(createElement(DeviceTab))
    await flush()

    expect(container.textContent).toContain('Naprava je vezana na: Maribor')
  })
})

// ============================================
// 2) SHRANI — persistDeviceLocation z izbranim ID
// ============================================
describe('DeviceTab shrani (R96-b)', () => {
  it('izbira lokacije + klik Shrani → persistDeviceLocation(id) + localStorage zapis + toast', async () => {
    authFetchMock.mockResolvedValue(jsonResponse(MOCK_LOCATIONS))
    const container = mountWithProviders(createElement(DeviceTab))
    await flush()

    const select = container.querySelector('select') as HTMLSelectElement
    setSelectValue(select, 'loc-2')
    const save = container.querySelector('button[aria-label="Shrani lokacijo naprave"]') as HTMLButtonElement
    expect(save.disabled).toBe(false)
    click(save)
    await flush()

    // Dvojna asercija: mock klic (pravi ID) + realen localStorage učinek
    expect(persistMock).toHaveBeenCalledTimes(1)
    expect(persistMock).toHaveBeenCalledWith('loc-2')
    expect(localStorage.getItem(DEVICE_LOCATION_STORAGE_KEY)).toBe('loc-2')
    expect(toastSuccessMock).toHaveBeenCalledTimes(1)
    // status se osveži na novo lokacijo
    expect(container.querySelector('p[role="status"]')?.textContent).toContain('Maribor')
  })

  it('brez izbire (placeholder) → Shrani disabled, persist NI klican', async () => {
    authFetchMock.mockResolvedValue(jsonResponse(MOCK_LOCATIONS))
    const container = mountWithProviders(createElement(DeviceTab))
    await flush()

    const save = container.querySelector('button[aria-label="Shrani lokacijo naprave"]') as HTMLButtonElement
    expect(save.disabled).toBe(true)
    click(save)
    await flush()
    expect(persistMock).not.toHaveBeenCalled()
    expect(localStorage.getItem(DEVICE_LOCATION_STORAGE_KEY)).toBeNull()
  })

  it('binding manjka → shrani VEŽE napravo (null → lokacija)', async () => {
    authFetchMock.mockResolvedValue(jsonResponse(MOCK_LOCATIONS))
    const container = mountWithProviders(createElement(DeviceTab))
    await flush()

    const select = container.querySelector('select') as HTMLSelectElement
    setSelectValue(select, 'loc-1')
    const save = container.querySelector('button[aria-label="Shrani lokacijo naprave"]') as HTMLButtonElement
    click(save)
    await flush()

    expect(persistMock).toHaveBeenCalledWith('loc-1')
    expect(localStorage.getItem(DEVICE_LOCATION_STORAGE_KEY)).toBe('loc-1')
    expect(container.textContent).toContain('Naprava je vezana na: Ljubljana Center')
  })
})

// ============================================
// 3) POBRIŠI BINDING — clearDeviceLocation
// ============================================
describe('DeviceTab pobriši (R96-b)', () => {
  it('klik "Pobriši binding" → clearDeviceLocation klican + ključ odstranjen + not-bound', async () => {
    localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, 'loc-1')
    authFetchMock.mockResolvedValue(jsonResponse(MOCK_LOCATIONS))
    const container = mountWithProviders(createElement(DeviceTab))
    await flush()

    const clear = container.querySelector('button[aria-label="Pobriši binding lokacije naprave"]') as HTMLButtonElement
    expect(clear.disabled).toBe(false)
    click(clear)
    await flush()

    expect(clearMock).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(DEVICE_LOCATION_STORAGE_KEY)).toBeNull()
    expect(container.querySelector('p[role="status"]')?.textContent).toContain(DEVICE_TAB_NOT_BOUND)
    expect(toastSuccessMock).toHaveBeenCalledTimes(1)
  })
})

// ============================================
// 4) FETCH STANJA — loading skeleton + error notice
// ============================================
describe('DeviceTab fetch stanja (R96-b)', () => {
  it('loading: skeleton namesto selecta, Shrani ni klican', async () => {
    authFetchMock.mockImplementation(() => new Promise<Response>(() => {}))
    const container = mountWithProviders(createElement(DeviceTab))
    await flush()

    // hydration skeleton je počakal, fetch še vedno teče → select NI tu,
    // akcijska gumba pa sta onemogočena (ni izbire / ni bindinga)
    expect(container.querySelector('select')).toBeNull()
    const save = container.querySelector('button[aria-label="Shrani lokacijo naprave"]') as HTMLButtonElement
    expect(save.disabled).toBe(true)
    const clear = container.querySelector('button[aria-label="Pobriši binding lokacije naprave"]') as HTMLButtonElement
    expect(clear.disabled).toBe(true)
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
    expect(persistMock).not.toHaveBeenCalled()
  })

  it('error: role="alert" notice z DEVICE_TAB_LOAD_ERROR, brez selecta', async () => {
    authFetchMock.mockResolvedValue(jsonResponse({ error: 'x' }, false))
    const container = mountWithProviders(createElement(DeviceTab))
    await flush()

    const alert = container.querySelector('p[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert?.textContent).toBe(DEVICE_TAB_LOAD_ERROR)
    expect(container.querySelector('select')).toBeNull()
  })

  it('error NE potrdi neznane lokacije (vezani id ostane prikazan, ne "neznana")', async () => {
    localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, 'loc-mystery')
    authFetchMock.mockResolvedValue(jsonResponse({ error: 'x' }, false))
    const container = mountWithProviders(createElement(DeviceTab))
    await flush()

    const status = container.querySelector('p[role="status"]')?.textContent ?? ''
    expect(status).toContain('Naprava je vezana na: loc-mystery')
    expect(container.textContent).not.toContain(DEVICE_TAB_UNKNOWN_LOCATION)
  })
})

// ============================================
// 5) FS-GUARD — hišni stil r93/r95 (readFileSync + source asserti)
// ============================================
function readRepoFile(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split('/')), 'utf-8')
}

describe('R96-b fs-guard (resolveDeviceLocation + DeviceTab + SettingsManager)', () => {
  it('resolveDeviceLocation.ts: izvozi clearDeviceLocation, ki odstrani DEVICE_LOCATION_STORAGE_KEY', () => {
    const src = readRepoFile('src/components/pos/pin-login/resolveDeviceLocation.ts')
    expect(src).toContain('export function clearDeviceLocation(): void')
    expect(src).toContain('removeItem(DEVICE_LOCATION_STORAGE_KEY)')
  })

  it('DeviceTab.tsx: dejansko UPORABLJA persistDeviceLocation + clearDeviceLocation izvoza', () => {
    const src = readRepoFile('src/components/pos/settings/DeviceTab.tsx')
    expect(src).toContain("from '@/components/pos/pin-login/resolveDeviceLocation'")
    expect(src).toContain('persistDeviceLocation(')
    expect(src).toContain('clearDeviceLocation(')
    expect(src).toContain('readDeviceLocation()')
  })

  it('SettingsManager.tsx: registrira "device" tab (dynamic import + TabsTrigger + TabsContent)', () => {
    const src = readRepoFile('src/components/pos/SettingsManager.tsx')
    expect(src).toContain("import('./settings/DeviceTab')")
    expect(src).toContain('<TabsTrigger value="device"')
    expect(src).toContain('<TabsContent value="device"')
    expect(src).toContain('<DeviceTab />')
  })
})
