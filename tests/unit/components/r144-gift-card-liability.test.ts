// ============================================
// R144-c (epic #115 #31 Gift cards) — UI sekcija 'Odpustna obveznost'
//
// Pokritost (r143-lifecycle-section.test.ts hišni stil + r142-devices-module):
//   A) čisti helperji iz gift-cards/constants.ts:
//      - GIFT_CARD_LIABILITY_STATUS_META (BUG-04: literal razredi, brez
//        blue/indigo, iteracija po GIFT_CARD_LIABILITY_STATUSES)
//      - giftCardExpiringSoonLabel (dnevi IZ lib/gift-cards/constants
//        enotnega vira, NIKOLI hardcode 30)
//      - liabilityStatusCount (literal switch, nikoli objekti kot ključi)
//   B) render GiftCardLiabilitySection (createRoot + act, brez @testing-library):
//      - KPI vrednosti vključno z EUR formatom (formatEUR '4.321,89 €')
//      - oznaka "Poteče v 30 dneh" pinnana na GIFT_CARD_EXPIRING_SOON_DAYS
//      - razčlenba po statusih (vsi 4 številci)
//      - byLocation vrstice (ime + koda + 'Brez lokacije' za null)
//      - PII/no-fabrication: sumljivi extra ključi NIKOLI v izrisu
//      - iskreno prazno stanje ('Ni aktivnih darilnih kartic', brez KPI)
//      - loading skeleton, error + 'Poskusi znova' (retry → okrevanje),
//        'Osveži' gumb sproži refetch
//
// Tehnične opombe (r96/r142/r143 kanon):
//   - unit-vm pool = vmThreads + jsdom; @testing-library NI v devDeps →
//     createRoot + act (IS_REACT_ACT_ENVIRONMENT).
//   - '@/components/pos/PinLogin' = CELOTEN mock (authFetch).
//   - TanStack Query: svež QueryClient na mount; retryDelay: 0 (hook
//     retry: 1 naj ne čaka 1 s backoffa) → error test počaka 2 poskusa.
//   - formatEUR je ročna implementacija (NE Intl) → EUR aserti so
//     deterministični ('4.321,89 €') tudi brez full-ICU.
//   - 390px overflow asert: hišni komponentni testi (r142/r143) ga NE
//     izvajajo (grep potrdil) → ne dupliramo; responsive kanon je
//     min-w-0/truncate v komponenti.
// ============================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import type { Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { authFetch } from '@/components/pos/PinLogin'
import { GiftCardLiabilitySection } from '@/components/pos/gift-cards/GiftCardLiabilitySection'
import {
  GIFT_CARD_LIABILITY_STATUSES,
  GIFT_CARD_LIABILITY_STATUS_META,
  giftCardExpiringSoonLabel,
  liabilityStatusCount,
} from '@/components/pos/gift-cards/constants'
import type { LiabilityData } from '@/components/pos/gift-cards/useGiftCardLiability'
import { GIFT_CARD_EXPIRING_SOON_DAYS } from '@/lib/gift-cards/constants'

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

// --- Fixture: GET /api/gift-cards/liability (kontrakt R144-b) ---
// Saldi se glasijo: 3500.49 + 821.40 + 0 = 4321.89 (outstanding).

const MOCK_LIABILITY: LiabilityData = {
  totals: {
    outstandingBalance: 4321.89,
    activeCards: 12,
    depletedCards: 4,
    suspendedCards: 2,
    expiredCards: 1,
    expiringSoon30d: { cards: 3, balance: 84.2 },
  },
  byLocation: [
    {
      locationId: 'loc-1',
      locationName: 'Gostilna Štefan',
      locationCode: 'GOS-01',
      outstandingBalance: 3500.49,
      activeCards: 9,
      depletedCards: 3,
      suspendedCards: 1,
      expiredCards: 0,
    },
    {
      locationId: 'loc-2',
      locationName: 'Bistro Mestna',
      locationCode: 'MES-02',
      outstandingBalance: 821.4,
      activeCards: 3,
      depletedCards: 1,
      suspendedCards: 1,
      expiredCards: 1,
    },
    {
      locationId: null,
      locationName: 'Brez lokacije',
      locationCode: null,
      outstandingBalance: 0,
      activeCards: 0,
      depletedCards: 0,
      suspendedCards: 0,
      expiredCards: 0,
    },
  ],
  generatedAt: '2026-03-15T10:30:00.000Z',
}

