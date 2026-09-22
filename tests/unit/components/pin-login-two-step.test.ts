// ============================================
// Testi za dvostopenjsko prijavo (R95-b) — izbira zaposlenega → PIN
//
// Pokritost (logika, ne piksli):
//   1. resolveDeviceLocation — resolucija device lokacije (URL > localStorage > null)
//   2. buildLoginBody / performLogin — body pinanje: dvostopenjski klic vključuje
//      employeeId, single-step GA NE (PIN-only kontrakt, E2E EDGE-4/15)
//   3. Offline pot — mrežna napaka → verifyOfflinePin (PIN-only, brez employeeId)
//   4. EmployeeSelectStep — render zaposlenih (ime+vloga+aria), error notice,
//      loading skeleton, izbira → onEmployeeSelect callback
//
// Tehnične opombe (hišni stil, glej copy-to-clipboard.test.ts):
//   - unit-vm pool = vmThreads + jsdom → globalov NE stubamo z vi.stubGlobal;
//     fetch je injektiran kot fetchImpl parameter (performLogin je čist helper).
//   - @testing-library NI v devDeps → komponente renderamo z react-dom/client
//     createRoot + act (React 19: act izhaja iz 'react'; jsdom potrebuje
//     IS_REACT_ACT_ENVIRONMENT = true).
// ============================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import type { Root } from 'react-dom/client'

import {
  DEVICE_LOCATION_STORAGE_KEY,
  parseDeviceLocationValue,
  resolveDeviceLocation,
  readDeviceLocation,
  persistDeviceLocation,
} from '@/components/pos/pin-login/resolveDeviceLocation'
import {
  buildLoginBody,
  isNetworkError,
  performLogin,
} from '@/components/pos/pin-login/login-request'
import { authEmployeesQueryKey, EMPLOYEE_SELECT_UNAVAILABLE } from '@/components/pos/pin-login/constants'
import { EmployeeSelectStep } from '@/components/pos/pin-login/EmployeeSelectStep'
import { verifyOfflinePin } from '@/components/pos/pin-login/offline-auth'
import type { AuthUser } from '@/components/pos/pin-login/constants'

// Offline-auth mora biti mockan za offline-pot teste (verifyOfflinePin gre
// proti localStorage cached session-u — tu ga nadomestimo s čistim mockom).
vi.mock('@/components/pos/pin-login/offline-auth', () => ({
  verifyOfflinePin: vi.fn(),
}))

const verifyOfflinePinMock = vi.mocked(verifyOfflinePin)

// React 19 act okolje (jsdom) — potrebno za createRoot render v testih
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// --- Fixture ---
const MOCK_EMPLOYEE: AuthUser = {
  id: 'emp-1',
  name: 'Ana Novak',
  email: 'ana@restavracija.si',
  role: 'staff',
  primaryJob: null,
  permissions: [],
}

/** Minimalen Response-alike objekt (brez globalnega Response — jsdom ga ne jamči). */
function jsonResponse(payload: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 401, json: async () => payload } as unknown as Response
}

// --- Render helperji (brez @testing-library — house minimalen pristop) ---
const mounted: { root: Root; container: HTMLElement }[] = []

function mount(ui: ReactElement): HTMLElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(ui)
  })
  mounted.push({ root, container })
  return container
}

