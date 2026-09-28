// ============================================
// R153 — Prodajni način: UI gate-i (KioskBar, bližnjice, wiring)
// ============================================
// Pokritje:
//   A) KioskBar ModuleTabs gate: allowedModules=['orders'] → BREZ tabov
//      (brand ostane); 3 moduli → tab vidni + klik preklopi (kiosk regresija);
//      fallback brez propa bere store (salesMode=true → brez tabov)
//   B) Izhod prek PIN (admin): resetira OBA načina (salesMode + kioskMode)
//   C) KeyboardShortcutsHandler gate: Ctrl+4/Ctrl+5 tiho ignorirana v
//      prodajnem/kiosk načinu; brez načinov navigirata (regresija);
//      Ctrl+N (novo naročilo) deluje TUDI v prodajnem načinu
//   D) Wiring-check (readFileSync, r151 vzorec): page.tsx (KioskBar prop +
//      AIAssistant gate), CommandPalette (moduli filter + admin skoki izpust),
//      GlobalNotifications (low-stock skok), OrderPanel (dining/tokovi/ime-
//      telefon), SidebarBottom gumb, i18n ključi v vseh 5 jezikih
//
// Tehnične opombe (r151-kds-backoff kanon):
//   - @testing-library NI v devDeps → createRoot + act (IS_REACT_ACT_ENVIRONMENT)
//   - sonner mock (kanon — defenzivno proti transitive importom)
//   - CommandPalette mount je prezahteven (cmdk + react-query + navItems) →
//     pokrit z wiring-check (dokumentirana odločitev R153-b)
// ============================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import type { Root } from 'react-dom/client'
import { readFileSync } from 'fs'
import { join } from 'path'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

import { KioskBar } from '@/components/pos/KioskBar'
import { KeyboardShortcutsHandler } from '@/components/pos/keyboard-shortcuts/KeyboardShortcutsHandler'
import { usePOSStore } from '@/lib/store'

// React 19 act okolje (jsdom) — potrebno za createRoot render v testih
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// ── mount helperji (r149/r151 kanon: brez @testing-library) ──
const mounted: { root: Root; container: HTMLElement }[] = []

function mountUI(ui: ReactElement): HTMLElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(ui)
  })
  mounted.push({ root, container })
  return container
}

function findButton(scope: ParentNode, text: string): HTMLButtonElement | undefined {
  return Array.from(scope.querySelectorAll('button')).find((b) => b.textContent?.includes(text))
}

function click(el: HTMLElement): void {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

function pressCtrl(key: string): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, cancelable: true }))
  })
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  // varni default — exit flow test ga po potrebi prepiše
  fetchMock.mockImplementation(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ employee: { role: 'admin' } }),
  }))
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
  vi.unstubAllGlobals()
  localStorage.clear()
  // store singleton: ciljno resetiranje dotaknjenih polj
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
})

// ============================================
// A) KioskBar — ModuleTabs gate
// ============================================
describe('R153 A: KioskBar ModuleTabs gate', () => {
  it('allowedModules=["orders"] → BREZ tabov (Prodaja NI v DOM), brand ostane', () => {
    usePOSStore.setState({ activeModule: 'orders' })
    const c = mountUI(createElement(KioskBar, { allowedModules: ['orders'] }))
    expect(c.textContent).not.toContain('Prodaja')
    expect(c.textContent).not.toContain('Kuhinja')
    expect(c.textContent).not.toContain('Mize')
    // header vseeno pokaže brand
    expect(c.textContent).toContain('RestaurantOS')
  })

  it('3 moduli → tab vidni + klik preklopi modul (kiosk regresija)', () => {
    usePOSStore.setState({ activeModule: 'orders' })
    const c = mountUI(createElement(KioskBar, { allowedModules: ['orders', 'kitchen', 'tables'] }))
    expect(c.textContent).toContain('Prodaja')
    expect(c.textContent).toContain('Kuhinja')
    const kitchenTab = findButton(c, 'Kuhinja')
    expect(kitchenTab).toBeTruthy()
    click(kitchenTab!)
    expect(usePOSStore.getState().activeModule).toBe('kitchen')
  })

  it('fallback brez propa: salesMode=true → store razrešitev = samo orders (brez tabov)', () => {
    usePOSStore.setState({ salesMode: true, activeModule: 'orders' })
    const c = mountUI(createElement(KioskBar))
    expect(c.textContent).not.toContain('Prodaja')
    expect(c.textContent).toContain('RestaurantOS')
  })

  it('fallback brez propa: kioskMode → kioskAllowedModules ostanejo (tab vidni)', () => {
    usePOSStore.setState({ kioskMode: true, activeModule: 'orders' })
    const c = mountUI(createElement(KioskBar))
    expect(c.textContent).toContain('Prodaja')
    expect(c.textContent).toContain('Kuhinja')
  })
})