/** Odgovor z NEPRIČAKOVANIMI polji — UI jih mora ignorirati (no-fabrication/PII). */
const RAW_WITH_SUSPICIOUS_KEYS = {
  ...MOCK_LIABILITY,
  ownerEmail: 'lastnik@nevarno.si',
  cardNumber: 'GC-SECRET-1234',
  byLocation: MOCK_LIABILITY.byLocation.map((row) => ({
    ...row,
    ownerPhone: '+386 40 999 888',
  })),
} as unknown as LiabilityData

const EMPTY_LIABILITY: LiabilityData = {
  totals: {
    outstandingBalance: 0,
    activeCards: 0,
    depletedCards: 0,
    suspendedCards: 0,
    expiredCards: 0,
    expiringSoon30d: { cards: 0, balance: 0 },
  },
  byLocation: [
    {
      locationId: null,
      locationName: 'Brez lokacije',
      locationCode: null,
      outstandingBalance: 0,
      activeCards: 0,
      depletedCards: 0,
      suspendedCards: 0,
      expiredCards: 0,
    },
  ],
  generatedAt: '2026-03-15T10:30:00.000Z',
}

function jsonResponse(payload: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => payload } as unknown as Response
}

/** Privzeti GET router: samo liability endpoint. */
function mockLiabilityApi(payload: unknown = MOCK_LIABILITY, ok = true): void {
  authFetchMock.mockImplementation(async (url: string) => {
    if (url === '/api/gift-cards/liability') return jsonResponse(payload, ok)
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
// A) ČISTI HELPERJI (gift-cards/constants.ts)
// ============================================

describe('BUG-04 mape odpustne obveznosti', () => {
  it('GIFT_CARD_LIABILITY_STATUS_META pokrije točno 4 statusa; razredi so literali brez modrih tonov', () => {
    expect(Object.keys(GIFT_CARD_LIABILITY_STATUS_META).sort()).toEqual([
      ...GIFT_CARD_LIABILITY_STATUSES,
    ].sort())
    for (const cfg of Object.values(GIFT_CARD_LIABILITY_STATUS_META)) {
      expect(cfg.dotClass).toMatch(/bg-[a-z]+-\d+/)
      expect(cfg.dotClass).not.toContain('${')
      expect(cfg.dotClass).not.toContain('+')
      expect(cfg.textClass).toMatch(/text-[a-z]+-\d+/)
      expect(cfg.textClass).not.toContain('${')
      // hišno pravilo: NIKOLI modri/indigo akcenti
      expect(`${cfg.dotClass} ${cfg.textClass}`).not.toMatch(/blue|indigo/)
    }
    // oznake (kontrakt R144-c): Aktivne / Izčrpane / Suspendirane / Poteče
    expect(GIFT_CARD_LIABILITY_STATUS_META.active.label).toBe('Aktivne')
    expect(GIFT_CARD_LIABILITY_STATUS_META.depleted.label).toBe('Izčrpane')
    expect(GIFT_CARD_LIABILITY_STATUS_META.suspended.label).toBe('Suspendirane')
    expect(GIFT_CARD_LIABILITY_STATUS_META.expired.label).toBe('Poteče')
    // barvni namig kanona: emerald / nevtralni zinc / amber / red
    expect(GIFT_CARD_LIABILITY_STATUS_META.active.textClass).toMatch(/emerald/)
    expect(GIFT_CARD_LIABILITY_STATUS_META.depleted.textClass).toMatch(/zinc/)
    expect(GIFT_CARD_LIABILITY_STATUS_META.suspended.textClass).toMatch(/amber/)
    expect(GIFT_CARD_LIABILITY_STATUS_META.expired.textClass).toMatch(/red/)
  })

  it('giftCardExpiringSoonLabel: dnevi prihajajo IZ konstante (pazljivo pinnano na 30)', () => {
    expect(giftCardExpiringSoonLabel()).toBe(`Poteče v ${GIFT_CARD_EXPIRING_SOON_DAYS} dneh`)
    expect(giftCardExpiringSoonLabel()).toBe('Poteče v 30 dneh')
    expect(GIFT_CARD_EXPIRING_SOON_DAYS).toBe(30)
  })

  it('liabilityStatusCount: literal switch nad štirimi statusi (nikoli objekti kot ključi)', () => {
    expect(liabilityStatusCount('active', MOCK_LIABILITY.totals)).toBe(12)
    expect(liabilityStatusCount('depleted', MOCK_LIABILITY.totals)).toBe(4)
    expect(liabilityStatusCount('suspended', MOCK_LIABILITY.totals)).toBe(2)
    expect(liabilityStatusCount('expired', MOCK_LIABILITY.totals)).toBe(1)
  })
})

// ============================================
// B) RENDER — GiftCardLiabilitySection
// ============================================

describe('GiftCardLiabilitySection render (R144-c)', () => {
  it('KPI vrednosti vključno z EUR formatom: obveznost / aktivne / poteče v 30 dneh / izčrpane', async () => {
    mockLiabilityApi()
    const container = mountWithProviders(createElement(GiftCardLiabilitySection))
    await flush()

    const text = container.textContent ?? ''
    // vrstni red v DOM: vrednost, nato oznaka → '4.321,89 €Odpustna obveznost'
    // (formatEUR je determinističen: pika = tisočice, vejica = decimalki)
    expect(text).toMatch(/4\.321,89 €Odpustna obveznost/)
    expect(text).toMatch(/12Aktivne kartice/)
    // oznaka "poteče kmalu" mora vsebovati števec iz importirane KONSTANTE
    expect(text).toContain(giftCardExpiringSoonLabel())
    expect(text).toContain('Poteče v 30 dneh')
    // expiring KPI: saldo kot vrednost, števec kartic kot podnaslov
    expect(text).toMatch(/84,20 €Poteče v 30 dneh/)
    expect(text).toContain('Kartic: 3')
    expect(text).toMatch(/4Izčrpane kartice/)
    // osveževanje + časovni žig (LJ oblika — samo predpona + leto, brez ICU odvisnosti)
    expect(text).toContain('Posodobljeno:')
    expect(text).toContain('2026')
    expect(container.querySelector('button[aria-label="Osveži odpustno obveznost"]')).not.toBeNull()
  })

  it('razčlenba po statusih: vsi štirje številci (Aktivne/Izčrpane/Suspendirane/Poteče) s pikami iz meta mape', async () => {
    mockLiabilityApi()
    const container = mountWithProviders(createElement(GiftCardLiabilitySection))
    await flush()

    const text = container.textContent ?? ''
    // oznaka + števec sosednja besedila (pika je aria-hidden, brez besedila)
    expect(text).toMatch(/Aktivne12/)
    expect(text).toMatch(/Izčrpane4/)
    expect(text).toMatch(/Suspendirane2/)
    expect(text).toMatch(/Poteče1/)
    // vsi štirje literali z piko iz meta mape (BUG-04 iteracija)
    for (const status of GIFT_CARD_LIABILITY_STATUSES) {
      const meta = GIFT_CARD_LIABILITY_STATUS_META[status]
      expect(text).toContain(meta.hint)
      const dots = container.querySelectorAll(`.${meta.dotClass.split(' ')[0].replace(/\\/g, '')}`)
      expect(dots.length).toBeGreaterThanOrEqual(1)
    }
    expect(text).toContain('Po statusih')
  })

  it('byLocation vrstice: ime + koda v muted + outstanding desno + števci; null → Brez lokacije', async () => {
    mockLiabilityApi()
    const container = mountWithProviders(createElement(GiftCardLiabilitySection))
    await flush()

    const text = container.textContent ?? ''
    expect(text).toContain('Po lokacijah')
    expect(text).toContain('Gostilna Štefan')
    expect(text).toContain('(GOS-01)')
    expect(text).toContain('Bistro Mestna')
    expect(text).toContain('(MES-02)')
    expect(text).toContain('Brez lokacije')
    // outstanding bold desno (formatEUR determinističen)
    expect(text).toContain('3.500,49 €')
    expect(text).toContain('821,40 €')
    // števci per lokacijo
    expect(text).toContain('Aktivne: 9 · Izčrpane: 3 · Suspendirane: 1 · Poteče: 0')
    expect(text).toContain('Aktivne: 3 · Izčrpane: 1 · Suspendirane: 1 · Poteče: 1')
    // drsen seznam (ScrollList max-h-96 + custom-scrollbar kanon)
    expect(container.querySelector('ul[aria-label="Odpustna obveznost po lokacijah"]')).not.toBeNull()
  })

  it('PII/no-fabrication: sumljivi extra ključi v odgovoru NIKOLI v izrisu', async () => {
    mockLiabilityApi(RAW_WITH_SUSPICIOUS_KEYS)
    const container = mountWithProviders(createElement(GiftCardLiabilitySection))
    await flush()

    const text = container.textContent ?? ''
    // legitimna agregirana polja se izrišejo
    expect(text).toContain('Gostilna Štefan')
    expect(text).toContain('3.500,49 €')
    // lastnik e-pošta / polna kartica / telefon se NIKOLI ne izrišejo
    expect(text).not.toContain('lastnik@nevarno.si')
    expect(text).not.toContain('@nevarno.si')
    expect(text).not.toContain('GC-SECRET-1234')
    expect(text).not.toContain('+386 40 999 888')
  })

  it('iskreno prazno stanje: aktivne=0, izčrpane=0, vsi saldi po lokacijah 0 → "Ni aktivnih darilnih kartic" brez KPI', async () => {
    mockLiabilityApi(EMPTY_LIABILITY)
    const container = mountWithProviders(createElement(GiftCardLiabilitySection))
    await flush()

    const text = container.textContent ?? ''
    expect(text).toContain('Ni aktivnih darilnih kartic')
    // brez izmišljanja podatkov: KPI/razčlenba/lokacije se ne izrišejo
    expect(text).not.toContain('Aktivne kartice')
    expect(text).not.toContain('Izčrpane kartice')
    expect(text).not.toContain('Poteče v 30 dneh')
    expect(text).not.toContain('Po statusih')
    expect(text).not.toContain('Po lokacijah')
    expect(text).not.toContain('Brez lokacije')
    expect(container.querySelector('ul[aria-label="Odpustna obveznost po lokacijah"]')).toBeNull()
  })

  it('loading: pending query → skeletoni po stilu modula (aria-busy), brez crasha in brez podatkov', async () => {
    authFetchMock.mockImplementation(() => new Promise<Response>(() => {}))
    const container = mountWithProviders(createElement(GiftCardLiabilitySection))
    await flush(2)

    expect(container.querySelector('[aria-label="Odpustna obveznost se nalaga"]')).not.toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    // Skeleton = bg-accent animate-pulse (ui/skeleton canon)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(10)
    expect(container.textContent).not.toContain('Aktivne kartice')
    expect(container.textContent).not.toContain('Po lokacijah')
  })

  it('error stanje: EN destructive alert + "Poskusi znova" (retry → okrevanje prek refetch)', async () => {
    authFetchMock.mockRejectedValue(new Error('Napaka 500'))
    const container = mountWithProviders(createElement(GiftCardLiabilitySection))
    // hook retry: 1 → 2 poskusa (retryDelay: 0) → nato error UI
    await flush(6)

    expect(container.textContent).toContain('Napaka pri nalaganju odpustne obveznosti')
    expect(container.textContent).toContain('Odpustne obveznosti darilnih kartic ni bilo mogoče naložiti.')
    const retry = container.querySelector('button') as HTMLButtonElement
    expect(retry.textContent).toContain('Poskusi znova')
    const callsBefore = authFetchMock.mock.calls.length

    // retry → uspešen GET → sekcija se obnovi
    mockLiabilityApi()
    click(retry)
    await flush(4)
    expect(container.textContent).toContain('Odpustna obveznost')
    expect(container.textContent).toMatch(/12Aktivne kartice/)
    expect(authFetchMock.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('osveži gumb: klik sproži refetch (nov authFetch klic)', async () => {
    mockLiabilityApi()
    const container = mountWithProviders(createElement(GiftCardLiabilitySection))
    await flush()

    const refresh = container.querySelector('button[aria-label="Osveži odpustno obveznost"]') as HTMLButtonElement
    expect(refresh).not.toBeNull()
    expect(refresh.textContent).toContain('Osveži')
    const callsBefore = authFetchMock.mock.calls.length

    click(refresh)
    await flush(3)
    expect(authFetchMock.mock.calls.length).toBeGreaterThan(callsBefore)
    // podatki ostanejo izrisani
    expect(container.textContent).toMatch(/4\.321,89 €Odpustna obveznost/)
  })
})
