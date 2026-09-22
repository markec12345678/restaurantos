// ============================================
// R99-a — PinLogin WebAuthn device attestation sekcija (webauthn-device.tsx)
// ============================================
// Pokritost (logika, ne piksli):
//   1. Vidnost matrika: brez device lokacije → skrito + ZERO fetch; brez
//      window.PublicKeyCredential → skrito + ZERO fetch; options 503 (kill
//      switch) / omrežna napaka → skrito TIHO (brez error notice); allowCredentials
//      prazen / authentication manjka → skrito; vse OK → gumb z FROZEN
//      label/aria/testid na RELATIVNEM options URL-ju.
//   2. Ceremony (klik): FRESH options fetch (mount-time challenge se NE reusi
//      — 2× options klic), startAuthentication({ optionsJSON }) (v14 object
//      param), POST verify body { assertion, locationId }; uspeh → badge
//      (role="status") + AUTHORITATIVNA lokacija iz odgovora v localStorage +
//      gumb disabled; verify 401 → error notice (role="alert") + persist NI
//      klican + gumb še vedno enabled (retry uspe); startAuthentication reject
//      → isti notice, verify NI klican; pending → disabled + aria-busy.
//   3. fs-guard — FROZEN kontrakt (stringi/testidi) + deps (r93/r95 hišni stil).
//
// Tehnične opombe (mirror r97-device-tab-webauthn.test.ts hišni stil):
//   - unit-vm pool = vmThreads + jsdom → localStorage NATIVEN; assertamo BOTH
//     mock klic IN realen učinek (delni vi.mock z importOriginal).
//   - @testing-library NI v devDeps → createRoot + act (IS_REACT_ACT_ENVIRONMENT).
//   - window.PublicKeyCredential v jsdom NE obstaja → Object.defineProperty
//     (configurable: true za čiščenje); privzeto = platforma NE podpira.
//   - '@simplewebauthn/browser' je MOCKAN (vmThreads + module side effects).
//   - global fetch je vi.stubGlobal mockan (jsdom nima omrežja); router po URL
//     predponi, odgovori kot plain objekti { ok, status, json } (r97 vzorec —
//     brez Response constructorja).
//   - "PIN tok NEZADET" je strukturno garantiran: sekcija je prop-less (nič
//     ne kliče v PIN flow), neuspeh je LOKALNO stanje sekcije — test asserta,
//     da ob neuspehu obstaja notice + gumb enabled + persist NI šel ven.
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

import { startAuthentication } from '@simplewebauthn/browser'
import {
  DEVICE_LOCATION_STORAGE_KEY,
  persistDeviceLocation,
} from '@/components/pos/pin-login/resolveDeviceLocation'
import {
  WebAuthnDeviceSection,
} from '@/components/pos/pin-login/webauthn-device'
import {
  PIN_WEBAUTHN_BUTTON_LABEL,
  PIN_WEBAUTHN_BUTTON_ARIA,
  PIN_WEBAUTHN_ATTESTED_BADGE,
  PIN_WEBAUTHN_ERROR_NOTICE,
} from '@/components/pos/pin-login/constants'

// Realen @simplewebauthn/browser se ne naloži (vmThreads + module side
// effects); ceremony tok ga izvaja → stub z nadzorovano resolucijo/rejekcijo.
vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: vi.fn(),
}))

// DELNI mock resolveDeviceLocation: readDeviceLocation ostane REALen (jsdom
// localStorage + window.location.search) — sekcija je vezana na pravi binding.
vi.mock('@/components/pos/pin-login/resolveDeviceLocation', async importOriginal => {
  const actual = await importOriginal<typeof import('@/components/pos/pin-login/resolveDeviceLocation')>()
  return {
    ...actual,
    persistDeviceLocation: vi.fn((locationId: string) => actual.persistDeviceLocation(locationId)),
  }
})

const startAuthenticationMock = vi.mocked(startAuthentication)
const persistMock = vi.mocked(persistDeviceLocation)

