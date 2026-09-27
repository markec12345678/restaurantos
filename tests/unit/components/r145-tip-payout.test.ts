// ============================================
// R145-c (epic #115 #32 Tips) — 'Izplačaj' (payout) UI tok
//
// Pokritost (r144-gift-card-liability.test.ts hišni stil + r97 mutation kanon):
//   A) BUG-04 pini (tip/constants.ts):
//      - TIP_POOL_STATUS_META: POLNI literali, točno 4 statusi, brez
//        blue/indigo (hišno pravilo), paleta amber/emerald/zinc
//      - tipPoolStatusMeta varen lookup z zinc fallbackom
//      - typo fix: METHOD_LABELS.points.desc = 'Po točkah/sistem' (NE 'sISTEMU')
//      - fs-pin: v tip modulu NI več 'blue-'/'indigo-' razredov niti 'sISTEMU'
//   B) Sub-komponente:
//      - TipMethodStatus: 'Razdeljeno'/'Izplačano' badge (paid JE dosegljiv),
//        neznan status → zinc fallback
//      - TipDistributionTable: 'Izplačano' badge + paidAt izris, employeeName
//        dovoljen, phone/email NIKOLI (PII kanon)
//      - TipManagerHeader: gumb 'Izplačaj' SAMO za status 'distributed'
//        (state machine pariteta z R145-b: dead buttons prepovedani)
//      - TipPayoutDialog: povzetek (datum + skupaj + distribucij), brez PII
//   C) Full TipManager tok (useTipPoolPayout — kontrakt R145-b):
//      - srečna pot: POST /api/tip-pool/[id]/payout BREZ bodyja, toast
//        'Napitnine izplačane · Izplačanih distribucij: N · Skupaj: X €',
//        ENOTENA invalidacija (refetch listinga IN byDate — unifikacija
//        ['tip-pool'] vs ['tip-pools']), badge 'Izplačano' po osvežitvi,
//        dialog se zapre
//      - napake: točno strežnikova sporočila (400/409/404) v toast.error
//      - PII: phone/email iz odgovora NIKOLI v izrisu
//
// Tehnične opombe (r96/r142/r143/r144 kanon):
//   - unit-vm pool = vmThreads + jsdom; @testing-library NI v devDeps →
//     createRoot + act (IS_REACT_ACT_ENVIRONMENT).
//   - '@/components/pos/PinLogin' = CELOTEN mock (authFetch); 'sonner' mock.
//   - TanStack Query: svež QueryClient; retryDelay: 0; mutations retry: false.
//   - TipManager uporablja next/dynamic({ ssr:false }) → po mountu potrebno
//     več flush rund, da se lazy sub-komponente izrisijo.
//   - Radix Dialog/AlertDialog renderira prek PORTALA v document.body →
//     dialog elemente iščemo na document.body, ne na mountanem containerju.
//   - formatEUR je ročna implementacija (NE Intl) → EUR aserti deterministični.
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
import { TipManager } from '@/components/pos/TipManager'
import { TipManagerHeader } from '@/components/pos/tip/TipManagerHeader'
import { TipPayoutDialog } from '@/components/pos/tip/TipPayoutDialog'
import { TipMethodStatus } from '@/components/pos/tip/TipMethodStatus'
import { TipDistributionTable } from '@/components/pos/tip/TipDistributionTable'
import {
  TIP_POOL_STATUSES,
  TIP_POOL_STATUS_META,
  tipPoolStatusMeta,
  METHOD_LABELS,
} from '@/components/pos/tip/constants'
import type { TipPoolData } from '@/components/pos/tip/constants'