// ============================================
// B) Izhod prek PIN — resetira OBA načina
// ============================================
describe('R153 B: izhod prek PIN (admin/manager)', () => {
  it('uspešen admin PIN resetira OBA flaga (salesMode + kioskMode)', async () => {
    usePOSStore.setState({ salesMode: true, kioskMode: false })
    fetchMock.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ employee: { role: 'admin' } }),
    }))
    const c = mountUI(createElement(KioskBar))
    const izhod = findButton(c, 'Izhod')
    expect(izhod).toBeTruthy()
    click(izhod!)
    // PIN dialog je odprt (Radix portal → document.body)
    expect(document.body.textContent).toContain('Vnesite administratorski PIN')
    // vpiši 4 števke
    for (const digit of ['2', '4', '6', '8']) {
      const btn = Array.from(document.body.querySelectorAll('button')).find(
        (b) => b.textContent === digit && !b.disabled
      )
      expect(btn).toBeTruthy()
      click(btn!)
    }
    const submit = findButton(document.body, '✓')
    expect(submit).toBeTruthy()
    expect(submit!.disabled).toBe(false)
    await act(async () => {
      submit!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    // R153 odločitev: reset OBEH načinov (idempotentno, brez ujetja v omejen nabor)
    expect(usePOSStore.getState().salesMode).toBe(false)
    expect(usePOSStore.getState().kioskMode).toBe(false)
  })

  it('ne-admin PIN NE resetira načina (dozirana stran)', async () => {
    usePOSStore.setState({ salesMode: true })
    fetchMock.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ employee: { role: 'waiter' } }),
    }))
    const c = mountUI(createElement(KioskBar))
    click(findButton(c, 'Izhod')!)
    for (const digit of ['1', '1', '1', '1']) {
      const btn = Array.from(document.body.querySelectorAll('button')).find(
        (b) => b.textContent === digit && !b.disabled
      )
      click(btn!)
    }
    await act(async () => {
      findButton(document.body, '✓')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(usePOSStore.getState().salesMode).toBe(true)
    expect(document.body.textContent).toContain('Potrebno je dovoljenje administratorja')
  })
})

// ============================================
// C) KeyboardShortcutsHandler — gate Ctrl+1..5
// ============================================
describe('R153 C: KeyboardShortcutsHandler gate (Ctrl+1..5)', () => {
  it('salesMode=true → Ctrl+4 NE navigira na cash-register (tiho ignorirana)', () => {
    usePOSStore.setState({ salesMode: true, activeModule: 'orders' })
    mountUI(createElement(KeyboardShortcutsHandler))
    pressCtrl('4')
    expect(usePOSStore.getState().activeModule).toBe('orders')
  })

  it('kioskMode=true → Ctrl+5 NE navigira na dashboard (tiho ignorirana)', () => {
    usePOSStore.setState({ kioskMode: true, activeModule: 'orders' })
    mountUI(createElement(KeyboardShortcutsHandler))
    pressCtrl('5')
    expect(usePOSStore.getState().activeModule).toBe('orders')
  })

  it('brez omejenih načinov → Ctrl+4 navigira na cash-register (regresija)', () => {
    usePOSStore.setState({ salesMode: false, kioskMode: false, activeModule: 'orders' })
    mountUI(createElement(KeyboardShortcutsHandler))
    pressCtrl('4')
    expect(usePOSStore.getState().activeModule).toBe('cash-register')
  })

  it('salesMode=true → Ctrl+N (novo naročilo) še VEDNO deluje', () => {
    usePOSStore.setState({ salesMode: true })
    const spy = vi.fn()
    window.addEventListener('keyboard:new-order', spy)
    mountUI(createElement(KeyboardShortcutsHandler))
    pressCtrl('n')
    expect(spy).toHaveBeenCalledTimes(1)
    window.removeEventListener('keyboard:new-order', spy)
  })
})