// React 19 act okolje (jsdom) — potrebno za createRoot render v testih
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// --- Fixture: options odgovor (R97-a kontrakt) z enim registriranim ključem ---
const OPTIONS_JSON = {
  location: { id: 'loc-1', name: 'Test Lokacija' },
  challenge: 'chal-mount',
  rpID: 'localhost',
  registration: { challenge: 'chal-mount' },
  authentication: {
    challenge: 'chal-mount',
    allowCredentials: [{ id: 'cred-1', type: 'public-key', transports: ['internal'] }],
  },
}

const ASSERTION_FIXTURE = {
  id: 'cred-1',
  response: { clientDataJSON: 'cjAtclientData', authenticatorData: 'cjAtauth', signature: 'sig-1' },
}

const AUTHORITATIVE_LOCATION = { id: 'loc-9', name: 'Avtoritativna Lokacija' }

function jsonResponse(payload: unknown, ok = true, status?: number): Response {
  return { ok, status: status ?? (ok ? 200 : 500), json: async () => payload } as unknown as Response
}

/** Delni kopi String(input) — fetch mock router. */
function urlOf(call: unknown[]): string {
  return String(call[0])
}

type FetchRouter = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const fetchMock = vi.fn()

/** Zamenjaj global fetch (jsdom nima omrežja) — privzeto vse zeleno. */
function routeFetch(overrides: { options?: Response; verify?: Response } = {}): void {
  let optionsCalls = 0
  const impl: FetchRouter = async input => {
    const url = String(input)
    if (url === '/api/auth/webauthn/verify') {
      return overrides.verify ?? jsonResponse({ location: AUTHORITATIVE_LOCATION })
    }
    if (url.startsWith('/api/auth/webauthn/options')) {
      optionsCalls += 1
      return overrides.options ?? jsonResponse(OPTIONS_JSON)
    }
    return jsonResponse({ error: 'unrouted' }, false)
  }
  fetchMock.mockImplementation(impl)
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

// --- Render helperji (mirror r97-device-tab-webauthn.test.ts) ---
const mounted: { root: Root; container: HTMLElement }[] = []

function mountSection(): HTMLElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(createElement(QueryClientProvider, { client: queryClient }, createElement(WebAuthnDeviceSection)))
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

function queryButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector('button[data-testid="pin-webauthn-button"]')
}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState({}, '', '/')
  fetchMock.mockReset()
  // jsdom nima omrežja → global fetch je mockan (r97 mocka authFetch modul;
  // sekcija uporablja plain fetch — javni endpointi, brez seje na prijavi)
  vi.stubGlobal('fetch', fetchMock)
  startAuthenticationMock.mockReset()
  persistMock.mockClear()
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
  vi.unstubAllGlobals()
  localStorage.clear()
})