function click(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

afterEach(() => {
  while (mounted.length) {
    const { root, container } = mounted.pop()!
    act(() => {
      root.unmount()
    })
    container.remove()
  }
  localStorage.clear()
  verifyOfflinePinMock.mockReset()
})

// ============================================
// 1) DEVICE LOKACIJA — resolucija virov
// ============================================
describe('resolveDeviceLocation (R95-b)', () => {
  it('URL param ima prednost pred localStorage', () => {
    expect(resolveDeviceLocation({ urlSearch: '?locationId=loc-url', storedRaw: 'loc-store' }))
      .toBe('loc-url')
  })

  it('localStorage (plain string) je drugi vir, ko URL parama ni', () => {
    expect(resolveDeviceLocation({ urlSearch: '', storedRaw: 'loc-store' })).toBe('loc-store')
  })

  it('localStorage JSON-string zapis ("loc-1") se parsira', () => {
    expect(parseDeviceLocationValue('"loc-json"')).toBe('loc-json')
  })

  it('pokvarjen JSON-string zapis → null (varnostneje kot smeti v API klicu)', () => {
    expect(parseDeviceLocationValue('"broken')).toBeNull()
  })

  it('prazen/whitespace/missing localStorage → null', () => {
    expect(parseDeviceLocationValue('')).toBeNull()
    expect(parseDeviceLocationValue('   ')).toBeNull()
    expect(parseDeviceLocationValue(null)).toBeNull()
    expect(parseDeviceLocationValue(undefined)).toBeNull()
  })

  it('prazen URL param (?locationId=) pade na localStorage vir', () => {
    expect(resolveDeviceLocation({ urlSearch: '?locationId=', storedRaw: 'loc-store' }))
      .toBe('loc-store')
  })

  it('brez obeh virov → null (single-step, E2E kompatibilnost)', () => {
    expect(resolveDeviceLocation({ urlSearch: '?drug=param', storedRaw: null })).toBeNull()
    expect(resolveDeviceLocation({})).toBeNull()
  })

  it('plain string se trimira, numerično-viden id ostane string', () => {
    expect(parseDeviceLocationValue('  loc-9  ')).toBe('loc-9')
    expect(parseDeviceLocationValue('42')).toBe('42')
  })

  it('readDeviceLocation: živi window viri (pushState + localStorage)', () => {
    window.history.pushState({}, '', '/?locationId=loc-live-url')
    localStorage.setItem(DEVICE_LOCATION_STORAGE_KEY, 'loc-live-store')
    expect(readDeviceLocation()).toBe('loc-live-url')
    // brez URL parama → localStorage
    window.history.pushState({}, '', '/')
    expect(readDeviceLocation()).toBe('loc-live-store')
    // brez obeh → null
    localStorage.removeItem(DEVICE_LOCATION_STORAGE_KEY)
    expect(readDeviceLocation()).toBeNull()
  })

  it('persistDeviceLocation zapiše samo enkrat (idempotentno potrjevanje)', () => {
    persistDeviceLocation('loc-1')
    expect(localStorage.getItem(DEVICE_LOCATION_STORAGE_KEY)).toBe('loc-1')
    persistDeviceLocation('loc-1') // ista vrednost → brez ponovnega zapisa
    expect(localStorage.getItem(DEVICE_LOCATION_STORAGE_KEY)).toBe('loc-1')
    persistDeviceLocation('loc-2')
    expect(localStorage.getItem(DEVICE_LOCATION_STORAGE_KEY)).toBe('loc-2')
  })
})

// ============================================
// 2) LOGIN BODY + MUTACIJA — employeeId binding kontrakt
// ============================================
describe('buildLoginBody (R95-b)', () => {
  it('dvostopenjski klic: body vključuje employeeId', () => {
    expect(buildLoginBody('1234', 'emp-1')).toEqual({ pin: '1234', employeeId: 'emp-1' })
    expect(JSON.stringify(buildLoginBody('1234', 'emp-1'))).toBe('{"pin":"1234","employeeId":"emp-1"}')
  })

  it('single-step: employeeId ključ je IZPUŠČEN (PIN-only kontrakt)', () => {
    expect(JSON.stringify(buildLoginBody('1234'))).toBe('{"pin":"1234"}')
    expect(JSON.stringify(buildLoginBody('1234', undefined))).toBe('{"pin":"1234"}')
    expect(JSON.stringify(buildLoginBody('1234', ''))).toBe('{"pin":"1234"}')
  })
})

describe('performLogin — fetch body pinanje (R95-b)', () => {
  it('dvostopenjski klic pošlje employeeId v body-ju', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true, employee: MOCK_EMPLOYEE, message: 'dober dan', token: 'tok-1' }))
    const result = await performLogin('1234', 'emp-1', fetchImpl as unknown as typeof fetch)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as { pin: string; employeeId?: string }
    expect(body.pin).toBe('1234')
    expect(body.employeeId).toBe('emp-1')
    expect(result.employee.id).toBe('emp-1')
    expect(result.token).toBe('tok-1')
    expect(result.offline).toBeUndefined()
  })

  it('single-step klic NE pošlje employeeId (undefined → ključ izpuščen)', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true, employee: MOCK_EMPLOYEE, message: 'ok' }))
    await performLogin('1234', undefined, fetchImpl as unknown as typeof fetch)

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.pin).toBe('1234')
    expect('employeeId' in body).toBe(false)
  })

  it('napačen PIN pri dosegljivem strežniku (401) → vrže strežniško napako, NE offline fallback', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'Napačen PIN' }, false))
    await expect(performLogin('9999', 'emp-1', fetchImpl as unknown as typeof fetch))
      .rejects.toThrow('Napačen PIN')
    expect(verifyOfflinePinMock).not.toHaveBeenCalled()
  })
})

// ============================================
// 3) OFFLINE POT — PIN-only (ignorira employeeId)
// ============================================
describe('performLogin — offline fallback (R95-b)', () => {
  it('mrežna napaka (TypeError) → verifyOfflinePin vrne cached session', async () => {
    // Strežnik nedosegljiv — NE gre za napačen PIN
    const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    verifyOfflinePinMock.mockResolvedValue({ employee: MOCK_EMPLOYEE, expiresInMs: 7200000 })

    const result = await performLogin('1234', 'emp-1', fetchImpl as unknown as typeof fetch)

    expect(result.offline).toBe(true)
    expect(result.employee.id).toBe('emp-1')
    // Offline verifikator dobi SAMO pin (cached session je PIN-vezan)
    expect(verifyOfflinePinMock).toHaveBeenCalledTimes(1)
    expect(verifyOfflinePinMock).toHaveBeenCalledWith('1234')
    expect(fetchImpl).toHaveBeenCalledTimes(1) // brez ponovnih poskusov
  })

  it('mrežna napaka + brez cached sessiona → jasen error message', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    verifyOfflinePinMock.mockResolvedValue(null)

    await expect(performLogin('1234', undefined, fetchImpl as unknown as typeof fetch))
      .rejects.toThrow('Strežnik ni dosegljiv in offline prijava ni mogoča — prijavite se enkrat z mrežo')
  })

  it('isNetworkError: TypeError / "Failed to fetch" = mreža; napačen PIN ni', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('Napačen PIN'))).toBe(false)
    expect(isNetworkError('napaka')).toBe(false)
  })
})

