// ============================================
// R143-c (epic #115 #30 Loyalty) — UI sekcija 'Življenjski cikel'
//
// Pokritost (r142-devices-module.test.ts hišni stil + r141-briefing-ui
// pure helperji):
//   A) čisti helperji iz loyalty/constants.ts:
//      - LIFECYCLE_BUCKET_META (BUG-04: literal razredi, brez blue/indigo,
//        iteracija po LIFECYCLE_BUCKETS iz lib/loyalty/lifecycle-constants)
//      - lifecycleBucketHint (dnevi IZ konstant, ne hardcode)
//      - tierBadge (label iz tierConfig + razred iz tierBadgeStyles,
//        neznani nivo → Nevtralni 'Neznano' fallback)
//   B) render LifecycleSection (createRoot + act, brez @testing-library):
//      - KPI vrednosti (aktivni / nedejavni >60 dni / poteče v 30 dneh /
//        skupaj = vsota byTier)
//      - segmenti Nov/Aktiven/Ogrožen/Izgubljen s števci + dnevnimi hinti
//      - mini porazdelitev nivojev (tierConfig oznake + deleži)
//      - top 5 računov: ime + značka nivoja + točke; 'do naslednje stopnje:
//        N točk' ko tierProgress < 100 (PINENO proti realnemu
//        lib/loyalty-tiers.tierProgress); PII NIKOLI v izrisu
//      - globoko povezovanje zgodovine (opcijski resolver + openHistory)
//      - iskreno prazno stanje ('Ni aktivnih računov')
//      - error stanje + 'Poskusi znova' (retry → okrevanje)
//      - loading skeleton (pending query, brez crasha)
//
// Tehnične opombe (r96/r142 kanon):
//   - unit-vm pool = vmThreads + jsdom; @testing-library NI v devDeps →
//     createRoot + act (IS_REACT_ACT_ENVIRONMENT).
//   - '@/components/pos/PinLogin' = CELOTEN mock (authFetch).
//   - TanStack Query: svež QueryClient na mount; retryDelay: 0 (hook
//     retry: 1 naj ne čaka 1 s backoffa) → error test počaka 2 poskusa.
//   - Fixture točke so < 1000, da formatPoints (sl-SI) ne prinese
//     group-separator variance v aserte.
// ============================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import type { Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { authFetch } from '@/components/pos/PinLogin'
import { LifecycleSection } from '@/components/pos/loyalty/LifecycleSection'
import {
  LIFECYCLE_BUCKET_META,
  lifecycleBucketHint,
  tierBadge,
  TIER_BADGE_UNKNOWN,
  type LoyaltyAccount,
} from '@/components/pos/loyalty/constants'
import type { LifecycleData } from '@/components/pos/loyalty/useLoyaltyLifecycle'
import { tierProgress } from '@/lib/loyalty-tiers'
import {
  LIFECYCLE_ACTIVE_MAX_DAYS,
  LIFECYCLE_AT_RISK_MAX_DAYS,
  LIFECYCLE_BUCKETS,
} from '@/lib/loyalty/lifecycle-constants'

// authFetch + getCurrentUser živita v PinLogin.tsx — celoten modul mockamo,
// da test ne vleče usePinLogin/next-dynamic grafa.
vi.mock('@/components/pos/PinLogin', () => ({
  authFetch: vi.fn(),
  getCurrentUser: vi.fn(() => null),
  setCurrentUser: vi.fn(),
  getAuthToken: vi.fn(() => 'test-token'),
  setAuthToken: vi.fn(),
  hasPermission: vi.fn(() => true),
}))

const authFetchMock = vi.mocked(authFetch)

// React 19 act okolje (jsdom) — potrebno za createRoot render v testih
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// --- Fixture: GET /api/loyalty/lifecycle (kontrakt R143-b) ---
// tierProgress prihaja iz KANONSKEGA lib/loyalty-tiers.tierProgress —
// test pini UI obnašanje proti realni semantiki napredka (ne proti
// izmišljenim številom).