// ============================================
// D) Wiring-check (readFileSync, r151 vzorec)
// ============================================
describe('R153 D: wiring-check — gate-i ožičeni (vključno CommandPalette)', () => {
  const SRC = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8')

  it('page.tsx: KioskBar dobi resolveAllowedModules + AIAssistant gate', () => {
    const src = SRC('src/app/page.tsx')
    expect(src).toContain('{(kioskMode || salesMode) ? (')
    expect(src).toContain('allowedModules={resolveAllowedModules(salesMode, kioskAllowedModules)}')
    expect(src).toContain('{!salesMode && !kioskMode && <AIAssistant />}')
  })

  it('CommandPalette: moduli filter + admin skoki izpust + Novo naročilo/Recents/Artikli ostanejo', () => {
    const src = SRC('src/components/pos/command-palette/CommandPalette.tsx')
    // moduli: filter po dovoljenih (salesMode → orders)
    expect(src).toContain('.filter((item) => !restricted || isModuleAllowed(item.id, allowedModules))')
    // akcije: Dashboard/Nastavitve izpuščeni v omejenih načinih
    expect(src).toContain("a.id !== 'go-dashboard' && a.id !== 'go-settings'")
    expect(src).toContain('{visibleActions.map((action) => (')
    // prazna Moduli skupina se ne upodobi
    expect(src).toContain('{navCommands.length > 0 && (')
    // obdržano: novo naročilo + recents + artikli
    expect(src).toContain("'Novo naročilo'")
    expect(src).toContain('RecentsGroup')
    expect(src).toContain('ArtikliGroup')
  })

  it('GlobalNotifications: low-stock skok skrit v omejenih načinih (poll ostane)', () => {
    const src = SRC('src/components/pos/GlobalNotifications.tsx')
    expect(src).toContain("!salesMode && !kioskMode && lowStockData && lowStockData.count > 0")
    // poll ostane (lowStock query + refetchInterval)
    expect(src).toContain('refetchInterval: 60000')
  })

  it('OrderPanel: dining-options, tokovi in ime/telefon skriti; popust/opomba ostane', () => {
    expect(SRC('src/components/pos/order/OrderTypeBar.tsx')).toContain(
      '{!salesMode && diningOptions && diningOptions.length > 0 && ('
    )
    expect(SRC('src/components/pos/order/OrderCart.tsx')).toContain(
      '!salesMode && onToggleCourses && ('
    )
    const cis = SRC('src/components/pos/order/SubComponents/CustomerInfoSection.tsx')
    expect(cis).toContain('{!salesMode && (\n        <Input placeholder="Ime stranke"')
    expect(cis).toContain('{!salesMode && (\n          <Input placeholder="Telefon"')
    // popust in opomba OBVEZNO ostane (unconditional)
    expect(cis).toContain('aria-label="Popust v evrih"')
    expect(cis).toContain('aria-label="Opombe k naročilu"')
  })

  it('SidebarBottom: gumb Prodajni način + i18n ključi v vseh 5 jezikih', () => {
    expect(SRC('src/components/pos/sidebar/SidebarBottom.tsx')).toContain("t('nav.salesMode')")
    expect(SRC('src/components/pos/sidebar/Sidebar.tsx')).toContain('setSalesMode={setSalesMode}')
    for (const lang of ['sl', 'en', 'it', 'hr', 'de']) {
      expect(SRC(`src/lib/i18n/common/${lang}.ts`)).toContain("'nav.salesMode':")
    }
  })

  it('KioskBar: izhod resetira oba flaga + 1 modul → brez tabov (ožičenje)', () => {
    const src = SRC('src/components/pos/KioskBar.tsx')
    expect(src).toContain('setSalesMode(false)')
    expect(src).toContain('{allowed.length > 1 && (')
  })
})