vi.mock('@/components/pos/PinLogin', () => ({
  authFetch: vi.fn(),
  getCurrentUser: vi.fn(() => null),
  setCurrentUser: vi.fn(),
  getAuthToken: vi.fn(() => 'test-token'),
  setAuthToken: vi.fn(),
  hasPermission: vi.fn(() => true),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

const authFetchMock = vi.mocked(authFetch)
const toastSuccessMock = vi.mocked(toast.success)
const toastErrorMock = vi.mocked(toast.error)

// React 19 act okolje (jsdom) — potrebno za createRoot render v testih
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// ============================================
// Fixture — kontrakt GET /api/tip-pool (bare array) + payout (R145-b)
// ============================================

const TIP_POOL_ID = 'pool-r145'

const DISTRIBUTED_POOL: TipPoolData = {
  id: TIP_POOL_ID,
  date: '2026-03-15T00:00:00.000Z',
  totalTips: 45.67,
  cashTips: 20.34,
  cardTips: 25.33,
  distributionMethod: 'equal',
  status: 'distributed',
  distributions: [
    { id: 'd-1', employeeId: 'e-1', employeeName: 'Ana Novak', hoursWorked: 8, points: 0, amount: 22.84, status: 'pending', paidAt: null },
    { id: 'd-2', employeeId: 'e-2', employeeName: 'Borut Kovač', hoursWorked: 6, points: 0, amount: 22.83, status: 'pending', paidAt: null },
  ],
}

/** Suspektne PII ključi — UI jih mora ignorirati (no-fabrication/PII kanon). */
const DISTRIBUTIONS_WITH_PII = [
  { ...DISTRIBUTED_POOL.distributions[0], ownerPhone: '+386 40 999 888', ownerEmail: 'ana@nevarno.si' },
  { ...DISTRIBUTED_POOL.distributions[1], ownerPhone: '+386 41 111 222', ownerEmail: 'borut@nevarno.si' },
]

function poolWithStatus(status: string, distributions = DISTRIBUTED_POOL.distributions): TipPoolData {
  return { ...DISTRIBUTED_POOL, status, distributions }
}

/** Payout odgovor (kontrakt R145-b): poln pool + aditivno payoutSummary. */
const PAYOUT_RESPONSE: TipPoolData & { payoutSummary: { distributionCount: number; totalPaid: number } } = {
  ...poolWithStatus('paid', DISTRIBUTED_POOL.distributions.map((d) => ({ ...d, status: 'paid', paidAt: '2026-03-15T18:30:00.000Z' }))),
  payoutSummary: { distributionCount: 2, totalPaid: 45.67 },
}

function jsonResponse(payload: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => payload } as unknown as Response
}

/** Spremenljiv fixture poola (testi ga povozijo pred refetchom po payoutu). */
let poolFixture: TipPoolData | null = DISTRIBUTED_POOL

/** authFetch router: GET listing/byDate + POST payout; testi povozijo odgovore. */
function routeTipApi(payout: Response = jsonResponse(PAYOUT_RESPONSE)): void {
  authFetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (method === 'POST' && url === `/api/tip-pool/${TIP_POOL_ID}/payout`) return payout
    if (method === 'GET' && (url === '/api/tip-pool' || url.startsWith('/api/tip-pool?date='))) {
      return jsonResponse(poolFixture ? [poolFixture] : [])
    }
    throw new Error(`Nepričakovan klic: ${method} ${url}`)
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

/** Flush: react-query microtask verige + next/dynamic chunk load + setTimeout(0). */
async function flush(rounds = 2): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
  }
}

/** Standard mount TipManager + izris lazy sub-komponent. */
async function mountTipManager(): Promise<HTMLElement> {
  const container = mountWithProviders(createElement(TipManager))
  await flush(5) // dynamic({ ssr:false }) chunki + query fetch
  return container
}

beforeEach(() => {
  poolFixture = DISTRIBUTED_POOL
  authFetchMock.mockReset()
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
  document.body.innerHTML = ''
})

// ============================================
// A) BUG-04 + paleta (čisti helperji iz tip/constants.ts)
// ============================================

describe('BUG-04 status mapa tip poola (R145-c)', () => {
  it('TIP_POOL_STATUS_META pokrije točno 4 statusa; razredi so literali brez modrih tonov', () => {
    expect(Object.keys(TIP_POOL_STATUS_META).sort()).toEqual([...TIP_POOL_STATUSES].sort())
    expect(TIP_POOL_STATUSES).toEqual(['pending', 'distributed', 'approved', 'paid'])
    for (const cfg of Object.values(TIP_POOL_STATUS_META)) {
      expect(cfg.color).toMatch(/bg-[a-z]+-\d+/)
      // BUG-04: NIKOLI template-interpolirani/izračunani razredi
      expect(cfg.color).not.toContain('${')
      expect(cfg.color).not.toContain('+')
      // hišno pravilo: NIKOLI modri/indigo akcenti
      expect(cfg.color).not.toMatch(/blue|indigo/)
    }
    // oznake (kontrakt R145-a): Čakajoče / Razdeljeno / Odobreno / Izplačano
    expect(TIP_POOL_STATUS_META.pending.label).toBe('Čakajoče')
    expect(TIP_POOL_STATUS_META.distributed.label).toBe('Razdeljeno')
    expect(TIP_POOL_STATUS_META.approved.label).toBe('Odobreno')
    expect(TIP_POOL_STATUS_META.paid.label).toBe('Izplačano')
    // barvni namig kanona (R145-a kontrakt): amber pending / emerald distributed+paid / zinc neutral
    expect(TIP_POOL_STATUS_META.pending.color).toMatch(/amber/)
    expect(TIP_POOL_STATUS_META.distributed.color).toMatch(/emerald/)
    expect(TIP_POOL_STATUS_META.paid.color).toMatch(/emerald/)
    expect(TIP_POOL_STATUS_META.approved.color).toMatch(/zinc/)
  })

  it('tipPoolStatusMeta: znani statusi iz meta mape, neznan status → zinc fallback z surovim labelom', () => {
    expect(tipPoolStatusMeta('pending')).toBe(TIP_POOL_STATUS_META.pending)
    expect(tipPoolStatusMeta('paid').label).toBe('Izplačano')
    const unknown = tipPoolStatusMeta('neznano-stanje')
    expect(unknown.label).toBe('neznano-stanje')
    expect(unknown.color).toMatch(/zinc/)
    expect(unknown.color).not.toMatch(/blue|indigo/)
  })

  it('typo fix: METHOD_LABELS.points.desc = "Po točkah/sistem" (NE "sISTEMU")', () => {
    expect(METHOD_LABELS.points.desc).toBe('Po točkah/sistem')
    expect(Object.values(METHOD_LABELS).some((m) => m.desc.includes('sISTEMU'))).toBe(false)
  })

  it('fs-pin: v tip modulu NI več blue-/indigo- razredov niti "sISTEMU" (vir na disku)', () => {
    const tipDir = join(process.cwd(), 'src', 'components', 'pos', 'tip')
    for (const file of ['constants.ts', 'TipMethodStatus.tsx', 'TipSummaryCards.tsx', 'TipDistributionTable.tsx', 'TipManagerHeader.tsx', 'TipPayoutDialog.tsx', 'useTipPoolPayout.ts']) {
      const src = readFileSync(join(tipDir, file), 'utf8')
      expect(src).not.toMatch(/blue-|indigo-/)
      expect(src).not.toContain('sISTEMU')
    }
  })
})

// ============================================
// B) Sub-komponente
// ============================================

describe('TipMethodStatus badge (R145-c)', () => {
  it('distributed → Razdeljeno (emerald); paid → Izplačano (badge JE dosegljiv po payout endpointu)', async () => {
    const container = mountWithProviders(createElement(TipMethodStatus, { distributionMethod: 'equal', status: 'distributed' }))
    await flush()
    const badge = container.querySelector('[class*="emerald"]')
    expect(badge?.textContent).toContain('Razdeljeno')

    const containerPaid = mountWithProviders(createElement(TipMethodStatus, { distributionMethod: 'equal', status: 'paid' }))
    await flush()
    expect(containerPaid.querySelector('[class*="emerald"]')?.textContent).toContain('Izplačano')
  })

  it('neznan status → surov label z zinc fallbackom (nikoli crash)', async () => {
    const container = mountWithProviders(createElement(TipMethodStatus, { distributionMethod: 'equal', status: 'eksotično' }))
    await flush()
    const badge = container.querySelector('[class*="zinc"]')
    expect(badge?.textContent).toContain('eksotično')
  })
})

describe('TipDistributionTable paid vrstice (R145-c)', () => {
  it('paid distribucija: badge Izplačano + paidAt izris; employeeName dovoljen', async () => {
    const paidAt = '2026-03-15T18:30:00.000Z'
    const pool = poolWithStatus('paid', [
      { ...DISTRIBUTED_POOL.distributions[0], status: 'paid', paidAt },
      { ...DISTRIBUTED_POOL.distributions[1], status: 'paid', paidAt },
    ])
    const container = mountWithProviders(createElement(TipDistributionTable, {
      pool,
      editingAmounts: {},
      onAmountChange: () => {},
      onSaveManual: () => {},
      isSavePending: false,
    }))
    await flush()
    const text = container.textContent ?? ''
    expect(text).toContain('Ana Novak')
    expect(text).toContain('Borut Kovač')
    // badge 'Izplačano' na obeh vrsticah + paidAt (samo datum, brez odvisnosti od TZ ure)
    const paidBadges = Array.from(container.querySelectorAll('span')).filter((s) => s.textContent === 'Izplačano')
    expect(paidBadges.length).toBe(2)
    expect(text).toMatch(/15\. 03\. 2026/)
  })

  it('PII kanon: phone/email v vrsticah distribucij NIKOLI v izrisu (employeeName je dovoljen)', async () => {
    const pool = poolWithStatus('distributed', DISTRIBUTIONS_WITH_PII as TipPoolData['distributions'])
    const container = mountWithProviders(createElement(TipDistributionTable, {
      pool,
      editingAmounts: {},
      onAmountChange: () => {},
      onSaveManual: () => {},
      isSavePending: false,
    }))
    await flush()
    const text = container.textContent ?? ''
    expect(text).toContain('Ana Novak')
    expect(text).not.toContain('+386 40 999 888')
    expect(text).not.toContain('ana@nevarno.si')
    expect(text).not.toContain('@nevarno.si')
  })
})

describe('TipManagerHeader payout gumb (state machine pariteta)', () => {
  it("gumb 'Izplačaj' SAMO za status 'distributed' — pending/approved/paid → brez gumba", () => {
    const base = {
      selectedDate: '2026-03-15',
      onDateChange: () => {},
      onDatePrev: () => {},
      onDateNext: () => {},
      onGenerate: () => {},
      onPayout: () => {},
      isPayoutPending: false,
    }
    const distributed = mountWithProviders(createElement(TipManagerHeader, { ...base, pool: DISTRIBUTED_POOL }))
    const btn = distributed.querySelector('button[aria-label="Izplačaj napitnine"]')
    expect(btn).not.toBeNull()
    expect(btn?.textContent).toContain('Izplačaj')

    for (const status of ['pending', 'approved', 'paid']) {
      const container = mountWithProviders(createElement(TipManagerHeader, { ...base, pool: poolWithStatus(status) }))
      expect(container.querySelector('button[aria-label="Izplačaj napitnine"]')).toBeNull()
    }
  })
})

describe('TipPayoutDialog povzetek', () => {
  it('pokaže datum + skupaj + število distribucij; potrditveni gumb; brez PII', async () => {
    const container = mountWithProviders(createElement(TipPayoutDialog, {
      open: true,
      onOpenChange: () => {},
      pool: { ...DISTRIBUTED_POOL, distributions: DISTRIBUTIONS_WITH_PII as TipPoolData['distributions'] },
      onConfirm: () => {},
      isPending: false,
    }))
    await flush()
    // Radix Portal → dialog živi v document.body, ne v containerju
    const text = document.body.textContent ?? ''
    expect(text).toContain('Izplačaj napitnine')
    expect(text).toContain('15. 03. 2026')
    expect(text).toContain('45,67 €')
    expect(text).toContain('2')
    // PII iz distribucij NIKOLI v povzetku
    expect(text).not.toContain('+386 40 999 888')
    expect(text).not.toContain('ana@nevarno.si')
    const confirm = document.body.querySelector('button[aria-label="Potrdi izplačilo"]') as HTMLButtonElement | null
    expect(confirm).not.toBeNull()
    expect(confirm?.textContent).toContain('Izplačaj')
    expect(document.body.querySelector('button')?.textContent ?? '').toContain('Prekliči')
  })
})

// ============================================
// C) Full TipManager tok (useTipPoolPayout)
// ============================================

describe('TipManager payout tok (R145-c)', () => {
  it('srečna pot: dialog → POST brez bodyja → toast s povzetkom → ENOTENA invalidacija → badge Izplačano', async () => {
    routeTipApi()
    const container = await mountTipManager()

    // gumb obstaja (pool je distributed) — odpre dialog
    const payoutBtn = container.querySelector('button[aria-label="Izplačaj napitnine"]') as HTMLButtonElement
    expect(payoutBtn).not.toBeNull()
    click(payoutBtn)
    await flush(3)
    // povzetek živi v elementu z aria-label 'Povzetek izplačila' (Radix Portal → document.body)
    const summary = document.body.querySelector('[aria-label="Povzetek izplačila"]')
    expect(summary).not.toBeNull()
    const summaryText = summary?.textContent ?? ''
    expect(summaryText).toContain('15. 03. 2026')
    expect(summaryText).toContain('45,67 €')
    expect(summaryText.replace(/\s+/g, '')).toContain('Distribucij:2')

    // refetch po invalidaciji naj vrne PLAČAN pool (badge Izplačano)
    poolFixture = poolWithStatus('paid', DISTRIBUTED_POOL.distributions.map((d) => ({ ...d, status: 'paid', paidAt: '2026-03-15T18:30:00.000Z' })))
    const callsBefore = authFetchMock.mock.calls.length

    click(document.body.querySelector('button[aria-label="Potrdi izplačilo"]') as HTMLButtonElement)
    await flush(6)

    // POST kontrakt R145-b: točen URL, NO body
    const payoutCalls = authFetchMock.mock.calls.filter(
      ([url, init]) => String(url) === `/api/tip-pool/${TIP_POOL_ID}/payout` && (init?.method ?? 'GET') === 'POST',
    )
    expect(payoutCalls).toHaveLength(1)
    expect(payoutCalls[0][1]?.body).toBeUndefined()

    // toast uspeha s povzetkom izplačila (formatEUR determinističen)
    expect(toastSuccessMock).toHaveBeenCalledTimes(1)
    expect(String(toastSuccessMock.mock.calls[0][0])).toContain('Napitnine izplačane')
    expect(String(toastSuccessMock.mock.calls[0][0])).toContain('Izplačanih distribucij: 2 · Skupaj: 45,67 €')
    expect(toastErrorMock).not.toHaveBeenCalled()

    // ENOTENA invalidacija: refetch listinga ('/api/tip-pool') IN byDate ('?date=')
    const refetched = authFetchMock.mock.calls.slice(callsBefore).map(([url]) => String(url))
    expect(refetched.some((u) => u === '/api/tip-pool')).toBe(true)
    expect(refetched.some((u) => u.startsWith('/api/tip-pool?date='))).toBe(true)

    // badge 'Izplačano' po osvežitvi: pool badge + obe vrstici (3×)
    await flush(2)
    const paidBadges = Array.from(container.querySelectorAll('span')).filter((s) => s.textContent === 'Izplačano')
    expect(paidBadges.length).toBeGreaterThanOrEqual(3)
    // dialog se je zaprl (portal praznen)
    expect(document.body.querySelector('button[aria-label="Potrdi izplačilo"]')).toBeNull()
    // gumb 'Izplačaj' izgine (pool zdaj paid — dead buttons prepovedani)
    expect(container.querySelector('button[aria-label="Izplačaj napitnine"]')).toBeNull()
  })

  it.each([
    [409, 'Tip pool je že izplačan'],
    [400, 'Distribucija še ni shranjena'],
    [404, 'Tipski bazen ni najden'],
  ])('napaka %i: točno strežnikovo sporočilo "%s" v toast.error, brez uspešnega toasta', async (status, message) => {
    routeTipApi(jsonResponse({ error: message }, status))
    const container = await mountTipManager()

    click(container.querySelector('button[aria-label="Izplačaj napitnine"]') as HTMLButtonElement)
    await flush(3)
    click(document.body.querySelector('button[aria-label="Potrdi izplačilo"]') as HTMLButtonElement)
    await flush(6)

    expect(toastErrorMock).toHaveBeenCalledWith(message)
    expect(toastSuccessMock).not.toHaveBeenCalled()
    // dialog ostane odprt (zapre se samo ob uspehu)
    expect(document.body.querySelector('button[aria-label="Potrdi izplačilo"]')).not.toBeNull()
  })

  it('PII kanon na polnem modulu: employeeName se izriše, phone/email iz odgovora NIKOLI', async () => {
    poolFixture = { ...DISTRIBUTED_POOL, distributions: DISTRIBUTIONS_WITH_PII as TipPoolData['distributions'] }
    routeTipApi()
    const container = await mountTipManager()

    const text = container.textContent ?? ''
    expect(text).toContain('Ana Novak')
    expect(text).not.toContain('+386 40 999 888')
    expect(text).not.toContain('ana@nevarno.si')
    expect(text).not.toContain('@nevarno.si')

    // tudi payout dialog (odprt prek header gumba, portal v document.body) ne sme uhajati PII
    click(container.querySelector('button[aria-label="Izplačaj napitnine"]') as HTMLButtonElement)
    await flush(3)
    const dialogText = document.body.textContent ?? ''
    expect(dialogText).not.toContain('+386 40 999 888')
    expect(dialogText).not.toContain('ana@nevarno.si')
  })

  it('prazen dan (brez poola): brez payout gumba, samo Generiraj (ni mrtvih gumbov)', async () => {
    poolFixture = null
    routeTipApi()
    const container = await mountTipManager()
    expect(container.querySelector('button[aria-label="Izplačaj napitnine"]')).toBeNull()
    expect(container.textContent).toContain('Generiraj')
  })
})