function topAccount(
  id: string,
  customerName: string,
  tier: string,
  pointsBalance: number,
  lifetimePoints: number,
) {
  return { id, customerName, tier, pointsBalance, lifetimePoints, tierProgress: tierProgress(lifetimePoints, tier) }
}

const MOCK_LIFECYCLE: LifecycleData = {
  totals: { active: 25, inactive60d: 9 },
  byTier: { bronze: 12, silver: 8, gold: 4, platinum: 2 },
  lifecycleBuckets: { new: 3, active: 14, at_risk: 5, churned: 4 },
  expiringSoon30d: { points: 750, accounts: 4, capped: false, scanned: 26 },
  topAccounts: [
    // gold 4200 → next platinum 5000 → 800 točk, 73 %
    topAccount('acc-1', 'Ana Pirc', 'gold', 920, 4200),
    // platinum → brez naslednje stopnje (progressPct 100)
    topAccount('acc-2', 'Bor Novak', 'platinum', 840, 6100),
    // bronze 320 → next silver 500 → 180 točk, 64 %
    topAccount('acc-3', 'Cvetka Zupan', 'bronze', 640, 320),
    // silver 1100 → next gold 2000 → 900 točk, 40 %
    topAccount('acc-4', 'Dejan Kovač', 'silver', 410, 1100),
    // silver 1150 → next gold 2000 → 850 točk, 43 %
    topAccount('acc-5', 'Eva Kos', 'silver', 260, 1150),
  ],
  generatedAt: '2026-03-15T10:30:00.000Z',
}

/** Odgovor z NEPRIČAKOVANIMI PII polji — UI jih mora ignorirati (whitelist). */
const RAW_WITH_PII = {
  ...MOCK_LIFECYCLE,
  topAccounts: MOCK_LIFECYCLE.topAccounts.map((a) => ({
    ...a,
    customerPhone: '+386 40 999 888',
    customerEmail: 'pii-primer@never.si',
  })),
} as unknown as LifecycleData

const EMPTY_LIFECYCLE: LifecycleData = {
  totals: { active: 0, inactive60d: 0 },
  byTier: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
  lifecycleBuckets: { new: 0, active: 0, at_risk: 0, churned: 0 },
  expiringSoon30d: { points: 0, accounts: 0, capped: false, scanned: 0 },
  topAccounts: [],
  generatedAt: '2026-03-15T10:30:00.000Z',
}

/** Poln račun (oblika GET /api/loyalty) za globoko povezovanje zgodovine. */
const FAKE_FULL_ACCOUNT: LoyaltyAccount = {
  id: 'acc-1',
  customerName: 'Ana Pirc',
  customerPhone: '+386 31 111 222',
  customerEmail: 'ana@primer.si',
  pointsBalance: 920,
  lifetimePoints: 4200,
  tier: 'gold',
  isActive: true,
  transactions: [],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2026-03-15T10:30:00.000Z',
}

function jsonResponse(payload: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => payload } as unknown as Response
}

