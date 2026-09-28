// ============================================
// R154 — useI18n hook + tFor konsolidacija (Issue #44)
// ============================================
// Pokritje:
//   A) Reaktivnost: zustand setLocale → consumer DOM se osveži (sl/en/de)
//   B) Store-sync: setLocale('de') → getLocale()==='de' (@/lib/i18n persist kanon)
//   C) tFor interpolacija ({param} → vrednost)
//   D) Fallback: neobstoječ ključ → ključ sama; manjkajoč EN ključ → SL vrednost
//      (synthetic vi.doMock '@/lib/i18n/common' — v produkciji so ključne
//       mape 1:1 paritete čez 5 jezikov, zato sintetičen primer; dokumentirana
//       odločitev R154-b)
//   E) Persist: setLocale('it') → localStorage['pos_locale']==='it'; nov mount bere it
//   F) Wiring-check (readFileSync, r153-gates vzorec): 10 komponent useI18n,
//      brez starega module importa, KioskBar brez literal naslova, package.json
//      brez next-intl, src/i18n/request.ts ne obstaja, exit ključi ×5 jezikov
//   G) tFor čista funkcija: 5/5 locales → string, ne odvisi od module stanja
//
// Tehnične opombe (r151/r153 kanon): createRoot + act (IS_REACT_ACT_ENVIRONMENT),
// sonner mock (defenzivno proti transitive importom), cleanup
// localStorage/sessionStorage v afterEach, brez @testing-library.
// ============================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import type { Root } from 'react-dom/client'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

import { useI18n } from '@/hooks/useI18n'
import { usePOSStore } from '@/lib/store'
import { getLocale, setLocale, tFor } from '@/lib/i18n'

// React 19 act okolje (jsdom) — potrebno za createRoot render v testih
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// ── mount helperji (r149/r151/r153 kanon: brez @testing-library) ──
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

function unmountAll(): void {
  while (mounted.length) {
    const { root, container } = mounted.pop()!
    act(() => {
      root.unmount()
    })
    container.remove()
  }
  document.body.innerHTML = ''
}

// Consumer z inline t('nav.salesMode') — preverja reaktivnost store → DOM
function LocaleConsumer(): ReactElement {
  const { t } = useI18n()
  return createElement('div', { 'data-testid': 'locale-consumer' }, t('nav.salesMode'))
}

// Wiring read helper (r153-gates vzorec)
const SRC = (rel: string): string => readFileSync(join(process.cwd(), rel), 'utf8')

afterEach(() => {
  unmountAll()
  // store singleton + i18n module var nazaj na kanon privzeto (sl);
  // šele nato clear storage (setLocale piše pos_locale)
  setLocale('sl')
  usePOSStore.setState({ locale: 'sl' })
  localStorage.clear()
  sessionStorage.clear()
  vi.resetModules()
})

// ============================================
// A) Reaktivnost (R154 #44 — glavni namen hooka)
// ============================================
describe('R154 A: reaktivnost useI18n', () => {
  it('setLocale("en") → DOM "Sales mode"; nazaj "sl" → "Prodajni način"', () => {
    const c = mountUI(createElement(LocaleConsumer))
    expect(c.textContent).toBe('Prodajni način')
    act(() => {
      usePOSStore.getState().setLocale('en')
    })
    expect(c.textContent).toBe('Sales mode')
    act(() => {
      usePOSStore.getState().setLocale('sl')
    })
    expect(c.textContent).toBe('Prodajni način')
  })

  it('setLocale("de") → DOM "Verkaufsmodus" (hook t je vezan na store locale)', () => {
    const c = mountUI(createElement(LocaleConsumer))
    act(() => {
      usePOSStore.getState().setLocale('de')
    })
    expect(c.textContent).toBe('Verkaufsmodus')
  })
})

// ============================================
// B) Store-sync (persist kanon: zustand → i18n module → localStorage)
// ============================================
describe('R154 B: store-sync', () => {
  it('setLocale("de") na store-u → getLocale()==="de" iz @/lib/i18n', () => {
    act(() => {
      usePOSStore.getState().setLocale('de')
    })
    expect(usePOSStore.getState().locale).toBe('de')
    expect(getLocale()).toBe('de')
  })
})

// ============================================
// C) tFor interpolacija
// ============================================
describe('R154 C: tFor interpolacija', () => {
  it('tFor("sl","suppliers.packHint.line",{packs:3,...}) vsebuje "3"', () => {
    // DRIFT od naloge: ključ NIMA parametra {line} — realni parametri so
    // packs/packUnit/packQty/baseUnit/baseQty (suppliers-sl.ts:60); {line:3}
    // ne bi proizvedel '3'. Testiramo z realnimi parametri istega ključa.
    const out = tFor('sl', 'suppliers.packHint.line', {
      packs: 3,
      packUnit: 'kos',
      packQty: 0.5,
      baseUnit: 'kos',
      baseQty: 1.5,
    })
    expect(typeof out).toBe('string')
    expect(out).toContain('3')
    expect(out).toBe('≈ 3 × kos po 0.5 kos (1.5 kos)')
  })

  it('tFor zamenja več parametrov ("suppliers.recon.grnSaved")', () => {
    expect(tFor('sl', 'suppliers.recon.grnSaved', { grn: 'GRN-42' })).toBe('GRN-42 zabeležen.')
  })
})

