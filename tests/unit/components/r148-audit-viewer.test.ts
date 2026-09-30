// ============================================
// R148-c (epic #115 #35 Audit/retention) — UI: AuditLogViewer
// 'Hramba podatkov & integriteta' sekcija + REALNA verify-chain kartica
// + query-keys/audit.ts registracija
//
// Pokritost (r147-c hišni kanon):
//   A) statika: header + retencijska sekcija + purge opomba (GLOBALEN)
//   B) verify-chain kartica: intaktna (verified/total), prelomljena
//      (broken) + dokumentirane retencije (documentedTruncations badge),
//      glava hash, refresh gumb, error Alert
//   C) retention sekcija: policy kartice (730/30/90/samo po poteku),
//      neomejena hramba (FURS — join vrstica), eligible števci
//      ('za izbris' / 'poteklih'), error Alert
//   D) arhiv tok (2-koračna potrditev): gumba disabled brez cutoffa /
//      predogleda; predogled → POST brez apply + toast + preview box
//      (counts + checksum + cap); apply → URL apply=1 + blob download
//      (createObjectURL) + toast + preview cleared; napaka → toast.error
//      TOČNO body.error (400 future cutoff / 409 prelomana rezina)
//   E) infra: auditKeys oblika + queryKeys.audit barrel; fs-pin navItems
//      (adminOnly — registracija ŽE obstaja) + module-registry + barrel
//      import v komponenti
//   F) legacy ['audit-logs'] seznam še vedno fetčan (/api/audit?)
//
// Tehnične opombe (r96/r142/r143/r144/r145/r146/r147 kanon):
//   - unit-vm pool = vmThreads + jsdom; @testing-library NI v devDeps →
//     createRoot + act (IS_REACT_ACT_ENVIRONMENT).
//   - '@/components/pos/PinLogin' = CELOTEN mock (authFetch).
//   - Input value prek HTMLInputElement.prototype setterja + change event
//     (r142 kanon — React value tracker).
//   - URL.createObjectURL/revokeObjectURL: per-test stub (obnovljen v
//     afterEach).
//   - AuditLogViewer ima pre-existing indigo v STARIH delih (header/EOD
//     badge — dednost r12) — barvni pin NIMA smisla na tem fajlu (nova
//     sekcija uporablja zinc/amber/rose/emerald; deviacija dokumentirana).
// ============================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// R174 IA: navItems fs-pin prenesen na centralni register (vir resnice)
import { MODULE_REGISTRY } from '@/lib/modules/registry'
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
import { AuditLogViewer } from '@/components/pos/AuditLogViewer'
import { auditKeys } from '@/lib/query-keys/audit'
import { queryKeys } from '@/lib/query-keys'

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

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// ============================================
// Fixture — verify-chain / retention / archive (realna R148-b shape)
// ============================================

const VERIFY_OK = {
  total: 5,
  verified: 5,
  broken: 0,
  chainIntact: true,
  documentedTruncations: 0,
  anchor: { id: 'al-1', previousHash: '', timestamp: '2026-01-01T00:00:00.000Z' },
  head: { id: 'al-9', chainHash: 'f'.repeat(64), timestamp: '2026-09-27T00:00:00.000Z' },
}

const VERIFY_BROKEN = {
  total: 5,
  verified: 3,
  broken: 2,
  chainIntact: false,
  documentedTruncations: 1,
  anchor: { id: 'al-3', previousHash: 'aa'.repeat(32), timestamp: '2024-06-16T00:00:00.000Z' },
  head: { id: 'al-9', chainHash: 'f'.repeat(64), timestamp: '2026-09-27T00:00:00.000Z' },
  brokenEntries: [{ id: 'al-4', expected: 'e'.repeat(64), actual: 'd'.repeat(64) }],
}

