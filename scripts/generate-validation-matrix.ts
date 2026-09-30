// ============================================
// GENERATOR: docs/VALIDATION-MATRIX.md (§8 — epic #144, R178)
// ============================================
//
// Epik #144 §8 "Production validation matrix": za kritične funkcije
// vzdržujemo eksplicitna dokazna stanja po kanalih (unit / IT / E2E /
// brskalnik / realni hardver / realno plačilo / realna zunanja storitev /
// pilot). Kritično pravilo epika: **Green CI NI isto kot produkcijska
// validacija.**
//
// NAČELA (anti-overclaim, kanon #144):
//  - Vsak ✓ dokazni kanal je sidran na KONKRETNO testno datoteko, ki
//    MORA obstajati na disku (generator fail-closed ob manjkajočem sidru).
//  - "Realni hardver / realno plačilo / realna zunanja storitev / pilot"
//    so VEDNO ☐ ali N/A — fizična validacija NI izvedena (kanon
//    physicalValidationStatus v PRODUCT-STATUS.md).
//  - Brskalniški dokazi = žive sandbox verifikacije iz rund, vsaka z
//    referenco na rundno poročilo (P5 = zlati tok, R### = issue #144).
//  - DETERMINISTIČNO: brez timestampov / naključja — regeneracija na
//    istem drevesu je BITNIČNO ENAKA (gate: `bun run matrix && git diff
//    --exit-code docs/VALIDATION-MATRIX.md` + unit drift-gate, ki primerja
//    commitano datoteko z buildMatrixDoc()).
//
// Dokumenta NE urejati ročno — spremeni CAPABILITIES in regeneriraj.
//
// Zaženi: bun run matrix   (= npx tsx scripts/generate-validation-matrix.ts)
// ============================================

import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MODULE_REGISTRY } from '../src/lib/modules/registry'

// ── Tipi ────────────────────────────────────────────────────────────

/** Dokazni kanal: seznam sidr (testnih datotek, relativno na repo root). */
interface Anchors {
  unit: string[]
  integration: string[]
  e2e: string[]
}

/** Vrednost "realnega" kanala: N/A (ni relevanten) ali ☐ (relevanten, ni validiran). */
type RealCell = 'N/A' | '☐'

export interface ValidationCapability {
  id: string
  label: string
  /** true = ena od 9 vrstic iz epika §8; false = razširitev po realni kodi. */
  epic8: boolean
  /** Koda implementirana (≠ validirana!) — vsi stolpci so ločeni dokazni stanji. */
  implemented: true
  /** Povezani moduli iz §6 registerja (veljavnost fs/generator-verified). */
  moduleIds: string[]
  anchors: Anchors
  /** '—' ali kratek žetok rundnega živega dokaza (detajli v sidrni sekciji). */
  browserShort: string
  /** Detajl živega brskalniškega dokaza (runda + obseg) ali '—'. */
  browserDetail: string
  realHardware: RealCell
  realPayment: RealCell
  realExternal: RealCell
  pilot: '☐'
  note?: string
}

// ── Zmožnosti (9 iz epika §8 + razširitev po realni kodi) ───────────

