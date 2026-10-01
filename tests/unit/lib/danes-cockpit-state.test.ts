// ============================================
// #148 korak 1 (R203) — Danes cockpit state stroj
// ============================================
// Pokritje:
//  1. errorStatus/isAuthError (401/403 vs 429/5xx/neto/malformed)
//  2. deriveDanesSourceState — vseh 6 pravil (ERROR ≠ EMPTY ≠ UNAUTHORIZED ≠ LOADING ≠ READY)
//  3. DANES_SOURCE_PERMISSIONS — fs-pini proti requireAuth v 7 route fajlih (drift-gate)
//  4. danesHasPermission — pariteta s src/lib/auth-middleware/permissions.ts semantiko
//  5. resolveDanesCapabilities — per-vloga scenariji (admin/manager/staff/view_reports/null)
//  6. ALERT_TARGET_MODULE — ekspliciten seznam ≡ 8 tipov iz route fajla (drift-gate),
//     vsi ciljni moduli obstajajo v MODULE_REGISTRY, hevristika odstranjena (negativen pin)
//  7. deriveDanesPageState — UNAUTHORIZED/ERROR/PARTIAL/READY veje
//  8. DanesCockpit.tsx fs-pini (uporablja state stroj, capability vrata, testidi)
//  9. i18n pariteta — 5 novih #148 ključev v vseh 5 jezikih
// ============================================

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import {
  ALERT_FALLBACK_MODULE,
  ALERT_TARGET_MODULE,
  DANES_SOURCE_IDS,
  DANES_SOURCE_PERMISSIONS,
  DanesHttpError,
  alertTargetModule,
  danesHasPermission,
  deriveDanesPageState,
  deriveDanesSourceState,
  errorStatus,
  isAuthError,
  resolveDanesCapabilities,
} from '@/lib/danes/cockpit-state'
import { MODULE_REGISTRY } from '@/lib/modules/registry'
import { cockpitSl, cockpitEn, cockpitIt, cockpitHr, cockpitDe } from '@/lib/i18n/cockpit'
import type { DanesSourceId, DanesSourceState } from '@/lib/danes/cockpit-state'

const repo = (p: string) => resolve(process.cwd(), p)
const read = (p: string) => readFileSync(repo(p), 'utf8')

const shape = (o: Partial<Parameters<typeof deriveDanesSourceState>[0]>) => ({
  isLoading: false,
  isError: false,
  data: {} as unknown,
  error: null as unknown,
  ...o,
})

// — 1. Status izvlečenje iz napak —

describe('errorStatus / isAuthError (#148 P0-B: 401/403 ≠ 429/5xx)', () => {
  it('DanesHttpError status property', () => {
    expect(errorStatus(new DanesHttpError(401))).toBe(401)
    expect(errorStatus(new DanesHttpError(403))).toBe(403)
    expect(errorStatus(new DanesHttpError(500))).toBe(500)
  })

  it('legacy Error("HTTP <status>") format (R175 fetchJson)', () => {
    expect(errorStatus(new Error('HTTP 401'))).toBe(401)
    expect(errorStatus(new Error('HTTP 429'))).toBe(429)
  })

  it('authFetch-style .status property objekt', () => {
    const err = new Error('Forbidden')
    Object.defineProperty(err, 'status', { value: 403 })
    expect(errorStatus(err)).toBe(403)
  })

  it('neto/malformed napake → null (ERROR, NIKOLI UNAUTHORIZED)', () => {
    expect(errorStatus(new Error('Network error'))).toBeNull()
    expect(errorStatus(new SyntaxError('Unexpected token < in JSON'))).toBeNull()
    expect(errorStatus('string error')).toBeNull()
    expect(errorStatus(null)).toBeNull()
    expect(errorStatus(undefined)).toBeNull()
    expect(errorStatus({ status: '401' })).toBeNull() // string status ni številka
    expect(errorStatus({ status: 99 })).toBeNull() // pod HTTP rango
  })

  it('isAuthError: samo 401/403', () => {
    expect(isAuthError(new DanesHttpError(401))).toBe(true)
    expect(isAuthError(new DanesHttpError(403))).toBe(true)
    expect(isAuthError(new Error('HTTP 401'))).toBe(true)
    expect(isAuthError(new DanesHttpError(429))).toBe(false)
    expect(isAuthError(new DanesHttpError(500))).toBe(false)
    expect(isAuthError(new DanesHttpError(503))).toBe(false)
    expect(isAuthError(new Error('rate limited'))).toBe(false)
    expect(isAuthError(null)).toBe(false)
  })
})