// ============================================
// 1) VIDNOST — lokacija + feature detect + options vrata
// ============================================
describe('WebAuthnDeviceSection vidnost (R99-a)', () => {
  it('brez device lokacije → skrito + ZERO fetch (tudi s podporo)', async () => {
    setWebauthnSupported(true)
    routeFetch()
    const container = mountSection()
    await flush(3)

    expect(container.textContent).not.toContain(PIN_WEBAUTHN_BUTTON_LABEL)
    // zero fetch: enabled vrata (location != null && supported) niso odprta
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('brez window.PublicKeyCredential → skrito + ZERO fetch (tudi vezana naprava)', async () => {
    setWebauthnSupported(false)
    localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, 'loc-1')
    routeFetch()
    const container = mountSection()
    await flush(3)

    expect(container.textContent).not.toContain(PIN_WEBAUTHN_BUTTON_LABEL)
    // feature-detect zavrne TUDI options fetch (API ne vidi zahtevka)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('options 503 (kill switch) → skrito TIHO: brez gumba, brez error notice', async () => {
    setWebauthnSupported(true)
    localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, 'loc-1')
    routeFetch({ options: jsonResponse({ error: 'x' }, false, 503) })
    const container = mountSection()
    await flush(3)

    expect(container.textContent).not.toContain(PIN_WEBAUTHN_BUTTON_LABEL)
    // tiho — operater je izklopil feature: error notice je SAMO za ceremony
    expect(container.textContent).not.toContain(PIN_WEBAUTHN_ERROR_NOTICE)
    expect(container.querySelector('[data-testid="pin-webauthn-error"]')).toBeNull()
    // fetch je bil (enkrat) — ampak query je error → sekcija skrita
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(urlOf(fetchMock.mock.calls[0])).toBe('/api/auth/webauthn/options?locationId=loc-1')
  })

  it('options omrežna napaka (fetch reject) → isto skrito', async () => {
    setWebauthnSupported(true)
    localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, 'loc-1')
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const container = mountSection()
    await flush(3)

    expect(container.textContent).not.toContain(PIN_WEBAUTHN_BUTTON_LABEL)
    expect(container.textContent).not.toContain(PIN_WEBAUTHN_ERROR_NOTICE)
  })

  it('allowCredentials prazen array → skrito (ni registriranih ključev na lokaciji)', async () => {
    setWebauthnSupported(true)
    localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, 'loc-1')
    routeFetch({
      options: jsonResponse({
        ...OPTIONS_JSON,
        authentication: { challenge: 'chal-mount', allowCredentials: [] },
      }),
    })
    const container = mountSection()
    await flush(3)

    expect(container.textContent).not.toContain(PIN_WEBAUTHN_BUTTON_LABEL)
    expect(container.textContent).not.toContain(PIN_WEBAUTHN_ERROR_NOTICE)
  })

  it('authentication options manjkajo → skrito (defenzivno)', async () => {
    setWebauthnSupported(true)
    localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, 'loc-1')
    routeFetch({
      options: jsonResponse({ location: OPTIONS_JSON.location, challenge: 'chal-mount' }),
    })
    const container = mountSection()
    await flush(3)

    expect(container.textContent).not.toContain(PIN_WEBAUTHN_BUTTON_LABEL)
  })

  it('vse OK → gumb vidn: FROZEN label/aria/testid, outline, min-h-11, RELATIVEN options URL', async () => {
    setWebauthnSupported(true)
    localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, 'loc-1')
    routeFetch()
    const container = mountSection()
    await flush(3)

    const button = queryButton(container)
    expect(button).not.toBeNull()
    expect(button!.textContent).toContain(PIN_WEBAUTHN_BUTTON_LABEL)
    expect(button!.getAttribute('aria-label')).toBe(PIN_WEBAUTHN_BUTTON_ARIA)
    expect(button!.className).toContain('min-h-11')
    expect(button!.className).toContain('border') // outline variant (shadcn)
    // RELATIVNA pot — gateway kanon
    expect(urlOf(fetchMock.mock.calls[0])).toBe('/api/auth/webauthn/options?locationId=loc-1')
    // gumb NI disabled in NI pending pred ceremony
    expect(button!.disabled).toBe(false)
    expect(button!.getAttribute('aria-busy')).toBe('false')
  })
})

