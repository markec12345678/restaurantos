// ============================================
// Testi za DeviceTab WebAuthn sekcijo (R97-a) — passkey device attestation UI
//
// Pokritost (logika, ne piksli):
//   1. Vidnost: sekcija renderira SAMO ko (a) window.PublicKeyCredential
//      obstaja (post-hidracijski feature detect) IN (b) naprava je vezana —
//      sicer tiho skrita (zero fetch, zero konzolnega šuma).
//   2. Seznam poverilnic: deviceName/deviceType label, 'Ni še uporabljen' /
//      'Zadnja uporaba:' badge, error notice (role="alert").
//   3. Revoke: dvoklikni inline confirm (prvi klik = oboroži, drugi = DELETE)
//      + single-armed enforcement (drugi gumb disabled med oborožitvijo).
//   4. Register: options fetch → startRegistration (@simplewebauthn/browser,
//      mockan) → POST register; uspeh = toast + refetch, vse napake =
//      notice WEBAUTHN_REGISTER_ERROR + toast.error; pending = disabled.
//   5. fs-guard: DeviceTab dejansko uporablja startRegistration + feature
//      detect; package.json nosi @simplewebauthn/* (r93/r95 hišni stil).
//
// Tehnične opombe (mirror r96-device-tab.test.ts hišni stil):
//   - unit-vm pool = vmThreads + jsdom → localStorage NATIVEN; assertamo
//     BOTH mock klic IN realen učinek (delni vi.mock z importOriginal).
//   - @testing-library NI v devDeps → createRoot + act (IS_REACT_ACT_ENVIRONMENT).
//   - window.PublicKeyCredential v jsdom NE obstaja → Object.defineProperty
//     (isti vzorec kot jsdom clipboard testi), configurable: true za čiščenje.
//   - '@simplewebauthn/browser' je MOCKAN (vi.mock hoisted → realen modul ne
//     vstopi v graf; v14 ima module-scope side effecte, ki ne sodijo v unit-vm).
//   - authFetch mock routira po URL predponi (locations / credentials /
//     options / register / DELETE [id]).
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
import { startRegistration } from '@simplewebauthn/browser'
import { DEVICE_LOCATION_STORAGE_KEY } from '@/components/pos/pin-login/resolveDeviceLocation'
import {
  DeviceTab,
  WEBAUTHN_SECTION_TITLE,
  WEBAUTHN_REGISTER_LABEL,
  WEBAUTHN_REGISTER_ARIA,
  WEBAUTHN_EMPTY_LIST,
  WEBAUTHN_LIST_ERROR,
  WEBAUTHN_REGISTER_ERROR,
  WEBAUTHN_REVOKE_LABEL,
  WEBAUTHN_REVOKE_CONFIRM_LABEL,
  WEBAUTHN_REVOKE_ARIA_PREFIX,
  WEBAUTHN_REVOKE_CONFIRM_ARIA,
  WEBAUTHN_NEVER_USED,
  WEBAUTHN_REGISTER_SUCCESS,
  WEBAUTHN_REVOKE_SUCCESS,
} from '@/components/pos/settings/DeviceTab'

vi.mock('@/components/pos/PinLogin', () => ({
  authFetch: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

// Realen @simplewebauthn/browser se ne naloži (vmThreads + module side effects);
// register tok ga izvaja → stub z nadzorovano resolucijo/rejekcijo.
vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: vi.fn(),
}))

// DELNI mock resolveDeviceLocation: readDeviceLocation ostane REALen (jsdom
// localStorage) — WebAuthn sekcija je vezana na pravi binding.
vi.mock('@/components/pos/pin-login/resolveDeviceLocation', async importOriginal => {
  const actual = await importOriginal<typeof import('@/components/pos/pin-login/resolveDeviceLocation')>()
  return {
    ...actual,
    persistDeviceLocation: vi.fn((locationId: string) => actual.persistDeviceLocation(locationId)),
    clearDeviceLocation: vi.fn(() => actual.clearDeviceLocation()),
  }
})

const authFetchMock = vi.mocked(authFetch)
const startRegistrationMock = vi.mocked(startRegistration)
const toastSuccessMock = vi.mocked(toast.success)
const toastErrorMock = vi.mocked(toast.error)

// React 19 act okolje (jsdom) — potrebno za createRoot render v testih
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// --- Fixture: lokacije (polne vrstice) + WebAuthn poverilnice ---
const MOCK_LOCATIONS = [
  { id: 'loc-1', name: 'Ljubljana Center', isActive: true },
  { id: 'loc-2', name: 'Maribor', isActive: true },
]