/** Privzeti GET router: samo lifecycle endpoint. */
function mockLifecycleApi(payload: unknown = MOCK_LIFECYCLE, ok = true): void {
  authFetchMock.mockImplementation(async (url: string) => {
    if (url === '/api/loyalty/lifecycle') return jsonResponse(payload, ok)
    throw new Error(`Nepričakovan klic: ${url}`)
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
// A) ČISTI HELPERJI (loyalty/constants.ts)
// ============================================

describe('BUG-04 mape življenjskega cikla', () => {
  it('LIFECYCLE_BUCKET_META pokrije točno LIFECYCLE_BUCKETS; razredi so literali brez modrih tonov', () => {
    expect(Object.keys(LIFECYCLE_BUCKET_META).sort()).toEqual([...LIFECYCLE_BUCKETS].sort())
    for (const cfg of Object.values(LIFECYCLE_BUCKET_META)) {
      expect(cfg.dotClass).toMatch(/bg-[a-z]+-\d+/)
      expect(cfg.dotClass).not.toContain('${')
      expect(cfg.dotClass).not.toContain('+')
      expect(cfg.textClass).toMatch(/text-[a-z]+-\d+/)
      expect(cfg.textClass).not.toContain('${')
      // hišno pravilo: NIKOLI modri/indigo akcenti
      expect(`${cfg.dotClass} ${cfg.textClass}`).not.toMatch(/blue|indigo/)
    }
    expect(LIFECYCLE_BUCKET_META.new.label).toBe('Nov')
    expect(LIFECYCLE_BUCKET_META.active.label).toBe('Aktiven')
    expect(LIFECYCLE_BUCKET_META.at_risk.label).toBe('Ogrožen')
    expect(LIFECYCLE_BUCKET_META.churned.label).toBe('Izgubljen')
    // barvni namigi kanona: emerald / neutralni zinc / amber / red
    expect(LIFECYCLE_BUCKET_META.active.textClass).toMatch(/emerald/)
    expect(LIFECYCLE_BUCKET_META.new.textClass).toMatch(/zinc/)
    expect(LIFECYCLE_BUCKET_META.at_risk.textClass).toMatch(/amber/)
    expect(LIFECYCLE_BUCKET_META.churned.textClass).toMatch(/red/)
  })

  it('lifecycleBucketHint: dnevi prihajajo IZ konstant (pazljivo pinnano na 60/180)', () => {
    expect(lifecycleBucketHint('new')).toBe('Brez transakcij')
    expect(lifecycleBucketHint('active')).toBe(`Zadnja transakcija ≤ ${LIFECYCLE_ACTIVE_MAX_DAYS} dni`)
    expect(lifecycleBucketHint('active')).toBe('Zadnja transakcija ≤ 60 dni')
    expect(lifecycleBucketHint('at_risk')).toBe(
      `${LIFECYCLE_ACTIVE_MAX_DAYS + 1}–${LIFECYCLE_AT_RISK_MAX_DAYS} dni od zadnje transakcije`,
    )
    expect(lifecycleBucketHint('at_risk')).toBe('61–180 dni od zadnje transakcije')
    expect(lifecycleBucketHint('churned')).toBe(`Več kot ${LIFECYCLE_AT_RISK_MAX_DAYS} dni brez transakcije`)
  })

  it('tierBadge: label iz tierConfig + razred iz tierBadgeStyles; neznani nivo → Neznano', () => {
    expect(tierBadge('gold')).toEqual({ label: 'Zlati', className: expect.stringContaining('yellow') })
    expect(tierBadge('bronze')).toEqual({ label: 'Bronasti', className: expect.stringContaining('amber') })
    expect(tierBadge('platinum')).toEqual({ label: 'Platinasti', className: expect.stringContaining('purple') })
    expect(tierBadge('diamond')).toEqual(TIER_BADGE_UNKNOWN)
    expect(tierBadge('')).toEqual(TIER_BADGE_UNKNOWN)
    expect(tierBadge(null)).toEqual(TIER_BADGE_UNKNOWN)
    expect(tierBadge(undefined)).toEqual(TIER_BADGE_UNKNOWN)
    expect(TIER_BADGE_UNKNOWN.className).toMatch(/zinc/)
  })
})

// ============================================
// B) RENDER — LifecycleSection
// ============================================

describe('LifecycleSection render (R143-c)', () => {
  it('KPI vrednosti iz agregata: aktivni / nedejavni >60 dni / poteče v 30 dneh / skupaj = vsota byTier', async () => {
    mockLifecycleApi()
    const container = mountWithProviders(createElement(LifecycleSection))
    await flush()

    // vrstni red v DOM: vrednost, nato oznaka → '25Aktivni računi'
    expect(container.textContent).toMatch(/25Aktivni računi/)
    expect(container.textContent).toMatch(new RegExp(`9Nedejavni >${LIFECYCLE_ACTIVE_MAX_DAYS} dni`))
    expect(container.textContent).toMatch(/750Točke, ki potečejo v 30 dneh/)
    expect(container.textContent).toContain('Računov: 4')
    // 12 + 8 + 4 + 2 = 26 (namerno ≠ totals.active 25 → ločljiv assert)
    expect(container.textContent).toMatch(/26Skupaj računov/)
    // osveževanje + časovni žig (LJ oblika — samo predpona, brez ICU odvisnosti)
    expect(container.textContent).toContain('Posodobljeno:')
    expect(container.querySelector('button[aria-label="Osveži življenjski cikel"]')).not.toBeNull()
  })

  it('segmenti Nov/Aktiven/Ogrožen/Izgubljen s števci + dnevnimi hinti iz konstant', async () => {
    mockLifecycleApi()
    const container = mountWithProviders(createElement(LifecycleSection))
    await flush()

    const text = container.textContent ?? ''
    // oznaka + števec sosednja besedila (pika je aria-hidden, brez besedila)
    expect(text).toMatch(/Nov3/)
    expect(text).toMatch(/Aktiven14/)
    expect(text).toMatch(/Ogrožen5/)
    expect(text).toMatch(/Izgubljen4/)
    // podnaslovi so sestavljeni IZ lifecycle-constants (import, ne hardcode)
    expect(text).toContain(lifecycleBucketHint('new'))
    expect(text).toContain(lifecycleBucketHint('active'))
    expect(text).toContain(lifecycleBucketHint('at_risk'))
    expect(text).toContain(lifecycleBucketHint('churned'))
  })

  it('mini porazdelitev nivojev: oznake iz tierConfig + števci + delež od skupaj', async () => {
    mockLifecycleApi()
    const container = mountWithProviders(createElement(LifecycleSection))
    await flush()

    const text = container.textContent ?? ''
    expect(text).toContain('Nivoji (delež od skupaj)')
    // oznaka + števec: 12/8/4/2 od 26 → 46 % / 31 % / 15 % / 8 %
    expect(text).toContain('Bronasti12')
    expect(text).toContain('Srebrni8')
    expect(text).toContain('Zlati4')
    expect(text).toContain('Platinasti2')
    expect(text).toContain('46 %')
    expect(text).toContain('31 %')
  })

  it('top računi: ime + značka nivoja + točke; PII iz (hipotetičnega) odgovora NIKOLI v izrisu', async () => {
    mockLifecycleApi(RAW_WITH_PII)
    const container = mountWithProviders(createElement(LifecycleSection))
    await flush()

    const text = container.textContent ?? ''
    // imena + nivo značke (tierConfig oznake) + stanje točk
    expect(text).toContain('Ana Pirc')
    expect(text).toContain('Bor Novak')
    expect(text).toContain('Cvetka Zupan')
    expect(text).toContain('Dejan Kovač')
    expect(text).toContain('Eva Kos')
    expect(text).toContain('Zlati')
    expect(text).toContain('Platinasti')
    expect(text).toContain('Bronasti')
    expect(text).toContain('Srebrni')
    expect(text).toContain('920')
    expect(text).toContain('260')
    // PII kanon: telefon/e-pošta se ne izrišejo, tudi če jih odgovor vsebuje
    expect(text).not.toContain('+386 40 999 888')
    expect(text).not.toContain('pii-primer@never.si')
    expect(text).not.toContain('@never.si')
    // seznam je drsen (max-h-96 kanon)
    expect(container.querySelector('ul[aria-label="Top računi po stanju točk"]')).not.toBeNull()
  })

  it('vrstica napredka: "do naslednje stopnje: N točk" ko tierProgress < 100; platinum → Najvišji nivo', async () => {
    mockLifecycleApi()
    const container = mountWithProviders(createElement(LifecycleSection))
    await flush()

    const text = container.textContent ?? ''
    // pinnano proti realnemu tierProgress(4200,'gold') → next platinum, 800 točk, 73 %
    expect(text).toContain('do naslednje stopnje: 800 točk')
    expect(text).toContain('do naslednje stopnje: 180 točk')
    expect(text).toContain('do naslednje stopnje: 900 točk')
    expect(text).toContain('do naslednje stopnje: 850 točk')
    // platinum (tierProgress.next null, progressPct 100) NIMA napredka
    const matches = text.match(/do naslednje stopnje/g) ?? []
    expect(matches).toHaveLength(4)
    expect(text).toContain('Najvišji nivo dosežen')
    // vrstica napredka: progressbar z aria-valuenow = progressPct in width iz percentualne vrednosti
    const bar = container.querySelector('[role="progressbar"][aria-valuenow="73"]') as HTMLElement | null
    expect(bar).not.toBeNull()
    const fill = bar?.firstElementChild as HTMLElement | null
    expect(fill?.style.width).toBe('73%')
  })

  it('globoko povezovanje zgodovine: gumb samo za razrešene račune, klik → onOpenHistory s polnim računom', async () => {
    mockLifecycleApi()
    const resolver = vi.fn((id: string) => (id === 'acc-1' ? FAKE_FULL_ACCOUNT : undefined))
    const openHistory = vi.fn()
    const container = mountWithProviders(
      createElement(LifecycleSection, { resolveHistoryAccount: resolver, onOpenHistory: openHistory }),
    )
    await flush()

    // Ana (acc-1) je razrešena → gumb obstaja; Bor (acc-2) ni → mrtvih klikov ni
    const btn = container.querySelector('button[aria-label="Zgodovina transakcij: Ana Pirc"]') as HTMLButtonElement
    expect(btn).not.toBeNull()
    expect(container.querySelector('button[aria-label="Zgodovina transakcij: Bor Novak"]')).toBeNull()
    click(btn)
    expect(openHistory).toHaveBeenCalledTimes(1)
    expect(openHistory).toHaveBeenCalledWith(FAKE_FULL_ACCOUNT)
  })

  it('iskreno prazno stanje: active=0 in brez top računov → "Ni aktivnih računov"', async () => {
    mockLifecycleApi(EMPTY_LIFECYCLE)
    const container = mountWithProviders(createElement(LifecycleSection))
    await flush()

    const text = container.textContent ?? ''
    expect(text).toContain('Ni aktivnih računov')
    // brez izmišljanja podatkov: KPI/segmenti/top sekcije niso izrisane
    expect(text).not.toContain('Aktivni računi')
    expect(text).not.toContain('Top računi')
    expect(text).not.toContain('Nivoji (delež od skupaj)')
    expect(container.querySelector('ul[aria-label="Top računi po stanju točk"]')).toBeNull()
  })

  it('error stanje: EN destructive alert + "Poskusi znova" (retry → okrevanje prek refetch)', async () => {
    authFetchMock.mockRejectedValue(new Error('Napaka 500'))
    const container = mountWithProviders(createElement(LifecycleSection))
    // hook retry: 1 → 2 poskusa (retryDelay: 0) → nato error UI
    await flush(6)

    expect(container.textContent).toContain('Napaka pri nalaganju življenjskega cikla')
    const retry = container.querySelector('button') as HTMLButtonElement
    expect(retry.textContent).toContain('Poskusi znova')
    const callsBefore = authFetchMock.mock.calls.length

    // retry → uspešen GET → sekcija se obnovi
    mockLifecycleApi()
    click(retry)
    await flush(4)
    expect(container.textContent).toContain('Življenjski cikel')
    expect(container.textContent).toMatch(/25Aktivni računi/)
    expect(authFetchMock.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('loading: pending query → skeletoni po stilu modula, brez crasha in brez podatkov', async () => {
    authFetchMock.mockImplementation(() => new Promise<Response>(() => {}))
    const container = mountWithProviders(createElement(LifecycleSection))
    await flush(2)

    expect(container.querySelector('[aria-label="Življenjski cikel se nalaga"]')).not.toBeNull()
    // Skeleton = bg-accent animate-pulse (ui/skeleton canon)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(10)
    expect(container.textContent).not.toContain('Aktivni računi')
    expect(container.textContent).not.toContain('Top računi')
  })
})