// ============================================
// 2) CEREMONY — klik → fresh options → assertion → verify
// ============================================
describe('WebAuthnDeviceSection ceremony (R99-a)', () => {
  it('uspeh → FRESH options (2× klic), startAuthentication { optionsJSON }, authoritative persist, badge, gumb disabled', async () => {
    setWebauthnSupported(true)
    localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, 'loc-1')
    routeFetch()
    startAuthenticationMock.mockResolvedValue(ASSERTION_FIXTURE as Awaited<ReturnType<typeof startAuthentication>>)
    const container = mountSection()
    await flush(3)

    click(queryButton(container)!)
    await flush(4)

    // v14 object-param + optionsJSON z challenge (fresh fetch = mount challenge)
    expect(startAuthenticationMock).toHaveBeenCalledTimes(1)
    expect(startAuthenticationMock).toHaveBeenCalledWith(
      expect.objectContaining({ optionsJSON: expect.objectContaining({ challenge: 'chal-mount' }) }),
    )
    // options klican 2× (mount query + FRESH handler fetch — cache se NE reusi)
    const optionsCalls = fetchMock.mock.calls.filter((c) =>
      urlOf(c).startsWith('/api/auth/webauthn/options'),
    )
    expect(optionsCalls).toHaveLength(2)
    // POST verify z assertion + locationId (device lokacija iz options klica)
    const verifyCall = fetchMock.mock.calls.find((c) => urlOf(c) === '/api/auth/webauthn/verify')
    expect(verifyCall).toBeDefined()
    expect((verifyCall![1] as RequestInit).method).toBe('POST')
    expect(JSON.parse(String((verifyCall![1] as RequestInit).body))).toEqual({
      assertion: ASSERTION_FIXTURE,
      locationId: 'loc-1',
    })
    // AUTHORITATIVNA lokacija iz odgovora (loc-9, NE deviceLocationId loc-1)
    expect(persistMock).toHaveBeenCalledWith('loc-9')
    expect(localStorage.getItem(DEVICE_LOCATION_STORAGE_KEY)).toBe('loc-9')
    // badge (FROZEN string, role="status") + gumb disabled po uspehu
    const badge = container.querySelector('[data-testid="pin-webauthn-attested"]')
    expect(badge).not.toBeNull()
    expect(badge!.getAttribute('role')).toBe('status')
    expect(badge!.textContent).toBe(PIN_WEBAUTHN_ATTESTED_BADGE)
    expect(queryButton(container)!.disabled).toBe(true)
    expect(container.querySelector('[data-testid="pin-webauthn-error"]')).toBeNull()
  })

  it('verify 401 → error notice (role="alert", FROZEN), persist NI klican, gumb še vedno enabled; retry uspe', async () => {
    setWebauthnSupported(true)
    localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, 'loc-1')
    routeFetch({ verify: jsonResponse({ error: 'WebAuthn verifikacija ni uspela.' }, false, 401) })
    startAuthenticationMock.mockResolvedValue(ASSERTION_FIXTURE as Awaited<ReturnType<typeof startAuthentication>>)
    const container = mountSection()
    await flush(3)

    click(queryButton(container)!)
    await flush(4)

    const error = container.querySelector('[data-testid="pin-webauthn-error"]')
    expect(error).not.toBeNull()
    expect(error!.getAttribute('role')).toBe('alert')
    expect(error!.textContent).toBe(PIN_WEBAUTHN_ERROR_NOTICE)
    // PIN tok NEZADET: noben persist, localStorage nespremenjen
    expect(persistMock).not.toHaveBeenCalled()
    expect(localStorage.getItem(DEVICE_LOCATION_STORAGE_KEY)).toBe('loc-1')
    // fail-open: gumb ostane omogočen (poskusimo ponovno), badge NI prikazan
    const button = queryButton(container)!
    expect(button.disabled).toBe(false)
    expect(container.querySelector('[data-testid="pin-webauthn-attested"]')).toBeNull()

    // ponovni poskus: verify zdej uspešn → notice izgine, badge pride, gumb disabled
    routeFetch()
    click(button)
    await flush(4)

    expect(container.querySelector('[data-testid="pin-webauthn-error"]')).toBeNull()
    expect(container.querySelector('[data-testid="pin-webauthn-attested"]')).not.toBeNull()
    expect(persistMock).toHaveBeenCalledWith('loc-9')
    expect(queryButton(container)!.disabled).toBe(true)
  })

  it('ceremony reject (startAuthentication throws) → isti notice, verify NI klican, gumb enabled', async () => {
    setWebauthnSupported(true)
    localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, 'loc-1')
    routeFetch()
    startAuthenticationMock.mockRejectedValue(new Error('NotAllowedError'))
    const container = mountSection()
    await flush(3)

    click(queryButton(container)!)
    await flush(4)

    const error = container.querySelector('[data-testid="pin-webauthn-error"]')
    expect(error).not.toBeNull()
    expect(error!.getAttribute('role')).toBe('alert')
    expect(error!.textContent).toBe(PIN_WEBAUTHN_ERROR_NOTICE)
    // ceremony je padla PRED verify POST-om
    const verifyCalls = fetchMock.mock.calls.filter((c) => urlOf(c) === '/api/auth/webauthn/verify')
    expect(verifyCalls).toHaveLength(0)
    expect(persistMock).not.toHaveBeenCalled()
    expect(queryButton(container)!.disabled).toBe(false)
  })

  it('pending: med ceremony je gumb disabled + aria-busy (NI dvojnih klikov)', async () => {
    setWebauthnSupported(true)
    localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, 'loc-1')
    // FRESH options fetch (2. options klic) NIKOLI ne resolva → ceremony pending
    let optionsCalls = 0
    const impl: FetchRouter = async input => {
      const url = String(input)
      if (url.startsWith('/api/auth/webauthn/options')) {
        optionsCalls += 1
        if (optionsCalls >= 2) return new Promise<Response>(() => {})
        return jsonResponse(OPTIONS_JSON)
      }
      return jsonResponse({ error: 'unrouted' }, false)
    }
    fetchMock.mockImplementation(impl)
    const container = mountSection()
    await flush(3)

    click(queryButton(container)!)
    await flush(3)

    const button = queryButton(container)!
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(startAuthenticationMock).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="pin-webauthn-error"]')).toBeNull()
  })
})

