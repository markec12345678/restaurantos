// ============================================
// MODULE REGISTRY — drift-gate (§6, epic #144, R173)
// ============================================
//
// Uveljavlja invarianto centralnega registra (src/lib/modules/registry.ts):
//   register ≡ navItems ≡ moduleComponents ≡ i18n ×5 jezikov
//   + canAccessModule pariteta z Sidebar semantiko (8 uporabniških likov × 75)
//
// Kanon vzorcev (r147/r148/r149): fs-pini z regexi za vire, ki jih ni smiselno
// importirati (module-registry.tsx ima JSX/dynamic), import za čiste podatke
// (navItems, registry, tFor). 29 testov = pini R173 baseline.
// ============================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MODULE_REGISTRY,
  MODULE_IDS,
  MODULE_GROUPS,
  DOMAIN_BY_GROUP,
  CORE_MODULE_IDS,
  canAccessModule,
  type ModuleAccessUser,
} from '@/lib/modules/registry'
import { navItems, navGroups } from '@/components/pos/sidebar/navItems'
import { tFor, type Locale } from '@/lib/i18n'

const root = process.cwd()
const readSrc = (...p: string[]): string => readFileSync(join(root, ...p), 'utf-8')

const registryTsxSrc = readSrc('src', 'app', 'components', 'module-registry.tsx')
const navItemsSrc = readSrc('src', 'components', 'pos', 'sidebar', 'navItems.ts')

// fs-parse: ključi iz `export const moduleComponents: Record<...> = { ... }`
const moduleMapSlice = registryTsxSrc.slice(
  registryTsxSrc.indexOf('export const moduleComponents'),
  registryTsxSrc.indexOf('// AIAssistant je vedno prisotna'),
)
const moduleMapKeys = [
  ...moduleMapSlice.matchAll(/^\s+'?([a-z][a-z0-9-]*)'?:\s+[A-Z][A-Za-z0-9]*,\s*$/gm),
].map((m) => m[1])

// fs-parse: lucide ikona iz navItems vnosov (`{ id: 'x', labelKey: 'y', icon: Z, ...`)
const navIconById = new Map(
  [...navItemsSrc.matchAll(/\{ id: '([^']+)', labelKey: '[^']+', icon: ([A-Za-z0-9]+)/g)].map(
    (m) => [m[1], m[2]],
  ),
)

const LOCALES: Locale[] = ['sl', 'en', 'it', 'hr', 'de']

/** 8 uporabniških likov — realne vloge iz praks (admin/manager + 6 operativnih) */
const EIGHT_USERS: { name: string; user: ModuleAccessUser }[] = [
  { name: 'admin', user: { role: 'admin', permissions: [] } },
  { name: 'manager', user: { role: 'manager', permissions: [] } },
  { name: 'natakar', user: { role: 'server', permissions: ['take_orders'] } },
  { name: 'blagajnik', user: { role: 'cashier', permissions: ['manage_cash', 'take_orders'] } },
  { name: 'kuhar', user: { role: 'chef', permissions: ['take_orders'] } },
  { name: 'vodja ekip', user: { role: 'supervisor', permissions: ['manage_employees', 'view_reports'] } },
  { name: 'analitik', user: { role: 'analyst', permissions: ['view_reports'] } },
  { name: 'brez dovoljenj', user: { role: 'staff', permissions: [] } },
]

// Referenčna implementacija — 1:1 iz dveh klicevalskih mest (NE iz registryja):
//   Sidebar.tsx:56–61 (visibleNavItems filter)
//   pin-login/usePinAuth.ts (hasPermission)
function refHasPermission(user: ModuleAccessUser, permission: string): boolean {
  if (user.role === 'admin' || user.role === 'manager') return true
  return user.permissions.includes(permission) || user.permissions.includes('admin')
}
function refCanAccess(user: ModuleAccessUser | null, item: { adminOnly?: boolean; permission?: string }): boolean {
  if (!user) return false
  if (item.adminOnly && user.role !== 'admin' && user.role !== 'manager') return false
  if (item.permission && !refHasPermission(user, item.permission)) return false
  return true
}

// — Struktura §6 —

