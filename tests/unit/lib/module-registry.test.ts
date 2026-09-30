// ============================================
// MODULE REGISTRY — drift-gate (§6, epic #144, R173 + IA runda R174)
// ============================================
//
// Uveljavlja invarianto centralnega registra (src/lib/modules/registry.ts):
//   register ≡ navItems ≡ moduleComponents ≡ i18n ×5 jezikov
//   + canAccessModule pariteta z Sidebar semantiko (8 uporabniških likov × 76)
//   + R174 IA: navItems/navGroups DERIVIRANA iz registerja (fs-pin derivacije,
//     NAV_ICONS pokritost, groupOrder all-or-none + element-wise red,
//     mobile/highlight sodbe, nav.group.* i18n ×5)
//
// Kanon vzorcev (r147/r148/r149): fs-pini za vire, ki jih ni smiselno
// importirati (module-registry.tsx ima JSX/dynamic), import za čiste podatke
// (navItems, registry, tFor, NAV_ICONS). 35 testov = R174 baseline.
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
import { navItems, navGroups, NAV_ICONS } from '@/components/pos/sidebar/navItems'
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
  it('vsebuje točno 76 modulov; MODULE_IDS brez duplikatov (R175: +danes)', () => {
    expect(MODULE_REGISTRY).toHaveLength(76)
    expect(MODULE_IDS).toHaveLength(76)
    expect(new Set(MODULE_IDS).size).toBe(76)
  })

  it('7 skupin; labele + labelKey ≡ navGroups (label = SL fallback, labelKey = i18n, R174)', () => {
    expect(MODULE_GROUPS).toHaveLength(7)
    expect(MODULE_GROUPS.map((g) => g.id)).toEqual(navGroups.map((g) => g.id))
    expect(MODULE_GROUPS.map((g) => g.label)).toEqual(navGroups.map((g) => g.label))
    expect(MODULE_GROUPS.map((g) => g.labelKey)).toEqual(navGroups.map((g) => g.labelKey))
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
    expect(withPermission).toBe(44)
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

  it('priority: core = Golden Path semena + danes landing (13); long-tail = 14; secondary = 49', () => {
    const CORE_SEED = [
      'orders', 'kitchen', 'floor-plan', 'tables', 'cash-register', 'menu',
      'inventory', 'employees', 'reservations', 'dashboard', 'reports', 'settings',
      'danes',
    ]
    expect(CORE_MODULE_IDS).toHaveLength(13)
    // vrstni red registerja = navItems vrstni red (ne sodbe-seznam) — zato sort
    expect([...CORE_MODULE_IDS].sort()).toEqual([...CORE_SEED].sort())
    expect(MODULE_REGISTRY.filter((m) => m.priority === 'long-tail')).toHaveLength(14)
    expect(MODULE_REGISTRY.filter((m) => m.priority === 'secondary')).toHaveLength(49)
  })

  it('labelKey unikatni (76 različnih i18n ključev)', () => {
    expect(new Set(MODULE_REGISTRY.map((m) => m.labelKey)).size).toBe(76)
  })

  it('groupOrder: all-or-none per grupa; unikaten znotraj grupe (IA runda R174)', () => {
    for (const group of MODULE_GROUPS) {
      const members = MODULE_REGISTRY.filter((m) => m.group === group.id)
      const withOrder = members.filter((m) => m.groupOrder !== undefined)
      expect(withOrder.length === 0 || withOrder.length === members.length, group.id).toBe(true)
      expect(new Set(withOrder.map((m) => m.groupOrder)).size, group.id).toBe(withOrder.length)
    }
  })

  it('highlight: točno [orders] (SidebarNav poseben aktivni stil)', () => {
    expect(MODULE_REGISTRY.filter((m) => m.highlight).map((m) => m.id)).toEqual(['orders'])
    expect(navItems.find((n) => n.id === 'orders')?.highlight).toBe(true)
  })

  it('mobile sodba (R174): 12 back-office = false, 64 = true (R175: +danes); invarianta false ⇒ adminOnly || long-tail', () => {
    const MOBILE_FALSE = [
      'audit-log', 'compliance', 'conflicts', 'data-portability', 'fraud-detection',
      'ghost-kitchen', 'integrations', 'multi-location', 'offline-queue', 'outbox',
      'subscription', 'webhooks',
    ].sort()
    const actualFalse = MODULE_REGISTRY.filter((m) => !m.mobile).map((m) => m.id).sort()
    expect(actualFalse).toEqual(MOBILE_FALSE)
    expect(MODULE_REGISTRY.filter((m) => m.mobile)).toHaveLength(64)
    for (const m of MODULE_REGISTRY) {
      if (!m.mobile) {
        expect(m.adminOnly === true || m.priority === 'long-tail', m.id).toBe(true)
      }
    }
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

  it('ikone: NAV_ICONS adapter pokrije vsak registry.icon (unikatni nabor ≡; vseh 76 resolved)', () => {
    expect(new Set(Object.keys(NAV_ICONS))).toEqual(new Set(MODULE_REGISTRY.map((m) => m.icon)))
    for (const meta of MODULE_REGISTRY) {
      expect(NAV_ICONS[meta.icon], meta.id).toBeDefined()
    }
    // deriviran navItems ima definiran icon za vseh 76 (brez luknje)
    for (const nav of navItems) expect(nav.icon, nav.id).toBeDefined()
  })

  it('dostop ≡ navItems (permission/adminOnly per id)', () => {
    for (const meta of MODULE_REGISTRY) {
      const nav = navItems.find((n) => n.id === meta.id)
      expect(meta.permission, meta.id).toBe(nav?.permission)
      expect(meta.adminOnly, meta.id).toBe(nav?.adminOnly)
    }
  })

  it('skupine ≡ navGroups: članstvo + INTRA-GROUP VRSTNI RED element-wise (R174: red = groupOrder sodba v registerju)', () => {
    // R173: samo članstvo (set) — vrstni red se je razlikoval po naravi.
    // R174: intra-group red je sodba v registerju (groupOrder) in navGroups
    // je DERIVIRAN — zato element-wise pin per grupa.
    const regIndex = new Map(MODULE_IDS.map((id, i) => [id, i] as const))
    for (const group of navGroups) {
      const registryIds = MODULE_REGISTRY
        .filter((m) => m.group === group.id)
        .sort((a, b) => (a.groupOrder ?? regIndex.get(a.id) ?? 0) - (b.groupOrder ?? regIndex.get(b.id) ?? 0))
        .map((m) => m.id)
      expect(registryIds, group.id).toEqual(group.itemIds)
    }
  })

  it('fs: moduleComponents map ima točno 76 vnosov', () => {
    expect(moduleMapKeys).toHaveLength(76)
  })

  it('fs: moduleComponents ključi ≡ MODULE_IDS (76↔76 invarianta)', () => {
    expect([...moduleMapKeys].sort()).toEqual([...MODULE_IDS].sort())
  })

  it('fs: navItems/navGroups sta DERIVIRANA iz registerja (prepreči regresijo na ročni seznam)', () => {
    expect(navItemsSrc).toContain('export const navItems: NavItem[] = MODULE_REGISTRY.map(')
    expect(navItemsSrc).toContain('export const navGroups: NavGroup[] = MODULE_GROUPS.map(')
    // ročni literal vnos { id: 'x', labelKey: ... } ne sme več obstajati
    expect(navItemsSrc).not.toMatch(/\{ id: '[a-z-]+', labelKey: '/)
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

  it('fs: navigation/*.ts ima točno 76 nav.* ključev v vsakem od 5 jezikov', () => {
    for (const lang of LOCALES) {
      const src = readSrc('src', 'lib', 'i18n', 'navigation', `${lang}.ts`)
      const keys = src.match(/'nav\.[a-zA-Z0-9-]+':/g) ?? []
      expect(keys, lang).toHaveLength(76)
    }
  })

  it('i18n: MODULE_GROUPS.labelKey (nav.group.*) se razreši v vseh 5 jezikih (R174)', () => {
    for (const locale of LOCALES) {
      for (const group of MODULE_GROUPS) {
        const resolved = tFor(locale, group.labelKey)
        expect(resolved.length, `${locale} ${group.labelKey}`).toBeGreaterThan(0)
        expect(resolved, `${locale} ${group.labelKey}`).not.toBe(group.labelKey)
      }
    }
  })

  it('fs: navigation/*.ts ima točno 7 nav.group.* ključev v vsakem od 5 jezikov (R174)', () => {
    for (const lang of LOCALES) {
      const src = readSrc('src', 'lib', 'i18n', 'navigation', `${lang}.ts`)
      const keys = src.match(/'nav\.group\.[a-z]+':/g) ?? []
      expect(keys, lang).toHaveLength(7)
    }
  })
})

// — canAccessModule: Sidebar semantika —

describe('Module Registry (§6): canAccessModule (Sidebar semantika)', () => {
  it('null/undefined uporabnik → 0/76 (fail-closed)', () => {
    for (const id of MODULE_IDS) {
      expect(canAccessModule(null, id)).toBe(false)
      expect(canAccessModule(undefined, id)).toBe(false)
    }
  })

  it('admin vidi 76/76', () => {
    const seen = MODULE_IDS.filter((id) => canAccessModule({ role: 'admin', permissions: [] }, id))
    expect(seen).toHaveLength(76)
  })

  it('manager vidi 76/76', () => {
    const seen = MODULE_IDS.filter((id) => canAccessModule({ role: 'manager', permissions: [] }, id))
    expect(seen).toHaveLength(76)
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

  it('view_reports uporabnik vidi točno 13 modulov (R175: +danes)', () => {
    const seen = MODULE_IDS.filter((id) => canAccessModule({ role: 'analyst', permissions: ['view_reports'] }, id))
    expect(seen).toHaveLength(13)
    expect(seen).toContain('reports')
    expect(seen).toContain('danes')
  })

  it('brez dovoljenj → 0/76; permissions ["admin"] → 44/76 (adminOnly ostaja role-gated)', () => {
    const empty = MODULE_IDS.filter((id) => canAccessModule({ role: 'staff', permissions: [] }, id))
    expect(empty).toHaveLength(0)
    // usePinAuth hasPermission 'admin'-bypass odpre permission-module (44),
    // a Sidebar adminOnly :58 preverja ROLVO — adminOnly (32) ostane zaprt.
    const adminPerm = MODULE_IDS.filter((id) => canAccessModule({ role: 'staff', permissions: ['admin'] }, id))
    expect(adminPerm).toHaveLength(44)
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
  it('pariteta: 8 uporabniških likov × 76 modulov ≡ referenčni Sidebar semantiki', () => {
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

  it('fs: docs/MODULE-INVENTORY.md je sintroniziran (76 vrstic inventarja + vir resnice)', () => {
    const doc = readSrc('docs', 'MODULE-INVENTORY.md')
    expect(doc).toContain('src/lib/modules/registry.ts')
    expect(doc).toContain('76 modulov')
    const rows = doc.match(/^\| `[a-z0-9-]+` \|/gm) ?? []
    expect(rows).toHaveLength(76)
  })
})

// — R175: Danes kokpit (epic #144, P0-01) —

describe('Module Registry (§6): R175 Danes kokpit (P0-01)', () => {
  it('danes: registry vrstica — analytics/groupOrder 0/view_reports/core/icon Home/mobile true', () => {
    const meta = MODULE_REGISTRY.find((m) => m.id === 'danes')
    expect(meta).toBeDefined()
    expect(meta!.group).toBe('analytics')
    expect(meta!.groupOrder).toBe(0)
    expect(meta!.permission).toBe('view_reports')
    expect(meta!.priority).toBe('core')
    expect(meta!.icon).toBe('Home')
    expect(meta!.mobile).toBe(true)
    expect(meta!.adminOnly).toBeUndefined()
    expect(meta!.highlight).toBeUndefined()
    expect(meta!.labelKey).toBe('nav.danes')
    expect(meta!.relatedModules).toEqual(
      expect.arrayContaining(['orders', 'kitchen', 'tables', 'cash-register']),
    )
    expect(meta!.relatedModules).toHaveLength(4)
  })

  it('danes: prvi modul v ANALITIKA navGroups (groupOrder 0 = landing pred briefing(1))', () => {
    const analytics = navGroups.find((g) => g.id === 'analytics')
    expect(analytics?.itemIds[0]).toBe('danes')
    expect(analytics?.itemIds).toContain('briefing')
  })

  it('danes: nav.danes razrešen v 5 jezikov (Danes/Today/Oggi/Danas/Heute)', () => {
    expect(tFor('sl', 'nav.danes')).toBe('Danes')
    expect(tFor('en', 'nav.danes')).toBe('Today')
    expect(tFor('it', 'nav.danes')).toBe('Oggi')
    expect(tFor('hr', 'nav.danes')).toBe('Danas')
    expect(tFor('de', 'nav.danes')).toBe('Heute')
  })

  it('danes: landing logika v page.tsx (fs-pin: view_reports gate + kiosk guard + orders default guard)', () => {
    const src = readSrc('src', 'app', 'page.tsx')
    expect(src).toContain("canAccessModule(authUser, 'danes')")
    expect(src).toContain("setActiveModule('danes')")
    expect(src).toContain("activeModule !== 'orders'")
    expect(src).toContain('kioskMode || salesMode || activeModule !==')
    expect(src).toContain("authUser.role === 'admin' || authUser.role === 'manager' || authUser.permissions.includes('view_reports')")
  })

  it('danes: kokpit kompozicija — 7 obstoječih endpointov, brez nove API površine (fs-pin)', () => {
    const src = readSrc('src', 'components', 'pos', 'danes', 'DanesCockpit.tsx')
    expect(src).toContain("'/api/operational-alerts'")
    expect(src).toContain("'/api/kitchen'")
    expect(src).toContain("'/api/dashboard'")
    expect(src).toContain("'/api/cash-register'")
    expect(src).toContain("'/api/reservations?upcoming=true'")
    expect(src).toContain("'/api/inventory/menu-stock'")
    expect(src).toContain("'/api/outbox?status=failed'")
    // deep-link kanon (setActiveModule) + i18n (useI18n)
    expect(src).toContain('setActiveModule(')
    expect(src).toContain('useI18n(')
  })

  it('danes: prefetch — danes entry obstaja; mrtvi /api/orders/stats odstranjen (fs-pin)', () => {
    const src = readSrc('src', 'lib', 'use-module-prefetch', 'config.ts')
    expect(src).toMatch(/^  danes: \[/m)
    // pin na KODO (endpoint vnos), komentar z zgodovino ostane dovoljen
    expect(src).not.toContain("endpoint: '/api/orders/stats'")
  })
})