const MOCK_CREDENTIALS = [
  {
    id: 'cred-1',
    deviceName: 'Kiosk-1',
    transports: 'internal',
    deviceType: 'singleDevice',
    createdAt: '2025-01-01T00:00:00.000Z',
    lastUsedAt: null,
  },
  {
    id: 'cred-2',
    deviceName: null,
    transports: 'usb',
    deviceType: 'multiDevice',
    createdAt: '2025-01-02T00:00:00.000Z',
    lastUsedAt: '2025-06-01T12:00:00.000Z',
  },
]

function jsonResponse(payload: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => payload } as unknown as Response
}

/** authFetch router po URL predponi — privzeto vse zeleno; testi povozijo. */
function routeAuthFetch(overrides: {
  credentials?: Response
  delete?: Response
  options?: Response
  register?: Response
} = {}): void {
  authFetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input)
    if (url.startsWith('/api/locations')) return jsonResponse(MOCK_LOCATIONS)
    if (url.includes('/api/settings/webauthn/credentials/')) {
      return overrides.delete ?? jsonResponse({ success: true })
    }
    if (url.includes('/api/settings/webauthn/credentials')) {
      return overrides.credentials ?? jsonResponse({ locationId: 'loc-1', credentials: MOCK_CREDENTIALS })
    }
    if (url.includes('/api/auth/webauthn/options')) {
      return overrides.options ?? jsonResponse({ challenge: 'chal-1', registration: { challenge: 'chal-1' } })
    }
    if (url.includes('/api/settings/webauthn/register')) {
      return overrides.register ?? jsonResponse({ success: true, credential: { id: 'cred-new' } })
    }
    return jsonResponse({ error: 'unrouted' }, false)
    void init
  })
}

// --- Feature detect helper (jsdom nima PublicKeyCredential) ---
function setWebauthnSupported(supported: boolean): void {
  if (supported) {
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: class PublicKeyCredentialMock {},
      configurable: true,
      writable: true,
    })
  } else {
    Reflect.deleteProperty(window, 'PublicKeyCredential')
  }
}

// --- Render helperji (mirror r96-device-tab.test.ts) ---
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

/** Flush: hydration setTimeout(0) (makroteka) + react-query microtask verige. */
async function flush(rounds = 2): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
  }
}

/** Standard mount: WebAuthn podprt + naprava vezana na loc-1. */
async function mountBoundWithSupport(): Promise<HTMLElement> {
  setWebauthnSupported(true)
  localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, 'loc-1')
  routeAuthFetch()
  const container = mountWithProviders(createElement(DeviceTab))
  await flush()
  return container
}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState({}, '', '/')
  authFetchMock.mockReset()
  startRegistrationMock.mockReset()
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
  Reflect.deleteProperty(window, 'PublicKeyCredential')
  localStorage.clear()
})

// ============================================
// 1) VIDNOST — feature detect + binding vrata
// ============================================
describe('WebAuthn sekcija vidnost (R97-a)', () => {
  it('brez window.PublicKeyCredential → sekcija tiho skrita (tudi vezana naprava)', async () => {
    setWebauthnSupported(false)
    localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, 'loc-1')
    routeAuthFetch()
    const container = mountWithProviders(createElement(DeviceTab))
    await flush()

    expect(container.textContent).not.toContain(WEBAUTHN_SECTION_TITLE)
    // binding vrstica obstaja (zgornja kartica), WebAuthn sekcija pa ne
    expect(container.textContent).toContain('Naprava je vezana na: Ljubljana Center')
    // zero fetch poverilnic (enabled: isBound && webauthnSupported)
    const credentialCalls = authFetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/settings/webauthn/credentials'),
    )
    expect(credentialCalls).toHaveLength(0)
  })

  it('brez bindinga → sekcija skrita (tudi s podporo)', async () => {
    setWebauthnSupported(true)
    routeAuthFetch()
    const container = mountWithProviders(createElement(DeviceTab))
    await flush()

    expect(container.textContent).not.toContain(WEBAUTHN_SECTION_TITLE)
  })

  it('podpora + binding → sekcija vidna: naslov, prazen seznam, register gumb', async () => {
    setWebauthnSupported(true)
    localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, 'loc-1')
    routeAuthFetch({ credentials: jsonResponse({ locationId: 'loc-1', credentials: [] }) })
    const container = mountWithProviders(createElement(DeviceTab))
    await flush()

    expect(container.textContent).toContain(WEBAUTHN_SECTION_TITLE)
    expect(container.textContent).toContain(WEBAUTHN_EMPTY_LIST)
    const register = container.querySelector(`button[aria-label="${WEBAUTHN_REGISTER_ARIA}"]`) as HTMLButtonElement
    expect(register).not.toBeNull()
    expect(register.textContent).toContain(WEBAUTHN_REGISTER_LABEL)
    // credentials fetch je šel na pravi scope URL (lokalna hierarhična tipka)
    const credentialCalls = authFetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/settings/webauthn/credentials?'),
    )
    expect(credentialCalls.length).toBeGreaterThan(0)
    expect(String(credentialCalls[0][0])).toContain('locationId=loc-1')
  })
})