export const CAPABILITIES: ValidationCapability[] = [
  // ══ 9 vrstic iz epika #144 §8 ══
  {
    id: 'pos',
    label: 'POS / naročila',
    epic8: true,
    implemented: true,
    moduleIds: ['orders', 'tables'],
    anchors: {
      unit: [
        'tests/unit/orders/p1-data-model.test.ts',
        'tests/unit/security/r112-orders-kds-concurrency.test.ts',
        'tests/unit/lib/r129-reorder-canon.test.ts',
      ],
      integration: ['tests/integration/r135-kiosk-order.test.ts'],
      e2e: [
        'tests/e2e/core-flow.spec.ts',
        'tests/e2e/critical-path.spec.ts',
        'tests/e2e/workflow.spec.ts',
      ],
    },
    browserShort: '✅ P5',
    browserDetail:
      'P5 (zlati tok): POS mreža (Toast-stil, živa zaloga) → košarica + DDV razčlenitev → oddaja naročila → plačilni dialog — živo v sandboxu.',
    realHardware: 'N/A',
    realPayment: '☐',
    realExternal: 'N/A',
    pilot: '☐',
  },
  {
    id: 'kds',
    label: 'KDS (kuhinja)',
    epic8: true,
    implemented: true,
    moduleIds: ['kitchen'],
    anchors: {
      unit: [
        'tests/unit/lib/kds-sound-prefs.test.ts',
        'tests/unit/lib/r156-enums.test.ts',
      ],
      integration: ['tests/integration/r133-kds-metrics-drill.test.ts'],
      e2e: ['tests/e2e/kds-timer.spec.ts', 'tests/e2e/core-flow.spec.ts'],
    },
    browserShort: '✅ P5',
    browserDetail:
      'P5: KDS modul živo (fire → ticket); R176: kitchen workspace landing na Marko 4444 (KDS "Kuhinja je prosta" — P0-02 dokaz).',
    realHardware: '☐',
    realPayment: 'N/A',
    realExternal: 'N/A',
    pilot: '☐',
    note: 'Realni KDS device ni fizično validiran (physicalValidationStatus.kdsDevice = false).',
  },
  {
    id: 'offline',
    label: 'Offline / reconnect',
    epic8: true,
    implemented: true,
    moduleIds: ['offline-queue', 'outbox'],
    anchors: {
      unit: [
        'tests/unit/offline/r128-offline-cancel-ops.test.ts',
        'tests/unit/lib/indexeddb-stores.test.ts',
        'tests/unit/outbox.test.ts',
      ],
      integration: ['tests/integration/r128-offline-exactly-once.test.ts'],
      e2e: ['tests/e2e/outbox-worker.spec.ts'],
    },
    browserShort: '—',
    browserDetail: '— (exactly-once dokaz = IT + e2e outbox; brez namenskega brskalniškega streza)',
    realHardware: 'N/A',
    realPayment: 'N/A',
    realExternal: 'N/A',
    pilot: '☐',
    note: 'Obseg po zasnovi: orders/cancel offline-safe (exactly-once); payment in Daily Close offline-BLOCKED (PRODUCTION-VALIDATION.md §7 S12).',
  },
  {
    id: 'payment',
    label: 'Plačila',
    epic8: true,
    implemented: true,
    moduleIds: ['orders', 'cash-register'],
    anchors: {
      unit: [
        'tests/unit/payments/payment-tenant-guard.test.ts',
        'tests/unit/security/r116-idempotency-tenant-boundary.test.ts',
      ],
      integration: [
        'tests/integration/r144-gift-cards.test.ts',
        'tests/integration/r128-offline-exactly-once.test.ts',
      ],
      e2e: ['tests/e2e/payment-flow.spec.ts', 'tests/e2e/core-flow.spec.ts'],
    },
    browserShort: '✅ P5',
    browserDetail:
      'P5: gotovina 50 € → plačilo 201; deljeno / po artiklih / napitnina dialog živo. Idempotency replay (isti key = isti payment) = core-flow FLOW-9b.',
    realHardware: 'N/A',
    realPayment: '☐',
    realExternal: '☐',
    pilot: '☐',
    note: 'Plačilni terminal NOT PHYSICALLY VALIDATED; Stripe v test-mode keys (produkcijski keys = uporabniški korak).',
  },
  {
    id: 'receipt',
    label: 'Računi (ZDDV-1)',
    epic8: true,
    implemented: true,
    moduleIds: ['printers'],
    anchors: {
      unit: [
        'tests/unit/cis/receipt-submission.test.ts',
        'tests/unit/cis/invoice.test.ts',
        'tests/unit/api/r132-invoice-match.test.ts',
      ],
      integration: [],
      e2e: ['tests/e2e/core-flow.spec.ts'],
    },
    browserShort: '✅ P5',
    browserDetail:
      'P5: račun R-2026-000001 izdan; digitalni račun (Davčno overi, e-pošta, SMS dialog) živo.',
    realHardware: 'N/A',
    realPayment: 'N/A',
    realExternal: '☐',
    pilot: '☐',
    note: '"Davčno overi" = FURS sim-mode (glej vrstico furs) — realna zunanja overitev NI izvedena.',
  },
  {
    id: 'furs',
    label: 'FURS (SI fiskalizacija)',
    epic8: true,
    implemented: true,
    moduleIds: ['furs'],
    anchors: {
      unit: [
        'tests/unit/furs/r166-sim-mode.test.ts',
        'tests/unit/furs/zoi.test.ts',
        'tests/unit/furs/jws.test.ts',
        'tests/unit/furs/pkcs12-roundtrip.test.ts',
        'tests/unit/api/r125-furs-location-only.test.ts',
      ],
      integration: [],
      e2e: ['tests/e2e/furs-financial.spec.ts', 'tests/e2e/core-flow.spec.ts'],
    },
    browserShort: '⚠️ SIM (P5)',
    browserDetail:
      'P5: "Davčno overi" dialog živo — SIMULACIJA (račun ostane pending, EOR prazen, FURS_VERIFY_FAILED audit v failure path = core-flow FLOW-10).',
    realHardware: 'N/A',
    realPayment: 'N/A',
    realExternal: '☐',
    pilot: '☐',
    note: 'NOT PHYSICALLY VALIDATED — mTLS/JWS/EOR proti produkcijskemu FURS okolju nikoli izvedeno; certifikat = uporabniški korak (eDavki). Sim-mode = strukturna validacija, NE produkcijska.',
  },
  {
    id: 'printer',
    label: 'Tiskalniki',
    epic8: true,
    implemented: true,
    moduleIds: ['printers'],
    anchors: {
      unit: ['tests/unit/lib/z-report-print.test.ts'],
      integration: [],
      e2e: ['tests/e2e/core-flow.spec.ts'],
    },
    browserShort: '✅ P5',
    browserDetail: 'P5: tisk endpoint 200 (živo); Z-report print unit kanon (z-report-print).',
    realHardware: '☐',
    realPayment: 'N/A',
    realExternal: 'N/A',
    pilot: '☐',
    note: 'Realni tiskalnik ni fizično validiran (physicalValidationStatus.printer = false); tiskalniške failure poti (§9 Printing) = P1 obseg.',
  },
  {
    id: 'stock',
    label: 'Zaloge / COGS',
    epic8: true,
    implemented: true,
    moduleIds: ['inventory', 'recipes'],
    anchors: {
      unit: [
        'tests/unit/lib/yield.test.ts',
        'tests/unit/api/r124-soldout-enforcement.test.ts',
        'tests/unit/api/r121-stocktake.test.ts',
        'tests/unit/security/r161-last2-units.test.ts',
        'tests/unit/security/r120-batch-lot-fefo.test.ts',
      ],
      integration: ['tests/integration/r135-kiosk-order.test.ts'],
      e2e: ['tests/e2e/core-flow.spec.ts'],
    },
    browserShort: '✅ P5',
    browserDetail:
      'P5: živa zaloga v POS mreži; razknjižba + StockTransaction(type=sale) = core-flow FLOW-13 (§7 Inventory).',
    realHardware: 'N/A',
    realPayment: 'N/A',
    realExternal: 'N/A',
    pilot: '☐',
  },
  {
    id: 'daily-close',
    label: 'Smena / Z-poročilo / EOD',
    epic8: true,
    implemented: true,
    moduleIds: ['cash-register', 'z-report', 'end-of-day'],
    anchors: {
      unit: [
        'tests/unit/api/r126-daily-close.test.ts',
        'tests/unit/api/r158-zreport-gate.test.ts',
        'tests/unit/security/r110-eod-zreport-concurrency.test.ts',
      ],
      integration: ['tests/integration/r132-recon-drill.test.ts'],
      e2e: ['tests/e2e/core-flow.spec.ts'],
    },
    browserShort: '✅ R177',
    browserDetail:
      'R177: celotna §7 veriga 22/22 korakov (curl checkpoint runner — Open Shift → Close cashDifference 0 → Z finalize → EOD konsistenca); brskalniški kos (plačilo → račun) P5.',
    realHardware: 'N/A',
    realPayment: '☐',
    realExternal: 'N/A',
    pilot: '☐',
    note: 'Realno plačilo relevantno prek blagajniške izmene (gotovina); terminal NI fizično validiran.',
  },
  // ══ Razširitve po realni kodi (epik §8: "Expand this matrix according to the real codebase") ══
  {
    id: 'auth-access',
    label: 'PIN / WebAuthn / dostop',
    epic8: false,
    implemented: true,
    moduleIds: [],
    anchors: {
      unit: [
        'tests/unit/security/r99-webauthn-gate.test.ts',
        'tests/unit/security/session-revocation.test.ts',
        'tests/unit/security/session-token-hash.test.ts',
      ],
      integration: [],
      e2e: ['tests/e2e/pin-login-webauthn.spec.ts', 'tests/e2e/two-step-login.spec.ts'],
    },
    browserShort: '✅ R172+',
    browserDetail:
      'PIN prijava (2-stopnjska, 401 na napačen PIN) živo v vsaki rundi R172–R177; FIDO2 ceremony = e2e virtual authenticator (R99 kanon).',
    realHardware: '☐',
    realPayment: 'N/A',
    realExternal: 'N/A',
    pilot: '☐',
    note: 'WebAuthn = device attestation; realna biometrična naprava ni fizično validirana (e2e virtual authenticator).',
  },
  {
    id: 'tenant-security',
    label: 'Tenant / lokacijska izolacija',
    epic8: false,
    implemented: true,
    moduleIds: [],
    anchors: {
      unit: [
        'tests/unit/security/r81-audit-tenant-model.test.ts',
        'tests/unit/security/r84-reports-scope.test.ts',
        'tests/unit/security/r85-dashboard-tracking-scope.test.ts',
      ],
      integration: [],
      e2e: ['tests/e2e/multi-tenant-security.spec.ts'],
    },
    browserShort: '—',
    browserDetail: '— (dokaz = 99 security test fajlov + e2e MODELA-1..16 + IDEMPO-1..5)',
    realHardware: 'N/A',
    realPayment: 'N/A',
    realExternal: 'N/A',
    pilot: '☐',
  },
  {
    id: 'reservations-guest',
    label: 'Rezervacije & gostje',
    epic8: false,
    implemented: true,
    moduleIds: ['reservations', 'waitlist', 'guests', 'feedback', 'table-reservation-sync'],
    anchors: {
      unit: ['tests/unit/lib/reservation-overlap.test.ts'],
      integration: [
        'tests/integration/r140-feedback.test.ts',
        'tests/integration/r143-loyalty.test.ts',
      ],
      e2e: ['tests/e2e/workflow.spec.ts'],
    },
    browserShort: '✅ R175',
    browserDetail:
      'R175: rezervacije sekcija v Danes kokpitu (upcoming) živo; Table.status reserved flip = R102 CAS kanon.',
    realHardware: 'N/A',
    realPayment: 'N/A',
    realExternal: 'N/A',
    pilot: '☐',
  },
  {
    id: 'audit-compliance',
    label: 'Audit & skladnost',
    epic8: false,
    implemented: true,
    moduleIds: ['audit-log', 'compliance'],
    anchors: {
      unit: [
        'tests/unit/db/audit-log.test.ts',
        'tests/unit/api/r148-audit-retention.test.ts',
        'tests/unit/components/r148-audit-viewer.test.ts',
      ],
      integration: [],
      e2e: ['tests/e2e/core-flow.spec.ts'],
    },
    browserShort: '✅ R177',
    browserDetail:
      'R177: audit vrstice CREATE_ORDER/CREATE_PAYMENT preverjene v §7 verigi (FLOW-14); viewer živo R173 ("FURS" iskanje v paleti → compliance/furs moduli).',
    realHardware: 'N/A',
    realPayment: 'N/A',
    realExternal: 'N/A',
    pilot: '☐',
  },
  {
    id: 'reporting-eod',
    label: 'Poročila & analitika',
    epic8: false,
    implemented: true,
    moduleIds: ['reports', 'dashboard', 'end-of-day'],
    anchors: {
      unit: [
        'tests/unit/labor-reports.test.ts',
        'tests/unit/security/r80-aggregate-scope-a2-reports-shifts.test.ts',
      ],
      integration: ['tests/integration/r146-accounting-export.test.ts'],
      e2e: ['tests/e2e/dashboard-reports-edge.spec.ts', 'tests/e2e/core-flow.spec.ts'],
    },
    browserShort: '✅ R175',
    browserDetail:
      'R175: deep-link "Prodano danes" (Danes kokpit) → Poročila modul živo; EOD konsistenca = core-flow FLOW-18.',
    realHardware: 'N/A',
    realPayment: 'N/A',
    realExternal: 'N/A',
    pilot: '☐',
  },
  {
    id: 'backup-recovery',
    label: 'Backup / recovery',
    epic8: false,
    implemented: true,
    moduleIds: [],
    anchors: {
      unit: [],
      integration: ['tests/integration/r127-backup-restore-roundtrip.test.ts'],
      e2e: [],
    },
    browserShort: '—',
    browserDetail: '— (dokaz = round-trip IT v CI + živi drill)',
    realHardware: 'N/A',
    realPayment: 'N/A',
    realExternal: 'N/A',
    pilot: '☐',
    note: 'PHYSICALLY VALIDATED živi 6-fazni drill v sandboxu (R158, RTO 22 s) — omejitev: PGlite ≠ Neon produkcijska baza.',
  },
  {
    id: 'danes-cockpit',
    label: 'Danes kokpit (P0-01)',
    epic8: false,
    implemented: true,
    moduleIds: ['danes'],
    anchors: {
      unit: ['tests/unit/lib/module-registry.test.ts'],
      integration: [],
      e2e: [],
    },
    browserShort: '✅ R175',
    browserDetail:
      'R175: landing = Danes (admin 1111), 9/9 sekcij živo (KPI / izjeme / pregled / sistem), deep-link živ, EN preklop (Today/Sold today...) — glavni i18n dokaz.',
    realHardware: 'N/A',
    realPayment: 'N/A',
    realExternal: 'N/A',
    pilot: '☐',
    note: 'Prikazna plast nad obstoječimi endpointi (7 virov) — brez lastne API površine; e2e pokritost NI namenska (dokaz = unit pini + živa verifikacija).',
  },
  {
    id: 'workspaces-ia',
    label: 'Workspaces & IA (§6/P0-02)',
    epic8: false,
    implemented: true,
    moduleIds: [],
    anchors: {
      unit: ['tests/unit/lib/module-registry.test.ts'],
      integration: [],
      e2e: [],
    },
    browserShort: '✅ R176',
    browserDetail:
      'R176: 3 like živo (admin → Skrbnik path; Nina → Natakar path, Blagajna pravilno odsotna; Marko → Kuhinja landing KDS); paleta vrata (Nina "furs" → 0 zadetkov) = §6 regresija živa.',
    realHardware: 'N/A',
    realPayment: 'N/A',
    realExternal: 'N/A',
    pilot: '☐',
    note: 'Navigacijski model (52-testni drift-gate: register ≡ navItems ≡ moduleComponents ≡ i18n ×5); dostopna vrata ostajajo canAccessModule.',
  },
]