// — 2. State stroj per vir —

describe('deriveDanesSourceState (#148 P0-B: 6 pravil, fail-closed)', () => {
  it('pravilo 1: isError + 401/403 → UNAUTHORIZED', () => {
    expect(deriveDanesSourceState(shape({ isError: true, error: new DanesHttpError(401) }))).toBe('UNAUTHORIZED')
    expect(deriveDanesSourceState(shape({ isError: true, error: new Error('HTTP 403') }))).toBe('UNAUTHORIZED')
  })

  it('pravilo 2: isError + 429/5xx/neto → ERROR', () => {
    expect(deriveDanesSourceState(shape({ isError: true, error: new DanesHttpError(429) }))).toBe('ERROR')
    expect(deriveDanesSourceState(shape({ isError: true, error: new DanesHttpError(500) }))).toBe('ERROR')
    expect(deriveDanesSourceState(shape({ isError: true, error: new Error('fetch failed') }))).toBe('ERROR')
  })

  it('pravilo 3: isLoading → LOADING (tudi ob error v prejšnjem teku)', () => {
    expect(deriveDanesSourceState(shape({ isLoading: true }))).toBe('LOADING')
  })

  it('pravilo 4: uspešen odgovor brez data → ERROR (malformed, nikoli "prazno OK")', () => {
    expect(deriveDanesSourceState(shape({ data: undefined }))).toBe('ERROR')
    expect(deriveDanesSourceState(shape({ data: null }))).toBe('ERROR')
  })

  it('pravilo 5: data + isEmpty → EMPTY', () => {
    expect(deriveDanesSourceState(shape({ data: { alerts: [] } }), (d) => (d as { alerts: unknown[] }).alerts.length === 0)).toBe('EMPTY')
    expect(deriveDanesSourceState(shape({ data: {} }), (d) => Object.keys(d as object).length === 0)).toBe('EMPTY')
  })

  it('pravilo 6: data brez isEmpty → READY', () => {
    expect(deriveDanesSourceState(shape({ data: { alerts: [1] } }))).toBe('READY')
    expect(deriveDanesSourceState(shape({ data: { stats: { failed: 0 } } }))).toBe('READY')
  })

  it('R175 false-empty regresija: ERROR pri alerts NIKOLI ne pade v zeleno EMPTY vejo', () => {
    // defekt R175: attention.length===0 je prikazal "Ni izjem" tudi ob napaki virov
    const st = deriveDanesSourceState(shape({ isError: true, error: new DanesHttpError(500), data: undefined }))
    expect(st).toBe('ERROR')
    expect(st).not.toBe('EMPTY')
  })
})

// — 3. Capability matrica: fs-pini proti realnim route fajlom (drift-gate) —

