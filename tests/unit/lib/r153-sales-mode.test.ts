// ============================================
// R153 — Prodajni način (salesMode): čiste funkcije + store + persist
// ============================================
// Pokritje:
//   A) resolveAllowedModules / isModuleAllowed / SALES_MODE_ALLOWED_MODULES
//      (čiste funkcije, src/lib/sales-mode.ts)
//   B) store: salesMode flag — privzeto false, setSalesMode toggle,
//      clearCart() NE resetira salesMode, neodvisnost od kioskMode
//   C) persist wiring: partialize vključuje salesMode (readFileSync pin po
//      r151 vzorcu + FUNKCIONALNI round-trip prek 'pos-order-session-v1')
//      — sank tablica MORA preživeti refresh (namerna razlika od kioskMode,
//      ki ostane session-only)
//   D) toleranca starih sesij: zapis brez polja → privzeti false
//
// Kanon: pos-ux-recents-pin.test.ts (store import + ciljni reset), r151
// wiring-check (readFileSync). Zustand store je globalni singleton —
// vsak test fajl dobi svež modul registry (vmThreads izolacija).
// ============================================

import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  SALES_MODE_ALLOWED_MODULES,
  isModuleAllowed,
  resolveAllowedModules,
} from '@/lib/sales-mode'
import { usePOSStore } from '@/lib/store'

const STORE_PATH = join(process.cwd(), 'src/lib/store/store.ts')
const SESSION_KEY = 'pos-order-session-v1'

afterEach(() => {
  // ciljno resetiranje dotaknjenih polj globalnega singletona
  usePOSStore.setState({
    salesMode: false,
    kioskMode: false,
    activeModule: 'orders',
    cart: [],
    discount: 0,
    selectedTable: null,
    editingOrderId: null,
    editingOrderNumber: null,
  })
  localStorage.clear()
})

// ============================================
// A) Čiste funkcije (sales-mode.ts)
// ============================================
describe('R153 A: resolveAllowedModules + isModuleAllowed (čiste funkcije)', () => {
  it('prodajni način → SAMO orders (sank — blagajniški nabor)', () => {
    const kioskList = ['orders', 'kitchen', 'tables']
    expect(resolveAllowedModules(true, kioskList)).toEqual(['orders'])
    // vrača kanonični tuple (ni kopije kiosk seznama)
    expect(resolveAllowedModules(true, kioskList)).toBe(SALES_MODE_ALLOWED_MODULES)
  })

  it('brez prodajnega načina → kiosk seznam nespremenjen (isti ref)', () => {
    const kioskList = ['orders', 'kitchen', 'tables']
    expect(resolveAllowedModules(false, kioskList)).toBe(kioskList)
  })

  it('SALES_MODE_ALLOWED_MODULES je tuple z natanko enim modulom: orders', () => {
    expect(SALES_MODE_ALLOWED_MODULES).toEqual(['orders'])
    expect(SALES_MODE_ALLOWED_MODULES.length).toBe(1)
  })

  it('isModuleAllowed matrika (orders dovoljen, admin moduli zavrnjeni)', () => {
    expect(isModuleAllowed('orders', ['orders'])).toBe(true)
    expect(isModuleAllowed('kitchen', ['orders'])).toBe(false)
    expect(isModuleAllowed('dashboard', ['orders'])).toBe(false)
    expect(isModuleAllowed('settings', ['orders'])).toBe(false)
    // sestavljeno: razrešitev → preverba
    expect(isModuleAllowed('kitchen', resolveAllowedModules(true, ['orders', 'kitchen']))).toBe(false)
    expect(isModuleAllowed('kitchen', resolveAllowedModules(false, ['orders', 'kitchen']))).toBe(true)
  })
})

// ============================================
// B) Store — salesMode flag
// ============================================
describe('R153 B: store salesMode flag', () => {
  it('privzeto false', () => {
    expect(usePOSStore.getState().salesMode).toBe(false)
  })

  it('setSalesMode toggle true/false', () => {
    usePOSStore.getState().setSalesMode(true)
    expect(usePOSStore.getState().salesMode).toBe(true)
    usePOSStore.getState().setSalesMode(false)
    expect(usePOSStore.getState().salesMode).toBe(false)
  })

  it('clearCart() NE resetira salesMode (sank sesija preživi počistek košarice)', () => {
    usePOSStore.getState().setSalesMode(true)
    usePOSStore.getState().clearCart()
    expect(usePOSStore.getState().salesMode).toBe(true)
    // in obratno: kioskMode prav tako ne sme biti stransko resetiran
    expect(usePOSStore.getState().kioskMode).toBe(false)
  })

  it('salesMode in kioskMode sta neodvisna flaga', () => {
    usePOSStore.getState().setSalesMode(true)
    expect(usePOSStore.getState().kioskMode).toBe(false)
    usePOSStore.getState().setKioskMode(true)
    usePOSStore.getState().setSalesMode(false)
    expect(usePOSStore.getState().kioskMode).toBe(true)
    expect(usePOSStore.getState().salesMode).toBe(false)
  })
})

// ============================================
// C) Persist — sank tablica preživi refresh
// ============================================
describe('R153 C: persist partialize vključuje salesMode', () => {
  it('wiring-check (readFileSync, r151 vzorec): partialize + persist ključ', () => {
    const src = readFileSync(STORE_PATH, 'utf-8')
    expect(src).toContain('salesMode: state.salesMode')
    expect(src).toContain("name: 'pos-order-session-v1'")
  })

  it('funkcionalni round-trip: setSalesMode → localStorage → rehydrate', () => {
    usePOSStore.getState().setSalesMode(true)
    const raw = localStorage.getItem(SESSION_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!) as { state: { salesMode?: boolean }; version: number }
    expect(parsed.state.salesMode).toBe(true)
    // simulacija refresha: store na false, rehidracija iz shranjenega JSON-a
    usePOSStore.setState({ salesMode: false })
    expect(usePOSStore.getState().salesMode).toBe(false)
    localStorage.setItem(SESSION_KEY, JSON.stringify({ state: parsed.state, version: 1 }))
    void usePOSStore.persist.rehydrate()
    expect(usePOSStore.getState().salesMode).toBe(true)
  })

  it('kioskMode NI v persistu (kontrast: starejši model session-only)', () => {
    usePOSStore.getState().setKioskMode(true)
    const raw = localStorage.getItem(SESSION_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!) as { state: Record<string, unknown> }
    expect('kioskMode' in parsed.state).toBe(false)
    expect('salesMode' in parsed.state).toBe(true) // salesMode se piše (čeprav false)
  })
})

// ============================================
// D) Stare sesije brez polja → varni privzeti false
// ============================================
describe('R153 D: toleranca starih sesij (zustand persist merge)', () => {
  it('zapis brez salesMode polja → rehydrate pusti false', () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ state: { cart: [] }, version: 1 }))
    void usePOSStore.persist.rehydrate()
    expect(usePOSStore.getState().salesMode).toBe(false)
    // košarica iz stare sesije se vseeno rehidrira (merge deluje)
    expect(usePOSStore.getState().cart).toEqual([])
  })
})