// ============================================
// 3) FS-GUARD — FROZEN kontrakt + deps (hišni stil r93/r95)
// ============================================
function readRepoFile(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split('/')), 'utf-8')
}

describe('R99-a fs-guard (PinLogin WebAuthn kontrakt)', () => {
  it('webauthn-device.tsx: FROZEN konstante v uporabi + startAuthentication + feature detect + testidi', () => {
    const src = readRepoFile('src/components/pos/pin-login/webauthn-device.tsx')
    expect(src).toContain('PIN_WEBAUTHN_BUTTON_LABEL')
    expect(src).toContain('PIN_WEBAUTHN_BUTTON_ARIA')
    expect(src).toContain('PIN_WEBAUTHN_ATTESTED_BADGE')
    expect(src).toContain('PIN_WEBAUTHN_ERROR_NOTICE')
    expect(src).toContain("from '@simplewebauthn/browser'")
    expect(src).toContain('startAuthentication(')
    expect(src).toContain('typeof window.PublicKeyCredential')
    expect(src).toContain('persistDeviceLocation')
    expect(src).toContain('readDeviceLocation')
    expect(src).toContain('pin-webauthn-button')
    expect(src).toContain('pin-webauthn-attested')
    expect(src).toContain('pin-webauthn-error')
  })

  it('constants.ts: FROZEN stringi byte-točno (R99-b e2e kontrakt)', () => {
    const src = readRepoFile('src/components/pos/pin-login/constants.ts')
    expect(src).toContain("PIN_WEBAUTHN_BUTTON_LABEL = 'Prijava s ključem naprave'")
    expect(src).toContain("PIN_WEBAUTHN_BUTTON_ARIA = 'Prijava z WebAuthn ključem naprave'")
    expect(src).toContain("PIN_WEBAUTHN_ATTESTED_BADGE = 'Naprava potrjena s ključem'")
    expect(src).toContain("PIN_WEBAUTHN_ERROR_NOTICE = 'Prijava s ključem ni uspela — uporabite PIN.'")
  })

  it('PinLogin.tsx: sekcija je dejansko integrirana (aditivno)', () => {
    const src = readRepoFile('src/components/pos/PinLogin.tsx')
    expect(src).toContain('WebAuthnDeviceSection')
    expect(src).toContain("from './pin-login/webauthn-device'")
  })

  it('package.json: obe @simplewebauthn odvisnosti sta deklarirani', () => {
    const pkg = JSON.parse(readRepoFile('package.json')) as { dependencies: Record<string, string> }
    expect(pkg.dependencies['@simplewebauthn/server']).toBeTruthy()
    expect(pkg.dependencies['@simplewebauthn/browser']).toBeTruthy()
  })
})