describe('DANES_SOURCE_PERMISSIONS (fs-pini requireAuth × 7 virov)', () => {
  it('vseh 7 virov, noben dopusten/duplikat', () => {
    expect([...DANES_SOURCE_IDS].sort()).toEqual(['alerts', 'cash', 'dashboard', 'kitchen', 'menuStock', 'outbox', 'reservations'])
    expect(DANES_SOURCE_IDS).toHaveLength(7)
  })

  it('pini: alerts → view_reports @ operational-alerts/route.ts', () => {
    expect(DANES_SOURCE_PERMISSIONS.alerts).toEqual(['view_reports'])
    expect(read('src/app/api/operational-alerts/route.ts')).toContain("requireAuth(req, { permission: 'view_reports' })")
  })

  it('pini: kitchen → take_orders @ kitchen/route.ts', () => {
    expect(DANES_SOURCE_PERMISSIONS.kitchen).toEqual(['take_orders'])
    expect(read('src/app/api/kitchen/route.ts')).toContain("requireAuth(req, { permission: 'take_orders' })")
  })

  it('pini: dashboard → view_reports @ dashboard/route.ts', () => {
    expect(DANES_SOURCE_PERMISSIONS.dashboard).toEqual(['view_reports'])
    expect(read('src/app/api/dashboard/route.ts')).toContain("requireAuth(req, { permission: 'view_reports' })")
  })

  it('pini: cash → manage_cash @ cash-register/route.ts', () => {
    expect(DANES_SOURCE_PERMISSIONS.cash).toEqual(['manage_cash'])
    expect(read('src/app/api/cash-register/route.ts')).toContain("requireAuth(req, { permission: 'manage_cash' })")
  })

  it('pini: reservations → take_orders @ reservations/route.ts', () => {
    expect(DANES_SOURCE_PERMISSIONS.reservations).toEqual(['take_orders'])
    expect(read('src/app/api/reservations/route.ts')).toContain("requireAuth(req, { permission: 'take_orders' })")
  })

  it('pini: menuStock → take_orders | manage_inventory (any-of) @ inventory/menu-stock/route.ts', () => {
    expect(DANES_SOURCE_PERMISSIONS.menuStock).toEqual(['take_orders', 'manage_inventory'])
    expect(read('src/app/api/inventory/menu-stock/route.ts')).toContain("permission: ['take_orders', 'manage_inventory']")
  })

  it('pini: outbox GET → view_reports (in POST ostaja admin — ločena površina)', () => {
    expect(DANES_SOURCE_PERMISSIONS.outbox).toEqual(['view_reports'])
    const src = read('src/app/api/outbox/route.ts')
    expect(src).toContain("requireAuth(req, { permission: 'view_reports' })")
    expect(src).toContain("requireAuth(req, { permission: 'admin' })")
  })
})

// — 4/5. Pariteta s strežniško avtorizacijo —

describe('danesHasPermission (pariteta z auth-middleware/permissions.ts hasPermission)', () => {
  it('admin → vedno true', () => {
    expect(danesHasPermission({ role: 'admin', permissions: [] }, ['view_reports'])).toBe(true)
    expect(danesHasPermission({ role: 'admin', permissions: [] }, ['manage_cash'])).toBe(true)
  })

  it('manager → vse non-admin zahteve (admin zahteva bi bila false)', () => {
    expect(danesHasPermission({ role: 'manager', permissions: [] }, ['view_reports'])).toBe(true)
    expect(danesHasPermission({ role: 'manager', permissions: [] }, ['manage_cash'])).toBe(true)
    expect(danesHasPermission({ role: 'manager', permissions: [] }, ['admin'])).toBe(false)
  })

  it('sicer → any-of intersect (some(), == strežniška semantika)', () => {
    expect(danesHasPermission({ role: 'staff', permissions: ['take_orders'] }, ['take_orders'])).toBe(true)
    expect(danesHasPermission({ role: 'staff', permissions: ['manage_inventory'] }, ['take_orders', 'manage_inventory'])).toBe(true)
    expect(danesHasPermission({ role: 'staff', permissions: [] }, ['take_orders'])).toBe(false)
    expect(danesHasPermission(null, ['view_reports'])).toBe(false)
  })
})

describe('resolveDanesCapabilities (per-vloga scenariji)', () => {
  it('admin: vseh 7 virov enabled', () => {
    const caps = resolveDanesCapabilities({ role: 'admin', permissions: [] })
    expect(Object.values(caps).every(Boolean)).toBe(true)
  })

  it('manager: vseh 7 virov enabled (non-admin zahteve)', () => {
    const caps = resolveDanesCapabilities({ role: 'manager', permissions: [] })
    expect(Object.values(caps).every(Boolean)).toBe(true)
  })

  it('view_reports uporabnik (kokpit landing lik): alerts/dashboard/outbox ON; kitchen/cash/menuStock OFF', () => {
    const caps = resolveDanesCapabilities({ role: 'staff', permissions: ['view_reports'] })
    expect(caps.alerts).toBe(true)
    expect(caps.dashboard).toBe(true)
    expect(caps.outbox).toBe(true)
    expect(caps.kitchen).toBe(false)
    expect(caps.cash).toBe(false)
    expect(caps.menuStock).toBe(false)
    expect(caps.reservations).toBe(false)
  })

  it('natakar (take_orders): kitchen/reservations/menuStock ON; finance OFF', () => {
    const caps = resolveDanesCapabilities({ role: 'staff', permissions: ['take_orders'] })
    expect(caps.kitchen).toBe(true)
    expect(caps.reservations).toBe(true)
    expect(caps.menuStock).toBe(true) // any-of: take_orders zadostuje
    expect(caps.alerts).toBe(false)
    expect(caps.dashboard).toBe(false)
    expect(caps.cash).toBe(false)
    expect(caps.outbox).toBe(false)
  })

  it('brez uporabnika: vse OFF (fail-closed)', () => {
    const caps = resolveDanesCapabilities(null)
    expect(Object.values(caps).some(Boolean)).toBe(false)
  })
})