// ============================================
// 2) SEZNAM — render poverilnic + error stanje
// ============================================
describe('WebAuthn seznam (R97-a)', () => {
  it('render vrstic: deviceName label + never-used badge + fallback label (deviceType)', async () => {
    const container = await mountBoundWithSupport()

    // cred-1: deviceName label + 'Ni še uporabljen'
    expect(container.textContent).toContain('Kiosk-1')
    expect(container.textContent).toContain(WEBAUTHN_NEVER_USED)
    // cred-2: deviceName null → deviceType fallback label + 'Zadnja uporaba:'
    expect(container.textContent).toContain('multiDevice')
    expect(container.textContent).toContain('Zadnja uporaba:')
    // aria-label revoka nosi label (klicatelj dobi razumljiv kontekst)
    const revoke1 = container.querySelector(`button[aria-label="${WEBAUTHN_REVOKE_ARIA_PREFIX} Kiosk-1"]`)
    expect(revoke1).not.toBeNull()
  })

  it('fetch napaka → role="alert" z WEBAUTHN_LIST_ERROR', async () => {
    setWebauthnSupported(true)
    localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, 'loc-1')
    routeAuthFetch({ credentials: jsonResponse({ error: 'x' }, false) })
    const container = mountWithProviders(createElement(DeviceTab))
    await flush()

    const alert = container.querySelector('p[role="alert"]')
    expect(alert?.textContent).toBe(WEBAUTHN_LIST_ERROR)
  })
})