// ── Validacija (fail-closed) ────────────────────────────────────────

const REPO = process.cwd()

function validateCapabilities(): void {
  const registryIds = new Set(MODULE_REGISTRY.map((m) => m.id))
  const errors: string[] = []

  const prefixByKind: Record<keyof Anchors, string> = {
    unit: 'tests/unit/',
    integration: 'tests/integration/',
    e2e: 'tests/e2e/',
  }

  for (const cap of CAPABILITIES) {
    for (const kind of ['unit', 'integration', 'e2e'] as const) {
      for (const anchor of cap.anchors[kind]) {
        if (!anchor.startsWith(prefixByKind[kind])) {
          errors.push(`${cap.id}: sidro ${anchor} ni v ${prefixByKind[kind]}`)
        }
        if (!existsSync(join(REPO, anchor))) {
          errors.push(`${cap.id}: sidro NE OBSTAJA: ${anchor}`)
        }
      }
    }
    if (
      cap.anchors.unit.length === 0 &&
      cap.anchors.integration.length === 0 &&
      cap.anchors.e2e.length === 0
    ) {
      errors.push(`${cap.id}: ni niti enega dokaznega sidra`)
    }
    for (const mid of cap.moduleIds) {
      if (!registryIds.has(mid)) {
        errors.push(`${cap.id}: moduleId "${mid}" ne obstaja v §6 registerju`)
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`VALIDATION-MATRIX sidra niso veljavna:\n${errors.join('\n')}`)
  }
}

// ── Dokument ────────────────────────────────────────────────────────

const countAll = (cap: ValidationCapability, kind: keyof Anchors): number => cap.anchors[kind].length

export function buildMatrixDoc(): string {
  validateCapabilities()

  const epic8Rows = CAPABILITIES.filter((c) => c.epic8)
  const expansionRows = CAPABILITIES.filter((c) => !c.epic8)
  const totalAnchors = (kind: keyof Anchors): number =>
    CAPABILITIES.reduce((acc, c) => acc + countAll(c, kind), 0)

  const lines: string[] = []

  lines.push('# VALIDATION-MATRIX (§8)')
  lines.push('')
  lines.push('> ⚙️ GENERIRANO z `scripts/generate-validation-matrix.ts` (bun run matrix) — **NE urejati ročno**.')
  lines.push('> Kritično pravilo epika #144 §8: **"Green CI is not the same thing as production validation."**')
  lines.push('> **Zelen CI NI isto kot produkcijska validacija.** Vsak ✓ je sidran na konkretno testno')
  lines.push('> datoteko (fail-closed preverjeno ob generaciji); "realni" kanali ostajajo NE-validirani.')
  lines.push('')

  lines.push(
    `**${CAPABILITIES.length} zmožnosti** (${epic8Rows.length} iz epika §8 + ${expansionRows.length} razširitev po realni kodi) · ` +
      `${totalAnchors('unit')} unit sidrov · ${totalAnchors('integration')} IT · ${totalAnchors('e2e')} E2E · ` +
      `0 pilotnih trditev`,
  )
  lines.push('')

  lines.push('| Zmožnost | Implementirano | Unit | Integracija | E2E | Brskalnik (živo) | Realni hardver | Realno plačilo | Realna zunanja storitev | Pilot |')
  lines.push('|---|---|---|---|---|---|---|---|---|---|')
  for (const cap of CAPABILITIES) {
    const u = countAll(cap, 'unit')
    const i = countAll(cap, 'integration')
    const e = countAll(cap, 'e2e')
    const mods = cap.moduleIds.length > 0 ? ` (\`${cap.moduleIds.join('`, `')}\`)` : ''
    lines.push(
      `| \`${cap.id}\` ${cap.label}${mods} | ✅ koda | ${u > 0 ? `✅ ${u}` : '—'} | ${i > 0 ? `✅ ${i}` : '—'} | ${e > 0 ? `✅ ${e}` : '—'} | ${cap.browserShort} | ${cap.realHardware} | ${cap.realPayment} | ${cap.realExternal} | ${cap.pilot} |`,
    )
  }
  lines.push('')

  lines.push('## Dokazna sidra (vsako sidro = fs-verified testna datoteka)')
  lines.push('')
  for (const cap of CAPABILITIES) {
    const mods = cap.moduleIds.length > 0 ? ` · §6 moduli: \`${cap.moduleIds.join('`, `')}\`` : ''
    lines.push(`### \`${cap.id}\` — ${cap.label}${cap.epic8 ? '' : ' (razširitev)'}${mods}`)
    lines.push('')
    if (cap.anchors.unit.length > 0) {
      lines.push('- **Unit**: ' + cap.anchors.unit.map((a) => `\`${a}\``).join(', '))
    }
    if (cap.anchors.integration.length > 0) {
      lines.push('- **Integracija (realna DB)**: ' + cap.anchors.integration.map((a) => `\`${a}\``).join(', '))
    }
    if (cap.anchors.e2e.length > 0) {
      lines.push('- **E2E (realni PG, CI)**: ' + cap.anchors.e2e.map((a) => `\`${a}\``).join(', '))
    }
    lines.push(`- **Brskalnik (živo, sandbox)**: ${cap.browserDetail}`)
    if (cap.note) lines.push(`- **Opomba**: ${cap.note}`)
    lines.push('')
  }

  lines.push('## Legenda')
  lines.push('')
  lines.push('- **Implementirano ✅ koda** = funkcionalnost obstaja v kodi; NE pomeni produkcijske validacije (glej kritično pravilo zgoraj).')
  lines.push('- **Unit / Integracija / E2E** = število fs-verified dokaznih datotek (sidra spodaj). Integracija teče na realni PostgreSQL v CI; E2E = Playwright na realnem PG.')
  lines.push('- **Brskalnik (živo)** = sandbox živa verifikacija iz rund (P5 = zlati tok; R### = poročila na issue #144). Ni produktivni ekvivalent realne naprave.')
  lines.push('- **N/A** = kanal za to zmožnost ni relevanten. **☐** = kanal je relevanten, a NI validiran (fizična validacija je ločen obseg — `physicalValidationStatus` v PRODUCT-STATUS.md).')
  lines.push('- **Pilot ☐** = ni pilotnih podatkov (`pilotStatus.executed = false`). Ne trditi pilotne pripravljenosti brez izvedenega pilota (epik §16).')
  lines.push('')
  lines.push('## Anti-overclaim')
  lines.push('')
  lines.push('- FURS je koda-complete + sim-mode strukturno validiran — **NOT PHYSICALLY VALIDATED** z realnim FURS okoljem (mTLS/JWS/EOR).')
  lines.push('- Plačilni terminal, tiskalnik, KDS device in realne zunanje storitve niso fizično validirani v tem repozitoriju.')
  lines.push('- Vsak nadaljnji ✓ v tabeli zahteva NOV dokaz (test datoteka / živa verifikacija z rundno referenco) — ne sodbo.')
  lines.push('')

  return lines.join('\n')
}

// ── Pisanje (samo pri direktnem zagonu, ne pri importu iz testov) ───

const OUT = join(REPO, 'docs', 'VALIDATION-MATRIX.md')
const isDirectRun =
  typeof process !== 'undefined' &&
  typeof process.argv[1] === 'string' &&
  process.argv[1].replace(/\\/g, '/').includes('generate-validation-matrix')

if (isDirectRun) {
  writeFileSync(OUT, buildMatrixDoc(), 'utf-8')
  console.log(
    `[validation-matrix] docs/VALIDATION-MATRIX.md regeneriran (${CAPABILITIES.length} zmožnosti, ${CAPABILITIES.filter((c) => c.epic8).length} epik §8).`,
  )
}