describe('Module Registry (§6): struktura', () => {
  it('vsebuje točno 75 modulov; MODULE_IDS brez duplikatov', () => {
    expect(MODULE_REGISTRY).toHaveLength(75)
    expect(MODULE_IDS).toHaveLength(75)
    expect(new Set(MODULE_IDS).size).toBe(75)
  })

  it('7 skupin; labele ≡ navGroups.label (hardcoded SL, dokumentirana sodba)', () => {
    expect(MODULE_GROUPS).toHaveLength(7)
    expect(MODULE_GROUPS.map((g) => g.id)).toEqual(navGroups.map((g) => g.id))
    expect(MODULE_GROUPS.map((g) => g.label)).toEqual(navGroups.map((g) => g.label))
  })

  it('DOMAIN_BY_GROUP: vsi 7 group-id → domena; 6 domen v uporabi; meta.domain izpeljan', () => {
    const groupIds = MODULE_GROUPS.map((g) => g.id)
    for (const id of groupIds) expect(DOMAIN_BY_GROUP[id]).toBeDefined()
    expect(new Set(Object.values(DOMAIN_BY_GROUP)).size).toBe(6)
    for (const meta of MODULE_REGISTRY) {
      expect(meta.domain).toBe(DOMAIN_BY_GROUP[meta.group])
    }
  })

  it('vsak modul ima popolna §6 polja (labelKey/icon/group/priority/mobile/relatedModules)', () => {
    for (const meta of MODULE_REGISTRY) {
      expect(meta.labelKey, meta.id).toMatch(/^nav\./)
      expect(meta.icon.length, meta.id).toBeGreaterThan(0)
      expect(MODULE_GROUPS.some((g) => g.id === meta.group), meta.id).toBe(true)
      expect(['core', 'secondary', 'long-tail']).toContain(meta.priority)
      expect(typeof meta.mobile, meta.id).toBe('boolean')
      expect(Array.isArray(meta.relatedModules), meta.id).toBe(true)
    }
  })

  it('dostopno pravilo: točno eno (permission XOR adminOnly); kanon 4 dovoljenja; 43/32', () => {
    const PERMS = ['take_orders', 'manage_cash', 'manage_employees', 'view_reports']
    let withPermission = 0
    let adminOnly = 0
    for (const meta of MODULE_REGISTRY) {
      const hasP = meta.permission !== undefined
      const hasA = meta.adminOnly === true
      expect(hasP !== hasA, `točno eno pravilo za ${meta.id}`).toBe(true)
      if (hasP) {
        expect(PERMS, meta.id).toContain(meta.permission)
        withPermission++
      } else {
        adminOnly++
      }
    }
    expect(withPermission).toBe(43)
    expect(adminOnly).toBe(32)
  })

  it('relatedModules: cilji obstajajo v registryju, brez samoreferenc, 1–4 na modul', () => {
    const ids = new Set(MODULE_IDS)
    for (const meta of MODULE_REGISTRY) {
      expect(meta.relatedModules.length, meta.id).toBeGreaterThanOrEqual(1)
      expect(meta.relatedModules.length, meta.id).toBeLessThanOrEqual(4)
      for (const rel of meta.relatedModules) {
        expect(ids.has(rel), `${meta.id} → ${rel}`).toBe(true)
        expect(rel, meta.id).not.toBe(meta.id)
      }
    }
  })

  it('priority: core = točno Golden Path semena (12); long-tail = 14; secondary = 49', () => {
    const CORE_SEED = [
      'orders', 'kitchen', 'floor-plan', 'tables', 'cash-register', 'menu',
      'inventory', 'employees', 'reservations', 'dashboard', 'reports', 'settings',
    ]
    expect(CORE_MODULE_IDS).toHaveLength(12)
    // vrstni red registerja = navItems vrstni red (ne sodbe-seznam) — zato sort
    expect([...CORE_MODULE_IDS].sort()).toEqual([...CORE_SEED].sort())
    expect(MODULE_REGISTRY.filter((m) => m.priority === 'long-tail')).toHaveLength(14)
    expect(MODULE_REGISTRY.filter((m) => m.priority === 'secondary')).toHaveLength(49)
  })

  it('labelKey unikatni (75 različnih i18n ključev)', () => {
    expect(new Set(MODULE_REGISTRY.map((m) => m.labelKey)).size).toBe(75)
  })
})