// ============================================
// 3) REVOKE — dvoklikni inline confirm
// ============================================
describe('WebAuthn revoke (R97-a)', () => {
  it('prvi klik oboroži (label → Potrdi odstranitev), DELETE NI klican', async () => {
    const container = await mountBoundWithSupport()

    const revoke1 = container.querySelector(`button[aria-label="${WEBAUTHN_REVOKE_ARIA_PREFIX} Kiosk-1"]`) as HTMLButtonElement
    click(revoke1)
    await flush()

    // oborožen gumb: nov aria-label + confirm label; DELETE še ni šel ven
    expect(container.querySelector(`button[aria-label="${WEBAUTHN_REVOKE_CONFIRM_ARIA}"]`)).not.toBeNull()
    expect(container.textContent).toContain(WEBAUTHN_REVOKE_CONFIRM_LABEL)
    const deleteCalls = authFetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/settings/webauthn/credentials/'),
    )
    expect(deleteCalls).toHaveLength(0)
  })

  it('drugi klik izvede DELETE + toast uspeha + refetch seznama', async () => {
    const container = await mountBoundWithSupport()

    const revoke1 = container.querySelector(`button[aria-label="${WEBAUTHN_REVOKE_ARIA_PREFIX} Kiosk-1"]`) as HTMLButtonElement
    click(revoke1)
    await flush()
    const armed = container.querySelector(`button[aria-label="${WEBAUTHN_REVOKE_CONFIRM_ARIA}"]`) as HTMLButtonElement
    click(armed)
    await flush()

    expect(authFetchMock).toHaveBeenCalledWith(
      '/api/settings/webauthn/credentials/cred-1',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(toastSuccessMock).toHaveBeenCalledWith(WEBAUTHN_REVOKE_SUCCESS)
    // refetch: credentials endpoint zadet vsaj 2× (init + refetch)
    const credentialCalls = authFetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/settings/webauthn/credentials?'),
    )
    expect(credentialCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('single-armed: med oborožitvijo je drugi revoke gumb disabled', async () => {
    const container = await mountBoundWithSupport()

    const revoke1 = container.querySelector(`button[aria-label="${WEBAUTHN_REVOKE_ARIA_PREFIX} Kiosk-1"]`) as HTMLButtonElement
    click(revoke1)
    await flush()

    const revoke2 = container.querySelector(`button[aria-label="${WEBAUTHN_REVOKE_ARIA_PREFIX} multiDevice"]`) as HTMLButtonElement
    expect(revoke2.disabled).toBe(true)
  })
})

// ============================================
// 4) REGISTER — options → ceremony → POST
// ============================================
describe('WebAuthn register (R97-a)', () => {
  it('srečna pot: options fetch → startRegistration → POST register + toast + refetch', async () => {
    const container = await mountBoundWithSupport()
    startRegistrationMock.mockResolvedValue({ id: 'att-1', response: {} } as Awaited<ReturnType<typeof startRegistration>>)

    const register = container.querySelector(`button[aria-label="${WEBAUTHN_REGISTER_ARIA}"]`) as HTMLButtonElement
    click(register)
    await flush(4)

    expect(authFetchMock).toHaveBeenCalledWith(
      '/api/auth/webauthn/options?locationId=loc-1',
    )
    expect(startRegistrationMock).toHaveBeenCalledTimes(1)
    expect(startRegistrationMock).toHaveBeenCalledWith(
      expect.objectContaining({ optionsJSON: expect.objectContaining({ challenge: 'chal-1' }) }),
    )
    expect(authFetchMock).toHaveBeenCalledWith(
      '/api/settings/webauthn/register',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(toastSuccessMock).toHaveBeenCalledWith(WEBAUTHN_REGISTER_SUCCESS)
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it('options fetch fail → notice + toast.error, ceremony NI klican', async () => {
    const container = await mountBoundWithSupport()
    routeAuthFetch({ options: jsonResponse({ error: 'x' }, false) })

    const register = container.querySelector(`button[aria-label="${WEBAUTHN_REGISTER_ARIA}"]`) as HTMLButtonElement
    click(register)
    await flush(3)

    expect(startRegistrationMock).not.toHaveBeenCalled()
    expect(container.textContent).toContain(WEBAUTHN_REGISTER_ERROR)
    expect(toastErrorMock).toHaveBeenCalledWith(WEBAUTHN_REGISTER_ERROR)
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })

  it('uporabnik prekliče ceremony (startRegistration reject) → notice + toast.error', async () => {
    const container = await mountBoundWithSupport()
    startRegistrationMock.mockRejectedValue(new Error('NotAllowedError'))

    const register = container.querySelector(`button[aria-label="${WEBAUTHN_REGISTER_ARIA}"]`) as HTMLButtonElement
    click(register)
    await flush(4)

    expect(authFetchMock).toHaveBeenCalledWith('/api/auth/webauthn/options?locationId=loc-1')
    expect(container.textContent).toContain(WEBAUTHN_REGISTER_ERROR)
    expect(toastErrorMock).toHaveBeenCalledWith(WEBAUTHN_REGISTER_ERROR)
    // POST register NI šel ven (ceremony je padla prej)
    const postCalls = authFetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/settings/webauthn/register'),
    )
    expect(postCalls).toHaveLength(0)
  })

  it('POST register fail → notice + toast.error', async () => {
    const container = await mountBoundWithSupport()
    startRegistrationMock.mockResolvedValue({ id: 'att-1', response: {} } as Awaited<ReturnType<typeof startRegistration>>)
    routeAuthFetch({ register: jsonResponse({ error: 'x' }, false) })

    const register = container.querySelector(`button[aria-label="${WEBAUTHN_REGISTER_ARIA}"]`) as HTMLButtonElement
    click(register)
    await flush(4)

    expect(container.textContent).toContain(WEBAUTHN_REGISTER_ERROR)
    expect(toastErrorMock).toHaveBeenCalledWith(WEBAUTHN_REGISTER_ERROR)
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })

  it('pending: med tekočo registracijo je gumb disabled (ni dvojnih klikov)', async () => {
    const container = await mountBoundWithSupport()
    // options fetch nikoli ne resolva → register tok ostane pending
    authFetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input)
      if (url.startsWith('/api/locations')) return jsonResponse(MOCK_LOCATIONS)
      if (url.includes('/api/auth/webauthn/options')) return new Promise<Response>(() => {})
      return jsonResponse({ locationId: 'loc-1', credentials: MOCK_CREDENTIALS })
    })

    const register = container.querySelector(`button[aria-label="${WEBAUTHN_REGISTER_ARIA}"]`) as HTMLButtonElement
    click(register)
    await flush(3)

    expect((register as HTMLButtonElement).disabled).toBe(true)
    expect(container.textContent).toContain('Registracija…')
  })
})

// ============================================
// 5) FS-GUARD — hišni stil r93/r95 (readFileSync + source asserti)
// ============================================
function readRepoFile(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split('/')), 'utf-8')
}

describe('R97-a fs-guard (DeviceTab WebAuthn + deps)', () => {
  it('DeviceTab.tsx: uporablja startRegistration + PublicKeyCredential feature detect', () => {
    const src = readRepoFile('src/components/pos/settings/DeviceTab.tsx')
    expect(src).toContain("from '@simplewebauthn/browser'")
    expect(src).toContain('startRegistration(')
    expect(src).toContain('typeof window.PublicKeyCredential')
  })

  it('package.json: obe @simplewebauthn odvisnosti sta deklarirani', () => {
    const pkg = JSON.parse(readRepoFile('package.json')) as { dependencies: Record<string, string> }
    expect(pkg.dependencies['@simplewebauthn/server']).toBeTruthy()
    expect(pkg.dependencies['@simplewebauthn/browser']).toBeTruthy()
  })
})