// ============================================
// D) Fallback veriga (SL-fallback + key-ponudba)
// ============================================
describe('R154 D: fallback', () => {
  it('neobstoječ ključ → vrne ključ samo (tako za sl kot en)', () => {
    expect(tFor('sl', 'nek.neobstojec.kljuc')).toBe('nek.neobstojec.kljuc')
    expect(tFor('en', 'nek.neobstojec.kljuc')).toBe('nek.neobstojec.kljuc')
  })

  it('manjkajoč EN ključ → SL vrednost (synthetic common modul)', async () => {
    vi.resetModules()
    vi.doMock('@/lib/i18n/common', () => ({
      commonSl: { 'common.save': 'Shrani' },
      commonEn: {}, // EN IZPRIČNO brez ključa → sili SL-fallback
      commonIt: {},
      commonHr: {},
      commonDe: {},
    }))
    try {
      const mod = await import('@/lib/i18n')
      expect(mod.tFor('en', 'common.save')).toBe('Shrani')
      expect(mod.tFor('it', 'common.save')).toBe('Shrani')
      // ključ, ki manjka POVSEM, ostane ključ
      expect(mod.tFor('en', 'povsem.manjka')).toBe('povsem.manjka')
    } finally {
      vi.doUnmock('@/lib/i18n/common')
      vi.resetModules()
    }
  })
})

// ============================================
// E) Persist (localStorage kanon 'pos_locale')
// ============================================
describe('R154 E: persist', () => {
  it('setLocale("it") → localStorage["pos_locale"]==="it"', () => {
    act(() => {
      usePOSStore.getState().setLocale('it')
    })
    expect(localStorage.getItem('pos_locale')).toBe('it')
    expect(getLocale()).toBe('it')
  })

  it('nov mount bere it iz store-a ("Modalità vendita")', () => {
    act(() => {
      usePOSStore.getState().setLocale('it')
    })
    unmountAll()
    const c = mountUI(createElement(LocaleConsumer))
    expect(c.textContent).toBe('Modalità vendita')
  })
})

// ============================================
// F) Wiring-check (readFileSync, r153-gates vzorec)
// ============================================
describe('R154 F: wiring-check', () => {
  const WIRED = [
    'src/components/pos/sidebar/Sidebar.tsx',
    'src/components/pos/sidebar/SidebarNav.tsx',
    'src/components/pos/sidebar/SidebarBottom.tsx',
    'src/components/pos/command-palette/CommandPalette.tsx',
    'src/components/pos/reorder/ReorderItemCard.tsx',
    'src/components/pos/supplier/InvoiceDialog.tsx',
    'src/components/pos/supplier/POItemRow.tsx',
    'src/components/pos/supplier/PurchaseOrdersList.tsx',
    'src/components/pos/supplier/SupplierCatalog.tsx',
    'src/components/pos/supplier/SupplierPriceHistory.tsx',
  ]

  it('vseh 10 komponent: useI18n hook, BREZ starega module importa t', () => {
    for (const f of WIRED) {
      const src = SRC(f)
      expect(src).toContain("from '@/hooks/useI18n'")
      expect(src).toContain('const { t } = useI18n()')
      expect(src).not.toContain("import { t } from '@/lib/i18n'")
    }
  })

  it('KioskBar: naslov izhoda prek t(), literal (R153 relikt) odstranjen', () => {
    const src = SRC('src/components/pos/KioskBar.tsx')
    expect(src).toContain("t('nav.exitSalesMode')")
    expect(src).toContain("t('nav.exitKioskMode')")
    expect(src).not.toContain('Izhod iz prodajnega načina')
    // KioskPinDialog default ostane kot varnostni default (nespremenjen)
    expect(SRC('src/components/pos/KioskPinDialog.tsx')).toContain("title = 'Izhod iz kiosk načina'")
  })

  it('package.json NE vsebuje next-intl (mrtev paket odstranjen)', () => {
    expect(SRC('package.json')).not.toContain('next-intl')
  })

  it('src/i18n/request.ts NE obstaja (existsSync false)', () => {
    expect(existsSync(join(process.cwd(), 'src', 'i18n', 'request.ts'))).toBe(false)
  })

  it('nav.exitSalesMode + nav.exitKioskMode v vseh 5 jezikih', () => {
    for (const lang of ['sl', 'en', 'it', 'hr', 'de']) {
      const src = SRC(`src/lib/i18n/common/${lang}.ts`)
      expect(src).toContain("'nav.exitSalesMode':")
      expect(src).toContain("'nav.exitKioskMode':")
    }
  })
})

// ============================================
// G) tFor — čista funkcija (pariteta + neodvisnost od module stanja)
// ============================================
describe('R154 G: tFor čista funkcija', () => {
  it('za vseh 5 locales vrne string za nav.salesMode (pariteta ključev)', () => {
    for (const loc of ['sl', 'en', 'it', 'hr', 'de'] as const) {
      const out = tFor(loc, 'nav.salesMode')
      expect(typeof out).toBe('string')
      expect(out.length).toBeGreaterThan(0)
      expect(out).not.toBe('nav.salesMode') // ključ obstaja v vsakem jeziku
    }
  })

  it('tFor ne bere module stanja — ekspliciten locale ima prednost', () => {
    act(() => {
      usePOSStore.getState().setLocale('de')
    })
    // getLocale() je zdaj 'de', a tFor z eksplicitnim locale ostane en
    expect(getLocale()).toBe('de')
    expect(tFor('en', 'nav.salesMode')).toBe('Sales mode')
    // determinizem: isti klic → isti rezultat (brez stranskih učinkov)
    expect(tFor('de', 'nav.salesMode')).toBe(tFor('de', 'nav.salesMode'))
    expect(tFor('de', 'nav.salesMode')).toBe('Verkaufsmodus')
  })
})