const RETENTION = {
  format: 'restaurantos-audit-retention',
  version: 1,
  generatedAt: '2026-09-27T12:00:00.000Z',
  policy: [
    { entity: 'AuditLog', days: 730, dateField: 'timestamp', basis: 'Revidirni dnevniki 2 leti (730 dni) — GDPR čl. 5(1)(e) omejitev hrambe.' },
    { entity: 'WebhookDelivery', days: 30, dateField: 'createdAt', basis: 'Dostavne sledi webhookov 30 dni.' },
    { entity: 'ScheduledEmailLog', days: 90, dateField: 'createdAt', basis: 'Dnevnik razporejenih e-poštnih sporočil 90 dni.' },
    { entity: 'Session', days: null, dateField: null, basis: 'Seje se brišejo SAMO po poteku.' },
  ],
  documentedIndefinite: [
    { entity: 'Naročila (orders)', models: ['Order'], reason: 'Poslovni dokaz o prometu — FURS/davčna evidence.' },
    { entity: 'Računi (receipts)', models: ['Receipt'], reason: 'FURS račun je davčni dokument — hramba 6+ let.' },
    { entity: 'Plačila (payments)', models: ['Payment'], reason: 'Računovodski dokaz — hramba 6+ let.' },
    { entity: 'Premene zaloge (stock movements)', models: ['StockTransaction'], reason: 'Sledljivost zalog (HACCP).' },
    { entity: 'Podatki gostov (customer data)', models: ['Guest'], reason: 'CRM zgodovina; Art. 17 na zahtevo.' },
  ],
  notes: [
    'Vir resnice: src/lib/retention/policy.ts (R148, epic #115 #35 P2-07).',
    'Aktivna retencija: AuditLog 730 dni, WebhookDelivery 30 dni, ScheduledEmailLog 90 dni; Session samo po poteku.',
    'Naročila, računi, plačila, premeni zaloge in podatki gostov se NE brišejo.',
    'AuditLog purge je vedno časovna rezina in poteka SAMO po arhiviranju.',
    'Po purge-u verify-chain prepozna dokumentirano odstranitev prek AUDIT_RETENTION_PURGED.',
  ],
  eligible: {
    AuditLog: { cutoff: '2024-06-16T12:00:00.000Z', count: 3 },
    WebhookDelivery: { cutoff: '2026-05-16T12:00:00.000Z', count: 1 },
    ScheduledEmailLog: { cutoff: '2026-03-17T12:00:00.000Z', count: 0 },
    Session: { cutoff: null, count: 2, basis: 'expired' },
  },
  chain: {
    anchor: { id: 'al-1', previousHash: '', timestamp: '2026-01-01T00:00:00.000Z' },
    head: { id: 'al-9', chainHash: 'f'.repeat(64), timestamp: '2026-09-27T00:00:00.000Z' },
  },
}

const DRY_RUN = {
  format: 'restaurantos-audit-archive',
  version: 1,
  generatedAt: '2026-09-27T12:00:00.000Z',
  cutoff: '2026-01-01T00:00:00.000Z',
  applied: false,
  wouldPurge: 5,
  counts: { auditLog: 4, webhookDelivery: 1, scheduledEmailLog: 0 },
  anchorIn: '',
  anchorOut: 'b'.repeat(64),
  checksum: 'c'.repeat(64),
  cap: 20000,
  notes: ['opomba'],
}

const APPLY_DISPOSITION = 'attachment; filename="audit-arhiv-20260927-120000.json"'

function jsonResponse(payload: unknown, status = 200, disposition: string | null = null): Response {
  const body = JSON.stringify(payload)
  return {
    ok: status < 400,
    status,
    json: async () => payload,
    blob: async () => new Blob([body], { type: 'application/json' }),
    headers: { get: (key: string) => (key === 'Content-Disposition' ? disposition : null) },
  } as unknown as Response
}

let blobSpy: ReturnType<typeof vi.fn> = vi.fn(async () => new Blob(['{}']))
let verifyFixture: Response = jsonResponse(VERIFY_OK)
let retentionFixture: Response = jsonResponse(RETENTION)
let dryRunFixture: Response = jsonResponse(DRY_RUN)
let applyFixture: Response = jsonResponse(DRY_RUN, 200, APPLY_DISPOSITION)

function routeApi(overrides: { verify?: Response; retention?: Response; dryRun?: Response; apply?: Response } = {}): void {
  verifyFixture = overrides.verify ?? jsonResponse(VERIFY_OK)
  retentionFixture = overrides.retention ?? jsonResponse(RETENTION)
  dryRunFixture = overrides.dryRun ?? jsonResponse(DRY_RUN)
  blobSpy = vi.fn(async () => new Blob(['{}']))
  applyFixture = overrides.apply ?? {
    ok: true,
    status: 200,
    json: async () => DRY_RUN,
    blob: blobSpy,
    headers: { get: (key: string) => (key === 'Content-Disposition' ? APPLY_DISPOSITION : null) },
  } as unknown as Response
  authFetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : String(input)
    if (url.includes('/api/audit/archive')) return url.includes('apply=1') ? applyFixture : dryRunFixture
    if (url.includes('/api/audit/verify-chain')) return verifyFixture
    if (url.includes('/api/audit/retention')) return retentionFixture
    if (url.includes('/api/audit?')) return jsonResponse({ logs: [], total: 0, limit: 50, offset: 0 })
    throw new Error(`Nepričakovan klic: ${url}`)
  })
}