// — Drift-gate: register ≡ navItems ≡ moduleComponents —

describe('Module Registry (§6): drift-gate navItems / moduleComponents', () => {
  it('id-ji ≡ navItems (isti vrstni red, element-wise)', () => {
    expect(MODULE_IDS).toEqual(navItems.map((n) => n.id))
  })

  it('labelKey ≡ navItems.labelKey (per id)', () => {
    for (const meta of MODULE_REGISTRY) {
      const nav = navItems.find((n) => n.id === meta.id)
      expect(nav, meta.id).toBeDefined()
      expect(meta.labelKey, meta.id).toBe(nav?.labelKey)
    }
  })

  it('ikone ≡ navItems.icon (fs-parse lucide imena)', () => {
    expect(navIconById.size).toBe(75)
    for (const meta of MODULE_REGISTRY) {
      expect(meta.icon, meta.id).toBe(navIconById.get(meta.id))
    }
  })

  it('dostop ≡ navItems (permission/adminOnly per id)', () => {
    for (const meta of MODULE_REGISTRY) {
      const nav = navItems.find((n) => n.id === meta.id)
      expect(meta.permission, meta.id).toBe(nav?.permission)
      expect(meta.adminOnly, meta.id).toBe(nav?.adminOnly)
    }
  })

  it('skupine ≡ navGroups (članstvo 75↔75; vrstni red pina test 9/navGroups render)', () => {
    // INVARIANTA je ČLANSTVO (set); vrstni red znotraj skupine se razlikuje
    // med navItems (register) in navGroups.itemIds (render vir) po naravi —
    // drift-gate pina registre, ne dveh ločenih vrstnih redov.
    for (const group of navGroups) {
      const registryIds = MODULE_REGISTRY.filter((m) => m.group === group.id).map((m) => m.id)
      expect([...registryIds].sort(), group.id).toEqual([...group.itemIds].sort())
    }
  })

  it('fs: moduleComponents map ima točno 75 vnosov', () => {
    expect(moduleMapKeys).toHaveLength(75)
  })

  it('fs: moduleComponents ključi ≡ MODULE_IDS (75↔75 invarianta)', () => {
    expect([...moduleMapKeys].sort()).toEqual([...MODULE_IDS].sort())
  })
})

// — Drift-gate: i18n ×5 —

describe('Module Registry (§6): i18n drift-gate (5 jezikov)', () => {
  it('labelKey se razreši v vseh 5 jezikih prek tFor (non-empty, ≠ ključ)', () => {
    for (const locale of LOCALES) {
      for (const meta of MODULE_REGISTRY) {
        const resolved = tFor(locale, meta.labelKey)
        expect(resolved.length, `${locale} ${meta.labelKey}`).toBeGreaterThan(0)
        expect(resolved, `${locale} ${meta.labelKey}`).not.toBe(meta.labelKey)
      }
    }
  })

  it('fs: navigation/*.ts ima točno 75 nav.* ključev v vsakem od 5 jezikov', () => {
    for (const lang of LOCALES) {
      const src = readSrc('src', 'lib', 'i18n', 'navigation', `${lang}.ts`)
      const keys = src.match(/'nav\.[a-zA-Z0-9-]+':/g) ?? []
      expect(keys, lang).toHaveLength(75)
    }
  })
})

// — canAccessModule: Sidebar semantika —

