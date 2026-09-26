// ============================================
// R142-c (epic #115 #29 Device center) — UI modul 'devices'
//
// Pokritost (r96-device-tab.test.ts hišni stil + r141-briefing-ui pure helperji):
//   A) čisti helperji iz devices/constants.ts:
//      - BUG-04 badge mape (literal razredi, UNKNOWN fallback, brez blue/indigo)
//      - deviceStatusKey/deviceStatusBadge (status IZKLJUČNO iz isOnline)
//      - formatRelativeLastSeen (deterministične pinite z nowMs; sl oblike)
//      - groupDevicesByLocation (grupe, 'Brez lokacije' ZADNJA, vrstni red)
//      - summarizeDevices (KPI števci) + isValidDeviceName (PATCH Zod zrcalo)
//   B) render DevicesModule (createRoot + act, brez @testing-library):
//      - KPI števci (4 naprave: 2 online, 1 offline z lokacijo, 1 offline brez)
//      - prazno stanje ('Ni registriranih naprav' + hint)
//      - error stanje + 'Poskusi znova' (retry → okrevanje)
//      - rename dialog: prazno/whitespace ime BLOKIRANO, veljavno → PATCH + toast
//      - reassign: SAMO super-admin (manager ne vidi), PATCH { locationId }
//
// Tehnične opombe (r96 kanon):
//   - unit-vm pool = vmThreads + jsdom; @testing-library NI v devDeps →
//     createRoot + act (IS_REACT_ACT_ENVIRONMENT).
//   - '@/components/pos/PinLogin' = CELOTEN mock (authFetch + getCurrentUser —
//     useAuthUser bere prijavljenega uporabnika prek tega modula).
//   - TanStack Query: svež QueryClient na mount; retryDelay: 0 (hook retry: 1
//     naj ne čaka 1 s backoffa), retry: false na clientu nima učinka na hook
//     retry: 1 — namenoma, error test počaka 2 poskusa.
//   - Radix Dialog portala v document.body → asserti na dokument, ne kontejner.
// ============================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import type { Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { authFetch } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import { DevicesModule, DEVICES_EMPTY_HINT } from '@/components/pos/devices/DevicesModule'
import {
  DEVICE_TYPES,
  DEVICE_TYPE_BADGES,
  DEVICE_TYPE_UNKNOWN,
  DEVICE_STATUS_BADGES,
  DEVICE_STATUS_UNKNOWN,
  type DeviceRow,
  deviceTypeBadge,
  deviceStatusBadge,
  deviceStatusKey,
  formatRelativeLastSeen,
  groupDevicesByLocation,
  isValidDeviceName,
  summarizeDevices,
  NO_LOCATION_GROUP_KEY,
} from '@/components/pos/devices/constants'

// authFetch + getCurrentUser živita v PinLogin.tsx (re-export usePinAuth) —
// celoten modul mockamo, da test ne vleče usePinLogin/next-dynamic grafa.
const auth = vi.hoisted(() => ({
  user: null as { id: string; name: string; email: string; role: string; primaryJob: unknown; permissions: string[] } | null,
}))