// --- Render helperji (brez @testing-library — house minimalen pristop) ---
const mounted: { root: Root; container: HTMLElement }[] = []

function mountWithProviders(ui: ReactElement): HTMLElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 }, mutations: { retry: false } },
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

async function mountViewer(): Promise<HTMLElement> {
  const container = mountWithProviders(createElement(AuditLogViewer))
  await flush(3)
  return container
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    (Array.from(container.querySelectorAll('button')).find(
      (b) => (b.textContent ?? '').includes(text),
    ) as HTMLButtonElement | null) ?? null
  )
}

/** Input value prek prototype setterja (React value tracker) + input event
 *  (React onChange za <input> delegira na 'input', ne 'change' — r142 kanon
 *  za native select uporablja 'change', input polja pa 'input'). */
function setInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
  act(() => {
    descriptor?.set?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function archiveCalls(): string[] {
  return authFetchMock.mock.calls.map(([url]) => String(url)).filter((u) => u.includes('/api/audit/archive'))
}

// --- objectURL stubs (per-test, obnovljeni v afterEach) ---
let createObjectURLSpy: ReturnType<typeof vi.spyOn> | null = null
let revokeObjectURLSpy: ReturnType<typeof vi.spyOn> | null = null

beforeEach(() => {
  vi.clearAllMocks()
  routeApi()
  createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
  revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

afterEach(() => {
  mounted.forEach(({ root }) => {
    act(() => root.unmount())
  })
  mounted.length = 0
  createObjectURLSpy?.mockRestore()
  revokeObjectURLSpy?.mockRestore()
})

// ════════════════════════════════════════════════════════════════
describe('R148 AuditLogViewer — statika + verify-chain kartica', () => {
  it('1. header + retencijska sekcija + purge opomba (GLOBALEN) + legacy seznam fetčan', async () => {
    const container = await mountViewer()
    expect(container.textContent).toContain('Revizijski dnevnik')
    expect(container.textContent).toContain('Hramba podatkov & integriteta')
    expect(container.textContent).toContain('Purge je GLOBALEN')
    // legacy ['audit-logs'] query še vedno teče
    const listCalls = authFetchMock.mock.calls.map(([url]) => String(url)).filter((u) => u.includes('/api/audit?'))
    expect(listCalls.length).toBeGreaterThan(0)
  })

  it('2. intaktna veriga: badge Intaktna — 5/5 preverjenih + glava hash (16 znakov) + refresh gumb', async () => {
    const container = await mountViewer()
    expect(container.textContent).toContain('Intaktna — 5/5 preverjenih')
    expect(container.textContent).toContain(`${'f'.repeat(16)}`)
    // refresh → drugi verify-chain klic
    const before = authFetchMock.mock.calls.map(([url]) => String(url)).filter((u) => u.includes('verify-chain')).length
    const refresh = container.querySelector('button[aria-label="Ponovno preveri verigo"]')
    expect(refresh).not.toBeNull()
    click(refresh as Element)
    await flush(2)
    const after = authFetchMock.mock.calls.map(([url]) => String(url)).filter((u) => u.includes('verify-chain')).length
    expect(after).toBeGreaterThan(before)
  })

  it('3. prelomljena veriga: badge Prelomljena + dokumentirane retencije badge (amber)', async () => {
    routeApi({ verify: jsonResponse(VERIFY_BROKEN) })
    const container = await mountViewer()
    expect(container.textContent).toContain('Prelomljena — 2 vnosov')
    expect(container.textContent).toContain('1 dokumentiranih retencij')
  })

  it('4. verify-chain napaka → Alert točno besedilo, brez crasha', async () => {
    routeApi({ verify: jsonResponse({ error: 'x' }, 500) })
    const container = await mountViewer()
    expect(container.textContent).toContain('Napaka pri preverjanju verige.')
  })
})

// ════════════════════════════════════════════════════════════════
describe('R148 AuditLogViewer — retention sekcija', () => {
  it('5. policy kartice: 730 dni / 30 dni / 90 dni / samo po poteku + utemeljitve', async () => {
    const container = await mountViewer()
    expect(container.textContent).toContain('AuditLog')
    expect(container.textContent).toContain('730 dni')
    expect(container.textContent).toContain('30 dni')
    expect(container.textContent).toContain('90 dni')
    expect(container.textContent).toContain('samo po poteku')
    expect(container.textContent).toContain('Utemeljitev')
  })

  it('6. neomejena hramba: naslov + join vrstica vseh 5 skupin', async () => {
    const container = await mountViewer()
    expect(container.textContent).toContain('Neomejena hramba (se NE briše)')
    expect(container.textContent).toContain(
      'Naročila (orders) · Računi (receipts) · Plačila (payments) · Premene zaloge (stock movements) · Podatki gostov (customer data)',
    )
  })

  it("7. eligible števci: 'za izbris' + 'poteklih' (Session basis)", async () => {
    const container = await mountViewer()
    expect(container.textContent).toContain('AuditLog: 3 za izbris')
    expect(container.textContent).toContain('WebhookDelivery: 1 za izbris')
    expect(container.textContent).toContain('Session: 2 poteklih')
  })

  it('8. retention napaka → Alert točno besedilo', async () => {
    routeApi({ retention: jsonResponse({ error: 'x' }, 500) })
    const container = await mountViewer()
    expect(container.textContent).toContain('Napaka pri nalaganju hrambe.')
  })
})

// ════════════════════════════════════════════════════════════════
describe('R148 AuditLogViewer — arhiv tok (2-koračna potrditev)', () => {
  it('9. brez cutoffa: oba destruktivna/akcijska gumba disabled (defenzivna ovira)', async () => {
    const container = await mountViewer()
    const previewBtn = findButton(container, 'Pripravi predogled arhiva')
    const applyBtn = findButton(container, 'Arhiviraj in izbriši')
    expect(previewBtn?.disabled).toBe(true)
    expect(applyBtn?.disabled).toBe(true)
    expect(authFetchMock.mock.calls.filter(([u]) => String(u).includes('/api/audit/archive'))).toHaveLength(0)
  })

  it('10. predogled: POST brez apply=1 + toast uspeh + preview box (counts/checksum/cap) + apply enabled', async () => {
    const container = await mountViewer()
    const dateInput = container.querySelector('input[aria-label="Cutoff datum za arhiv"]') as HTMLInputElement
    setInputValue(dateInput, '2026-01-01')
    await flush(1)

    const previewBtn = findButton(container, 'Pripravi predogled arhiva')
    expect(previewBtn?.disabled).toBe(false)
    click(previewBtn as Element)
    await flush(3)

    const calls = archiveCalls()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('cutoff=2026-01-01T00')
    expect(calls[0]).not.toContain('apply=1')
    expect(toastSuccessMock).toHaveBeenCalledWith('Predogled pripravljen — 5 vrstic za arhiviranje')
    expect(container.textContent).toContain('Predogled: 5 vrstic (cap 20000)')
    expect(container.textContent).toContain('AuditLog: 4 · WebhookDelivery: 1 · ScheduledEmailLog: 0')
    expect(container.textContent).toContain(`${'c'.repeat(32)}…`)
    const applyBtn = findButton(container, 'Arhiviraj in izbriši')
    expect(applyBtn?.disabled).toBe(false)
    expect(applyBtn?.textContent).toContain('(5)')
  })

  it('11. apply: URL apply=1 + blob download (createObjectURL/revoke) + toast + preview cleared', async () => {
    const container = await mountViewer()
    const dateInput = container.querySelector('input[aria-label="Cutoff datum za arhiv"]') as HTMLInputElement
    setInputValue(dateInput, '2026-01-01')
    await flush(1)
    click(findButton(container, 'Pripravi predogled arhiva') as Element)
    await flush(3)

    click(findButton(container, 'Arhiviraj in izbriši') as Element)
    await flush(3)

    const calls = archiveCalls()
    expect(calls).toHaveLength(2)
    expect(calls[1]).toContain('apply=1')
    expect(blobSpy).toHaveBeenCalledTimes(1)
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1)
    expect(toastSuccessMock).toHaveBeenCalledWith('Arhiv prenesen — retencija izvršena (purge + anchor zapisi)')
    // preview cleared → apply spet disabled
    const applyBtn = findButton(container, 'Arhiviraj in izbriši')
    expect(applyBtn?.disabled).toBe(true)
  })

  it('12. 400 future cutoff → toast.error TOČNO body.error, preview NI postavljen', async () => {
    routeApi({ dryRun: jsonResponse({ error: 'Cutoff ne sme biti v prihodnosti.' }, 400) })
    const container = await mountViewer()
    const dateInput = container.querySelector('input[aria-label="Cutoff datum za arhiv"]') as HTMLInputElement
    setInputValue(dateInput, '2099-01-01')
    await flush(1)
    click(findButton(container, 'Pripravi predogled arhiva') as Element)
    await flush(3)
    expect(toastErrorMock).toHaveBeenCalledWith('Cutoff ne sme biti v prihodnosti.')
    expect(container.textContent).not.toContain('Predogled: ')
    expect(findButton(container, 'Arhiviraj in izbriši')?.disabled).toBe(true)
  })

  it('13. 409 prelomana rezina na apply → toast.error TOČNO + preview ostane (uporabnik lahko popravi)', async () => {
    routeApi({
      apply: jsonResponse(
        { error: 'Veriga arhivirane rezine ni neprekinjena pri vnosu al-2 — purge preklican (fail-closed).' },
        409,
      ),
    })
    const container = await mountViewer()
    const dateInput = container.querySelector('input[aria-label="Cutoff datum za arhiv"]') as HTMLInputElement
    setInputValue(dateInput, '2026-01-01')
    await flush(1)
    click(findButton(container, 'Pripravi predogled arhiva') as Element)
    await flush(3)
    click(findButton(container, 'Arhiviraj in izbriši') as Element)
    await flush(3)
    expect(toastErrorMock).toHaveBeenCalledWith(
      'Veriga arhivirane rezine ni neprekinjena pri vnosu al-2 — purge preklican (fail-closed).',
    )
    // preview ostane + blob NI bil klican (ni prenosa ob napaki)
    expect(blobSpy).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Predogled: 5 vrstic (cap 20000)')
  })
})

// ════════════════════════════════════════════════════════════════
describe('R148 AuditLogViewer — infra pini', () => {
  it('14. auditKeys oblika: EN koren [audit] + verifyChain/retention/archiveDryRun', () => {
    expect(auditKeys.all).toEqual(['audit'])
    expect(auditKeys.verifyChain).toEqual(['audit', 'verify-chain'])
    expect(auditKeys.retention).toEqual(['audit', 'retention'])
    expect(auditKeys.archiveDryRun('X')).toEqual(['audit', 'archive-dry-run', 'X'])
    // barrel unifikacija (kanon R145-c)
    expect(queryKeys.audit).toBe(auditKeys)
  })

  it('15. fs-pin: register audit-log adminOnly (R174: vir = registry) + module-registry vnos + barrel import v komponenti', () => {
    const regSrc = readFileSync(join(process.cwd(), 'src/lib/modules/registry.ts'), 'utf8')
    expect(regSrc).toContain("{ id: 'audit-log', labelKey: 'nav.auditLog', icon: 'ShieldAlert', group: 'system', groupOrder: 14, adminOnly: true")
    expect(MODULE_REGISTRY.find((m) => m.id === 'audit-log')?.adminOnly).toBe(true)
    const registrySrc = readFileSync(join(process.cwd(), 'src/app/components/module-registry.tsx'), 'utf8')
    expect(registrySrc).toContain("'audit-log': AuditLogViewer")
    const viewerSrc = readFileSync(join(process.cwd(), 'src/components/pos/AuditLogViewer.tsx'), 'utf8')
    expect(viewerSrc).toContain("import { auditKeys } from '@/lib/query-keys/audit'")
    const barrelSrc = readFileSync(join(process.cwd(), 'src/lib/query-keys/index.ts'), 'utf8')
    expect(barrelSrc).toContain("import { auditKeys } from './audit'")
    expect(barrelSrc).toContain('audit: auditKeys,')
  })

  it('16. fs-pin: nova sekcija je na disku (retencija + arhiv tok + anchor opomba)', () => {
    const viewerSrc = readFileSync(join(process.cwd(), 'src/components/pos/AuditLogViewer.tsx'), 'utf8')
    expect(viewerSrc).toContain('Hramba podatkov &amp; integriteta')
    expect(viewerSrc).toContain('Purge je GLOBALEN')
    expect(viewerSrc).toContain('auditKeys.verifyChain')
    expect(viewerSrc).toContain('auditKeys.retention')
    expect(viewerSrc).toContain('/api/audit/archive')
    // verify-chain je REALNA preveritev (statični 'SHA-256 hash chain aktiven' badge je ODSTRANJEN)
    expect(viewerSrc).not.toContain('SHA-256 hash chain aktiven')
  })
})