describe('Module Registry (§6): canAccessModule (Sidebar semantika)', () => {
  it('null/undefined uporabnik → 0/75 (fail-closed)', () => {
    for (const id of MODULE_IDS) {
      expect(canAccessModule(null, id)).toBe(false)
      expect(canAccessModule(undefined, id)).toBe(false)
    }
  })

  it('admin vidi 75/75', () => {
    const seen = MODULE_IDS.filter((id) => canAccessModule({ role: 'admin', permissions: [] }, id))
    expect(seen).toHaveLength(75)
  })

  it('manager vidi 75/75', () => {
    const seen = MODULE_IDS.filter((id) => canAccessModule({ role: 'manager', permissions: [] }, id))
    expect(seen).toHaveLength(75)
  })

  it('take_orders uporabnik vidi točno 21 modulov', () => {
    const seen = MODULE_IDS.filter((id) => canAccessModule({ role: 'server', permissions: ['take_orders'] }, id))
    expect(seen).toHaveLength(21)
    expect(seen).toContain('orders')
  })

  it('manage_cash uporabnik vidi točno 6 modulov', () => {
    const seen = MODULE_IDS.filter((id) => canAccessModule({ role: 'cashier', permissions: ['manage_cash'] }, id))
    expect(seen).toHaveLength(6)
    expect(seen).toContain('cash-register')
  })

  it('manage_employees uporabnik vidi točno 4 module', () => {
    const seen = MODULE_IDS.filter((id) => canAccessModule({ role: 'hr', permissions: ['manage_employees'] }, id))
    expect(seen).toHaveLength(4)
    expect(seen).toContain('employees')
  })

  it('view_reports uporabnik vidi točno 12 modulov', () => {
    const seen = MODULE_IDS.filter((id) => canAccessModule({ role: 'analyst', permissions: ['view_reports'] }, id))
    expect(seen).toHaveLength(12)
    expect(seen).toContain('reports')
  })

  it('brez dovoljenj → 0/75; permissions ["admin"] → 43/75 (adminOnly ostaja role-gated)', () => {
    const empty = MODULE_IDS.filter((id) => canAccessModule({ role: 'staff', permissions: [] }, id))
    expect(empty).toHaveLength(0)
    // usePinAuth hasPermission 'admin'-bypass odpre permission-module (43),
    // a Sidebar adminOnly :58 preverja ROLVO — adminOnly (32) ostane zaprt.
    const adminPerm = MODULE_IDS.filter((id) => canAccessModule({ role: 'staff', permissions: ['admin'] }, id))
    expect(adminPerm).toHaveLength(43)
  })

  it('sales/kiosk restricted nabor (orders/kitchen/tables) je v registryju in dostopen natakarju', () => {
    // fs-pina na dva vira restricted defaultov (R153 kanon)
    expect(readSrc('src', 'lib', 'sales-mode.ts'))
      .toContain("export const SALES_MODE_ALLOWED_MODULES = ['orders'] as const")
    expect(readSrc('src', 'lib', 'store', 'store.ts'))
      .toContain("kioskAllowedModules: ['orders', 'kitchen', 'tables'],")
    const waiter: ModuleAccessUser = { role: 'server', permissions: ['take_orders'] }
    for (const id of ['orders', 'kitchen', 'tables']) {
      expect(MODULE_IDS, id).toContain(id)
      expect(canAccessModule(waiter, id), id).toBe(true)
    }
  })
})

// — Pariteta 8 likov × 75 modulov + infra pini —

describe('Module Registry (§6): pariteta + infra', () => {
  it('pariteta: 8 uporabniških likov × 75 modulov ≡ referenčni Sidebar semantiki', () => {
    for (const { name, user } of EIGHT_USERS) {
      for (const nav of navItems) {
        const expected = refCanAccess(user, nav)
        const actual = canAccessModule(user, nav.id)
        expect(actual, `${name} × ${nav.id}`).toBe(expected)
      }
    }
  })

  it('fs: registry.ts je PURE LIB (brez use client / react / lucide-react)', () => {
    const src = readSrc('src', 'lib', 'modules', 'registry.ts')
    expect(src).not.toContain("'use client'")
    expect(src).not.toContain("from 'react'")
    expect(src).not.toContain("from 'lucide-react'")
  })

  it('fs: docs/MODULE-INVENTORY.md je sintroniziran (75 vrstic inventarja + vir resnice)', () => {
    const doc = readSrc('docs', 'MODULE-INVENTORY.md')
    expect(doc).toContain('src/lib/modules/registry.ts')
    expect(doc).toContain('75 modulov')
    const rows = doc.match(/^\| `[a-z0-9-]+` \|/gm) ?? []
    expect(rows).toHaveLength(75)
  })
})