vi.mock('@/components/pos/PinLogin', () => ({
  authFetch: vi.fn(),
  getCurrentUser: vi.fn(() => auth.user),
  setCurrentUser: vi.fn(),
  getAuthToken: vi.fn(() => 'test-token'),
  setAuthToken: vi.fn(),
  hasPermission: vi.fn(() => true),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

const authFetchMock = vi.mocked(authFetch)
const toastSuccessMock = vi.mocked(toast.success)
const toastErrorMock = vi.mocked(toast.error)

// React 19 act okolje (jsdom) — potrebno za createRoot render v testih
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// --- Fixture: GET /api/devices (kontrakt R142-b: whitelist + isOnline) ---
const FIXED_NOW = Date.parse('2026-09-26T12:00:00.000Z')

function deviceRow(overrides: Partial<DeviceRow> = {}): DeviceRow {
  return {
    id: 'dev-1',
    deviceId: 'DEV-POS-001',
    name: 'Blagajna 1',
    type: 'pos',
    status: 'online',
    lastSeenAt: new Date(FIXED_NOW - 2 * 60_000).toISOString(),
    appVersion: '1.2.3',
    locationId: 'loc-1',
    isOnline: true,
    location: { name: 'Ljubljana Center', code: 'HQ' },
    ...overrides,
  }
}

const MOCK_DEVICES: DeviceRow[] = [
  deviceRow(),
  deviceRow({
    id: 'dev-2', deviceId: 'DEV-KDS-002', name: 'Kuhinjski zaslon', type: 'kds', status: 'online',
    lastSeenAt: new Date(FIXED_NOW - 45_000).toISOString(),
    locationId: 'loc-2', location: { name: 'Maribor', code: 'FIL2' },
  }),
  deviceRow({
    id: 'dev-3', deviceId: 'DEV-POS-003', name: 'Blagajna 2', type: 'pos', status: 'offline',
    isOnline: false, lastSeenAt: new Date(FIXED_NOW - 3 * 3600_000).toISOString(),
    locationId: 'loc-1', location: { name: 'Ljubljana Center', code: 'HQ' },
  }),
  deviceRow({
    id: 'dev-4', deviceId: 'DEV-KIOSK-004', name: 'Kiosk vhod', type: 'kiosk', status: 'offline',
    isOnline: false, lastSeenAt: null, appVersion: '', locationId: null, location: null,
  }),
]

const MOCK_LOCATIONS = {
  locations: [
    { id: 'loc-1', name: 'Ljubljana Center', isActive: true },
    { id: 'loc-2', name: 'Maribor', isActive: true },
  ],
  stats: { total: 2, active: 2, open: 0 },
}

const ADMIN_USER = { id: 'emp-admin', name: 'Admin', email: 'a@x.si', role: 'admin', primaryJob: null, permissions: ['admin', 'view_reports'] }
const MANAGER_USER = { id: 'emp-mgr', name: 'Vodja', email: 'm@x.si', role: 'manager', primaryJob: null, permissions: ['view_reports', 'take_orders'] }

function jsonResponse(payload: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => payload } as unknown as Response
}

/** Privzeti GET router: /api/devices in /api/locations; PATCH uspešen */
function mockHappyApi(): void {
  authFetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === '/api/devices') return jsonResponse({ devices: MOCK_DEVICES, count: MOCK_DEVICES.length })
    if (url === '/api/locations') return jsonResponse(MOCK_LOCATIONS)
    if (url === '/api/devices/dev-1' && init?.method === 'PATCH') {
      return jsonResponse({ device: deviceRow() })
    }
    throw new Error(`Nepričakovan klic: ${url} ${String(init?.method ?? 'GET')}`)
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

/** Native <input> sprememba: value prek prototype setterja (React value tracker) + input event. */
function setInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
  act(() => {
    descriptor?.set?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
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

/** Flush: react-query microtask verige + setTimeout(0). */
async function flush(rounds = 2): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
  }
}

beforeEach(() => {
  authFetchMock.mockReset()
  toastSuccessMock.mockClear()
  toastErrorMock.mockClear()
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
// A) ČISTI HELPERJI (constants.ts)
// ============================================

describe('BUG-04 badge mape (center naprav)', () => {
  it('DEVICE_TYPE_BADGES: vsi razredi so polni literali (brez konkatenacij/modrih tonov)', () => {
    expect(Object.keys(DEVICE_TYPE_BADGES).sort()).toEqual([...DEVICE_TYPES].sort())
    for (const cfg of Object.values(DEVICE_TYPE_BADGES)) {
      expect(cfg.className).toMatch(/bg-[a-z]+-\d+/)
      expect(cfg.className).toMatch(/text-[a-z]+-\d+/)
      expect(cfg.className).not.toContain('${')
      expect(cfg.className).not.toContain('+')
      // hišno pravilo: NIKOLI modri/indigo akcenti
      expect(cfg.className).not.toMatch(/blue|indigo/)
    }
    expect(DEVICE_TYPE_UNKNOWN.className).toMatch(/zinc/)
    expect(DEVICE_TYPE_UNKNOWN.label).toBe('Neznano')
  })

  it('DEVICE_TYPE_BADGES pokrije kontraktne tipe s sl oznakami', () => {
    expect(DEVICE_TYPE_BADGES.pos?.label).toBe('Prodajno mesto')
    expect(DEVICE_TYPE_BADGES.kds?.label).toBe('Kuhinja (KDS)')
    expect(DEVICE_TYPE_BADGES.kiosk?.label).toBe('Kiosk')
    expect(DEVICE_TYPE_BADGES.tablet?.label).toBe('Tablica')
    expect(DEVICE_TYPE_BADGES.mobile?.label).toBe('Mobilno')
  })

  it('deviceTypeBadge: neznana vrednost → UNKNOWN fallback (nikoli undefined)', () => {
    expect(deviceTypeBadge('widgets')).toEqual(DEVICE_TYPE_UNKNOWN)
    expect(deviceTypeBadge('')).toEqual(DEVICE_TYPE_UNKNOWN)
    expect(deviceTypeBadge(null)).toEqual(DEVICE_TYPE_UNKNOWN)
    expect(deviceTypeBadge(undefined)).toEqual(DEVICE_TYPE_UNKNOWN)
    expect(deviceTypeBadge('pos')).toEqual(DEVICE_TYPE_BADGES.pos)
  })

  it('DEVICE_STATUS_BADGES: online emerald, offline zinc; izključno iz isOnline', () => {
    expect(DEVICE_STATUS_BADGES.online?.label).toBe('Online')
    expect(DEVICE_STATUS_BADGES.online?.className).toMatch(/emerald/)
    expect(DEVICE_STATUS_BADGES.offline?.label).toBe('Offline')
    expect(DEVICE_STATUS_BADGES.offline?.className).toMatch(/zinc/)
    for (const cfg of Object.values(DEVICE_STATUS_BADGES)) {
      expect(cfg.className).not.toMatch(/blue|indigo/)
      expect(cfg.className).not.toContain('${')
    }
    expect(DEVICE_STATUS_UNKNOWN.label).toBe('Neznano')
  })

  it('deviceStatusKey/deviceStatusBadge: true/false/unknown (DB status NI vir resnice)', () => {
    expect(deviceStatusKey(true)).toBe('online')
    expect(deviceStatusKey(false)).toBe('offline')
    expect(deviceStatusKey(undefined)).toBe('unknown')
    expect(deviceStatusKey(null)).toBe('unknown')
    // DB 'sleeping' se NIKOLI ne upodobi — badge zna le online/offline/Neznano
    expect(deviceStatusBadge(true).label).toBe('Online')
    expect(deviceStatusBadge(false).label).toBe('Offline')
    expect(deviceStatusBadge(undefined).label).toBe('Neznano')
    expect(deviceStatusBadge(null).label).toBe('Neznano')
  })
})

describe('formatRelativeLastSeen (sl, deterministično)', () => {
  const NOW = FIXED_NOW

  it('null / neveljaven ISO → "Ni podatka"', () => {
    expect(formatRelativeLastSeen(null, NOW)).toBe('Ni podatka')
    expect(formatRelativeLastSeen(undefined, NOW)).toBe('Ni podatka')
    expect(formatRelativeLastSeen('', NOW)).toBe('Ni podatka')
    expect(formatRelativeLastSeen('ne-demsti-okamp', NOW)).toBe('Ni podatka')
  })

  it('sekunde / minute / ure / dni — kontraktnе oblike', () => {
    expect(formatRelativeLastSeen(new Date(NOW - 45_000).toISOString(), NOW)).toBe('pred 45 s')
    expect(formatRelativeLastSeen(new Date(NOW - 2 * 60_000).toISOString(), NOW)).toBe('pred 2 min')
    expect(formatRelativeLastSeen(new Date(NOW - 3 * 3600_000).toISOString(), NOW)).toBe('pred 3 h')
    expect(formatRelativeLastSeen(new Date(NOW - 5 * 86_400_000).toISOString(), NOW)).toBe('pred 5 dni')
  })

  it('slovenski dual/instrumental: 1 dan / 2 dneva', () => {
    expect(formatRelativeLastSeen(new Date(NOW - 86_400_000).toISOString(), NOW)).toBe('pred 1 dnem')
    expect(formatRelativeLastSeen(new Date(NOW - 2 * 86_400_000).toISOString(), NOW)).toBe('pred 2 dnevoma')
  })

  it('≥ 30 dni → ročen sl datum DD. MM. YYYY (brez ICU)', () => {
    expect(formatRelativeLastSeen(new Date(NOW - 40 * 86_400_000).toISOString(), NOW)).toBe('17. 8. 2026')
  })

  it('prihodnost (drift uri) → "zdaj"', () => {
    expect(formatRelativeLastSeen(new Date(NOW + 60_000).toISOString(), NOW)).toBe('zdaj')
  })
})

describe('groupDevicesByLocation', () => {
  it('grupira po locationId, oznaka = location.name, "Brez lokacije" ZADNJA', () => {
    const groups = groupDevicesByLocation(MOCK_DEVICES)
    expect(groups.map((g) => g.key)).toEqual(['loc-1', 'loc-2', NO_LOCATION_GROUP_KEY])
    expect(groups[0]?.label).toBe('Ljubljana Center')
    expect(groups[1]?.label).toBe('Maribor')
    expect(groups[2]?.label).toBe('Brez lokacije')
    expect(groups[0]?.devices.map((d) => d.id)).toEqual(['dev-1', 'dev-3'])
    expect(groups[2]?.devices.map((d) => d.id)).toEqual(['dev-4'])
  })

  it('prazen seznam → brez grup; lokacijski admin (ena lokacija) → ENA grupa', () => {
    expect(groupDevicesByLocation([])).toEqual([])
    const single = groupDevicesByLocation([MOCK_DEVICES[0]!, MOCK_DEVICES[2]!])
    expect(single).toHaveLength(1)
    expect(single[0]?.label).toBe('Ljubljana Center')
  })
})

describe('summarizeDevices + isValidDeviceName', () => {
  it('KPI števci: total/online/offline/unassigned (defenzivno null/undefined → 0)', () => {
    expect(summarizeDevices(MOCK_DEVICES)).toEqual({ total: 4, online: 2, offline: 2, unassigned: 1 })
    expect(summarizeDevices(null)).toEqual({ total: 0, online: 0, offline: 0, unassigned: 0 })
    expect(summarizeDevices(undefined)).toEqual({ total: 0, online: 0, offline: 0, unassigned: 0 })
  })

  it('isValidDeviceName zrcali PATCH Zod (trim 1–100)', () => {
    expect(isValidDeviceName('Blagajna 1')).toBe(true)
    expect(isValidDeviceName('   x   ')).toBe(true)
    expect(isValidDeviceName('')).toBe(false)
    expect(isValidDeviceName('    ')).toBe(false)
    expect(isValidDeviceName('x'.repeat(100))).toBe(true)
    expect(isValidDeviceName('x'.repeat(101))).toBe(false)
  })
})

// ============================================
// B) RENDER — DevicesModule
// ============================================

describe('DevicesModule render (R142-c)', () => {
  it('KPI števci + vrstice naprav: 4 naprave (2 online, 2 offline, 1 brez lokacije)', async () => {
    auth.user = ADMIN_USER
    mockHappyApi()
    const container = mountWithProviders(createElement(DevicesModule))
    await flush()

    // KPI kartice: naslov + vrednost sta sosednja <p> → 'NaslovVrednost'
    expect(container.textContent).toMatch(/Skupaj naprav4/)
    expect(container.textContent).toMatch(/Online2/)
    expect(container.textContent).toMatch(/Offline2/)
    expect(container.textContent).toMatch(/Brez lokacije1/)
    // vrstice: ime + tip badge + status badge + appVersion
    expect(container.textContent).toContain('Blagajna 1')
    expect(container.textContent).toContain('Prodajno mesto')
    expect(container.textContent).toContain('Kuhinja (KDS)')
    expect(container.textContent).toContain('Kiosk')
    expect(container.textContent).toContain('v1.2.3')
    // deviceId truncated, full v title atributu
    const devId = container.querySelector('p[title="DEV-KIOSK-004"]')
    expect(devId).not.toBeNull()
    // grupa brez lokacije obstaja (heading SectionCard)
    expect(container.textContent).toContain('Brez lokacije')
  })

  it('prazno stanje: iskreno besedilo + hint (brez izmišljanja podatkov)', async () => {
    auth.user = ADMIN_USER
    authFetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/devices') return jsonResponse({ devices: [], count: 0 })
      throw new Error(`Nepričakovan klic: ${url}`)
    })
    const container = mountWithProviders(createElement(DevicesModule))
    await flush()

    expect(container.textContent).toContain('Ni registriranih naprav')
    expect(container.textContent).toContain(DEVICES_EMPTY_HINT)
    // brez KPI vrstice (napis 'Skupaj naprav' ni prikazan v praznem stanju)
    expect(container.textContent).not.toContain('Skupaj naprav')
  })

  it('error stanje: EN destructive alert + "Poskusi znova" (retry → okrevanje)', async () => {
    auth.user = ADMIN_USER
    authFetchMock.mockRejectedValue(new Error('Napaka 500'))
    const container = mountWithProviders(createElement(DevicesModule))
    // hook retry: 1 → 2 poskusa (retryDelay: 0) → nato error UI
    await flush(6)

    expect(container.textContent).toContain('Napaka pri nalaganju naprav')
    const retry = container.querySelector('button') as HTMLButtonElement
    expect(retry.textContent).toContain('Poskusi znova')

    // retry → uspešen GET → modul se obnovi
    mockHappyApi()
    click(retry)
    await flush(4)
    expect(container.textContent).toContain('Center naprav')
    expect(container.textContent).toContain('Blagajna 1')
  })

  it('rename dialog: prazno/whitespace ime BLOKIRANO; veljavno ime → PATCH + toast', async () => {
    auth.user = ADMIN_USER
    mockHappyApi()
    const container = mountWithProviders(createElement(DevicesModule))
    await flush()

    click(container.querySelector('button[aria-label="Preimenuj napravo Blagajna 1"]')!)
    await flush()
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog?.textContent).toContain('Preimenuj napravo')

    const input = document.querySelector<HTMLInputElement>('input[aria-label="Novo ime naprave"]')!
    expect(input.value).toBe('Blagajna 1')
    const save = document.querySelector('button[aria-label="Shrani novo ime naprave"]') as HTMLButtonElement
    expect(save.disabled).toBe(false)

    // prazno ime → blokirano (disabled + role="alert")
    setInputValue(input, '')
    await flush()
    expect((document.querySelector('button[aria-label="Shrani novo ime naprave"]') as HTMLButtonElement).disabled).toBe(true)
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain('ne sme biti prazno')

    // whitespace → še vedno blokirano (Zod trim zrcalo)
    setInputValue(input, '   ')
    await flush()
    expect((document.querySelector('button[aria-label="Shrani novo ime naprave"]') as HTMLButtonElement).disabled).toBe(true)

    // veljavno ime → PATCH { name } + success toast + dialog zaprt
    setInputValue(input, 'Blagajna 1A')
    await flush()
    const save2 = document.querySelector('button[aria-label="Shrani novo ime naprave"]') as HTMLButtonElement
    expect(save2.disabled).toBe(false)
    click(save2)
    await flush(4)
    expect(authFetchMock).toHaveBeenCalledWith(
      '/api/devices/dev-1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Blagajna 1A' }) }),
    )
    expect(toastSuccessMock).toHaveBeenCalledWith('Naprava preimenovana')
    await flush(2)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('rename napaka: strežniško sporočilo gre v toast.error (fail-closed UX)', async () => {
    auth.user = ADMIN_USER
    authFetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/devices') return jsonResponse({ devices: MOCK_DEVICES, count: MOCK_DEVICES.length })
      if (url === '/api/devices/dev-1' && init?.method === 'PATCH') {
        return jsonResponse({ error: 'Samo skrbnik brez dodeljene lokacije lahko prerazporedi napravo na drugo lokacijo.' }, false)
      }
      throw new Error(`Nepričakovan klic: ${url}`)
    })
    const container = mountWithProviders(createElement(DevicesModule))
    await flush()

    click(container.querySelector('button[aria-label="Preimenuj napravo Blagajna 1"]')!)
    await flush()
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Novo ime naprave"]')!
    setInputValue(input, 'Novo ime')
    await flush()
    click(document.querySelector('button[aria-label="Shrani novo ime naprave"]')!)
    await flush(4)
    expect(toastErrorMock).toHaveBeenCalledWith(
      'Samo skrbnik brez dodeljene lokacije lahko prerazporedi napravo na drugo lokacijo.',
    )
  })

  it('reassign SAMO za super-admin: manager ne vidi akcij, admin vidi + PATCH { locationId }', async () => {
    // manager: brez rename/reassign akcij
    auth.user = MANAGER_USER
    mockHappyApi()
    let container = mountWithProviders(createElement(DevicesModule))
    await flush()
    expect(container.querySelector('button[aria-label^="Preimenuj napravo"]')).toBeNull()
    expect(container.querySelector('button[aria-label^="Prerazporedi napravo"]')).toBeNull()
    act(() => { mounted.pop()!.root.unmount() })
    container.remove()

    // admin (TENANT_ADMIN_ROLES proxy): akcije vidne, reassign dialog + PATCH
    auth.user = ADMIN_USER
    mockHappyApi()
    container = mountWithProviders(createElement(DevicesModule))
    await flush()
    expect(container.querySelector('button[aria-label="Prerazporedi napravo Blagajna 1"]')).not.toBeNull()

    click(container.querySelector('button[aria-label="Prerazporedi napravo Blagajna 1"]')!)
    await flush(4) // dialog + lazy GET /api/locations
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.textContent).toContain('Prerazporedi napravo')
    const select = document.querySelector<HTMLSelectElement>('select[aria-label="Ciljna lokacija naprave"]')
    expect(select).not.toBeNull()
    // opcije: placeholder + 2 aktivni lokaciji
    expect(select!.querySelectorAll('option')).toHaveLength(3)
    setSelectValue(select!, 'loc-2')
    await flush()
    click(document.querySelector('button[aria-label="Potrdi prerazporeditev naprave"]')!)
    await flush(4)
    expect(authFetchMock).toHaveBeenCalledWith(
      '/api/devices/dev-1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ locationId: 'loc-2' }) }),
    )
    expect(toastSuccessMock).toHaveBeenCalledWith('Naprava prerazporejena')
  })
})