// ============================================
// 4) EMPLOYEE SELECT STEP — korak 1 UI (logika + a11y)
// ============================================
describe('EmployeeSelectStep (R95-b)', () => {
  const baseProps = {
    employees: [
      { id: 'emp-1', name: 'Ana Novak', role: 'chef' },
      { id: 'emp-2', name: 'Borut Krajnc', role: 'rare-custom-role' },
    ],
    locationName: 'Ljubljana Center',
    isLoading: false,
    isError: false,
    onEmployeeSelect: vi.fn(),
    onPinOnly: vi.fn(),
  }

  it('render zaposlenih: ime + prevedena vloga + aria-label "Prijava kot <ime>"', () => {
    const onEmployeeSelect = vi.fn()
    const container = mount(createElement(EmployeeSelectStep, {
      ...baseProps,
      onEmployeeSelect,
    }))

    expect(container.textContent).toContain('Ana Novak')
    // znana vloga se prevede prek house mapperja (roleLabels.chef = 'Kuhar')
    expect(container.textContent).toContain('Kuhar')
    // neznana vloga pade na raw vrednost (kontrakt ne jamči enuma)
    expect(container.textContent).toContain('rare-custom-role')
    expect(container.textContent).toContain('Borut Krajnc')

    const anaButton = container.querySelector('button[aria-label="Prijava kot Ana Novak"]')
    expect(anaButton).not.toBeNull()
    // lokacijski badge
    expect(container.querySelector('[aria-label="Lokacija: Ljubljana Center"]')).not.toBeNull()
  })

  it('izbira zaposlenega → onEmployeeSelect callback z { id, name }', () => {
    const onEmployeeSelect = vi.fn()
    const container = mount(createElement(EmployeeSelectStep, {
      ...baseProps,
      onEmployeeSelect,
    }))

    const borutButton = container.querySelector('button[aria-label="Prijava kot Borut Krajnc"]')
    expect(borutButton).not.toBeNull()
    click(borutButton!)
    expect(onEmployeeSelect).toHaveBeenCalledTimes(1)
    expect(onEmployeeSelect).toHaveBeenCalledWith({ id: 'emp-2', name: 'Borut Krajnc' })
  })

  it('error state → muted notice "Izbira zaposlenih ni na voljo", brez gumbov zaposlenih', () => {
    const container = mount(createElement(EmployeeSelectStep, {
      ...baseProps,
      isError: true,
    }))

    expect(container.textContent).toContain(EMPLOYEE_SELECT_UNAVAILABLE)
    expect(container.querySelector('button[aria-label="Prijava kot Ana Novak"]')).toBeNull()
    // ubežna pot ostane dostopna tudi ob napaki (fail-open na UX)
    expect(container.querySelector('button[aria-label="Prijava samo s PIN-om"]')).not.toBeNull()
  })

  it('loading state → 4 skeleton vrstice, brez gumbov zaposlenih', () => {
    const container = mount(createElement(EmployeeSelectStep, {
      ...baseProps,
      isLoading: true,
    }))

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(4)
    expect(container.querySelector('button[aria-label="Prijava kot Ana Novak"]')).toBeNull()
    expect(container.textContent).not.toContain(EMPLOYEE_SELECT_UNAVAILABLE)
  })

  it('gumb "Prijava samo s PIN-om" → onPinOnly callback (single-step ubežna pot)', () => {
    const onPinOnly = vi.fn()
    const container = mount(createElement(EmployeeSelectStep, {
      ...baseProps,
      onPinOnly,
    }))

    const pinOnly = container.querySelector('button[aria-label="Prijava samo s PIN-om"]')
    expect(pinOnly).not.toBeNull()
    click(pinOnly!)
    expect(onPinOnly).toHaveBeenCalledTimes(1)
  })

  it('brez locationName → brez lokacijskega badge-a (endpoint ga ni vrnil)', () => {
    const container = mount(createElement(EmployeeSelectStep, {
      ...baseProps,
      locationName: undefined,
    }))
    expect(container.querySelector('[aria-label^="Lokacija:"]')).toBeNull()
  })
})

// ============================================
// 5) LOKALNA QUERY TIPKA (hierarhična, vzorec R89-2)
// ============================================
describe('authEmployeesQueryKey (R95-b)', () => {
  it('hierarhična lokalna tipka vsebuje deviceLocationId (null vključen)', () => {
    expect(authEmployeesQueryKey('loc-1')).toEqual(['auth', 'employees', 'loc-1'])
    expect(authEmployeesQueryKey(null)).toEqual(['auth', 'employees', null])
  })
})