// — 6. Tipizirano usmerjanje alertov (drift-gate proti route fajlu) —

describe('ALERT_TARGET_MODULE (#148: ni startsWith/includes hevristike)', () => {
  it('ekspliciten seznam 8 znanih tipov iz /api/operational-alerts (drift-gate: nov tip v route → rdeč test)', () => {
    const src = read('src/app/api/operational-alerts/route.ts')
    const routeTypes = [...src.matchAll(/type: '([a-z_]+)'/g)].map((m) => m[1]).sort()
    expect(routeTypes).toEqual([...new Set(routeTypes)].sort()) // route ne emitira duplikatov
    expect(Object.keys(ALERT_TARGET_MODULE).sort()).toEqual(routeTypes)
    expect(Object.keys(ALERT_TARGET_MODULE)).toHaveLength(8)
  })

  it('vsak ciljni modul + fallback obstaja v MODULE_REGISTRY', () => {
    for (const mod of [...Object.values(ALERT_TARGET_MODULE), ALERT_FALLBACK_MODULE]) {
      expect(MODULE_REGISTRY.some((m) => m.id === mod), `module ${mod} v registru`).toBe(true)
    }
  })

  it('usmerjanje per tip (deep-link kanon)', () => {
    expect(alertTargetModule('delayed_order')).toBe('kitchen')
    expect(alertTargetModule('kot_not_started')).toBe('kitchen')
    expect(alertTargetModule('unclosed_bill')).toBe('tables')
    expect(alertTargetModule('table_long_occupied')).toBe('tables')
    expect(alertTargetModule('low_stock')).toBe('inventory')
    expect(alertTargetModule('unfiscalized_receipts')).toBe('cash-register')
    expect(alertTargetModule('shift_too_long')).toBe('shifts')
    expect(alertTargetModule('excessive_cancellations')).toBe('reports')
  })

  it('neznan tip → nevtralni fallback dashboard (nikoli hevristično ugibanje)', () => {
    expect(alertTargetModule('unknown_future_type')).toBe('dashboard')
    expect(alertTargetModule('')).toBe('dashboard')
    expect(ALERT_FALLBACK_MODULE).toBe('dashboard')
  })
})

// — 7. Stran kot celota —

describe('deriveDanesPageState (#148: page-level pravilnost)', () => {
  const allOn = Object.fromEntries(DANES_SOURCE_IDS.map((id) => [id, true])) as Record<DanesSourceId, boolean>
  const allOff = Object.fromEntries(DANES_SOURCE_IDS.map((id) => [id, false])) as Record<DanesSourceId, boolean>
  const statesOf = (base: DanesSourceState): Record<DanesSourceId, DanesSourceState> => {
    const out = {} as Record<DanesSourceId, DanesSourceState>
    for (const id of DANES_SOURCE_IDS) out[id] = base
    return out
  }
  const statesMix = (base: DanesSourceState, overrides: Partial<Record<DanesSourceId, DanesSourceState>>): Record<DanesSourceId, DanesSourceState> => ({
    ...statesOf(base),
    ...overrides,
  })

  it('0 aktivnih virov → UNAUTHORIZED', () => {
    expect(deriveDanesPageState(allOff, statesOf('READY'))).toBe('UNAUTHORIZED')
  })

  it('kateri koli aktivni UNAUTHORIZED → UNAUTHORIZED (401 = seja potekla globalno)', () => {
    expect(deriveDanesPageState(allOn, statesMix('READY', { alerts: 'UNAUTHORIZED' }))).toBe('UNAUTHORIZED')
  })

  it('UNAUTHORIZED na disabled viru se ne šteje (disabled ≠ 401)', () => {
    const onlyAlerts = { ...allOff, alerts: true } as Record<DanesSourceId, boolean>
    expect(deriveDanesPageState(onlyAlerts, statesMix('READY', { kitchen: 'UNAUTHORIZED' }))).toBe('READY')
  })

  it('vsi aktivni ERROR → ERROR (celostranska napaka)', () => {
    expect(deriveDanesPageState(allOn, statesOf('ERROR'))).toBe('ERROR')
  })

  it('vsi READY/EMPTY → READY', () => {
    expect(deriveDanesPageState(allOn, statesOf('READY'))).toBe('READY')
    expect(deriveDanesPageState(allOn, statesMix('READY', { reservations: 'EMPTY' }))).toBe('READY')
    expect(deriveDanesPageState(allOn, statesOf('EMPTY'))).toBe('READY')
  })

  it('mešanica READY + ERROR → PARTIAL (per-kartica stanja vidna)', () => {
    expect(deriveDanesPageState(allOn, statesMix('READY', { outbox: 'ERROR' }))).toBe('PARTIAL')
    expect(deriveDanesPageState(allOn, statesMix('READY', { kitchen: 'LOADING' }))).toBe('PARTIAL')
  })
})

// — 8. Komponenta: fs-pini (uporablja state stroj; hevristika odstranjena) —

describe('DanesCockpit.tsx fs-pini (#148 korak 1)', () => {
  const src = read('src/components/pos/danes/DanesCockpit.tsx')

  it('uporablja state stroj + capability matrico', () => {
    expect(src).toContain('resolveDanesCapabilities(authUser)')
    expect(src).toContain('deriveDanesSourceState(')
    expect(src).toContain('deriveDanesPageState(caps, states)')
    expect(src).toContain('alertTargetModule(a.type)')
  })

  it('vseh 7 virov gated z enabled: caps.* (nič se ne kliče brez dovoljenj)', () => {
    for (const id of DANES_SOURCE_IDS) {
      expect(src).toContain(`enabled: caps.${id}`)
    }
  })

  it('negativen pin: startsWith/includes hevristika usmerjanja je odstranjena', () => {
    expect(src).not.toContain("startsWith('delayed')")
    expect(src).not.toContain("type.includes(")
  })

  it('negativen pin: stari agregatni varoval (4/7 virov) je odstranjen', () => {
    expect(src).not.toContain('alerts.isError && kitchen.isError && dash.isError && cash.isError')
  })

  it('testidi: obstoječi R175 + novi #148 stanja', () => {
    const all = [
      'danes-attention-loading',
      'danes-attention-empty',
      'danes-attention-list',
      'danes-attention-error',
      'danes-reservations',
      'danes-system',
      'danes-system-loading',
      'danes-system-error',
      'danes-unauthorized',
      'danes-load-error',
      'danes-cash-error',
      'danes-stock-error',
      'danes-reservations-error',
    ]
    for (const tid of all) {
      expect(src).toContain(tid)
    }
    // strukturni pini: inline data-testid atributi (error kartice gredo prek sourceError helperja)
    for (const tid of [
      'danes-attention-loading',
      'danes-attention-empty',
      'danes-attention-list',
      'danes-system-loading',
      'danes-system-error',
      'danes-unauthorized',
      'danes-load-error',
    ]) {
      expect(src).toContain(`data-testid="${tid}"`)
    }
  })

  it('fail-closed HTTP napaka: fetchJson meče DanesHttpError (status-aware)', () => {
    expect(src).toContain('throw new DanesHttpError(res.status)')
  })
})

// — 9. i18n pariteta ×5 jezikov —

describe('i18n #148 ključi (5 novih × 5 jezikov)', () => {
  const NEW_KEYS = [
    'cockpit.unauthorized',
    'cockpit.noAccess',
    'cockpit.sourceError',
    'cockpit.systemUnknown',
    'cockpit.retry',
  ]
  const MAPS: Array<[string, Record<string, string>]> = [
    ['sl', cockpitSl],
    ['en', cockpitEn],
    ['it', cockpitIt],
    ['hr', cockpitHr],
    ['de', cockpitDe],
  ]

  it('vseh 5 ključev v vseh 5 jezikih, ne-prazne vrednosti', () => {
    for (const [lang, map] of MAPS) {
      for (const key of NEW_KEYS) {
        expect(typeof map[key], `${lang}:${key}`).toBe('string')
        expect(map[key].length, `${lang}:${key}`).toBeGreaterThan(3)
      }
    }
  })
})
