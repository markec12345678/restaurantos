// ============================================
// R94-a — LEGACY 429 VAL: inline NextResponse.json 429 bloki → rateLimitedResponse
// ============================================
// Zgodovina: pred R94 je ~55 API fajlov še vedno gradilo 429 odgovor INLINE
// (dedičina pred R92-b): telo { error: '<razno>' }, po potrebi ročna
// Retry-After glava `Math.ceil((retryAfterMs || 60000)/1000)` — nekateri
// (kiosk, qr-pay, admin/migrate, webauthn) BREZ glav sploh. R94-a vse te
// bloke migrira na canon helper rateLimitedResponse (src/lib/rate-limit/response.ts,
// R92-b) — telo (sporočilo) OHRANJENO dobesedno, glave pa zdaj VEDNO polne
// (Retry-After + X-RateLimit-Remaining + X-RateLimit-Reset, 60 s fallback).
//
// Zakaj fs-guard (readFileSync + source asserti) in ne runtime pin-i:
//   - runtime 429 obliko ŽE pinjajo r92-429-shape (helper), r92-rate-limit-wave,
//     r89-token-rotate, r93-mobile-rate-limit — ti ostanejo zeleni brez editov.
//   - fs-guard lovi regresijo, ki je runtime pin-i ne vidijo: kdor koli doda
//     NAZAJ inline NextResponse.json 429 blok (duplikat kanona = drift) ali
//     spremeni/stakne obstoječi checkRateLimitAsync store key — takoj rdeče.
//
// Ključna invarianta: helper je importiran DIREKTNO iz '@/lib/rate-limit/response'
// (NE prek barrela '@/lib/rate-limit') — testi mockajo barrel z vi.hoisted
// tovarnami; direkten path teče REALEN helper (R92-b/R93-b dokazan vzorec).
//
// Zavestno IZLOŽENO (ni v tej migraciji):
//   - src/app/api/auth/route.ts:77 — PIN-lockout veja (lockout ≠ rate limiter,
//     R92-b odločitev, pinana v r92-429-shape.test.ts);
//   - src/app/reports/digest/page.tsx — client PAGE, samo bere res.status === 429
//     (ne gradi 429 odgovora);
//   - src/lib/middleware/api-protection.ts — middleware plast (src/lib je frozen,
//     že nosi polne glave + X-Request-ID).
// ============================================

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

// (fajl, checkRateLimitAsync store ključi, število rateLimitedResponse call-site-ov)
const CONVERTED_FILES: ReadonlyArray<{ file: string; keys: string[]; sites: number }> = [
  { file: 'src/app/api/dashboard/route.ts', keys: ['dashboard'], sites: 1 },
  { file: 'src/app/api/setup/super-admin/route.ts', keys: ['setup-super-admin'], sites: 1 },
  { file: 'src/app/api/setup/db/route.ts', keys: ['setup-db'], sites: 1 },
  { file: 'src/app/api/setup/init/route.ts', keys: ['setup-init'], sites: 1 },
  { file: 'src/app/api/ai-assistant/route.ts', keys: ['ai-assistant'], sites: 1 },
  { file: 'src/app/api/ai/nl-query/route.ts', keys: ['ai-nl-query'], sites: 1 },
  { file: 'src/app/api/ai/qr-upsell/route.ts', keys: ['ai-upsell'], sites: 1 },
  { file: 'src/app/api/ai/voice-order/route.ts', keys: ['ai-voice-order'], sites: 1 },
  { file: 'src/app/api/ai/forecast/route.ts', keys: ['ai-forecast'], sites: 1 },
  { file: 'src/app/api/seed-food-norms/route.ts', keys: ['seed-food-norms'], sites: 1 },
  { file: 'src/app/api/monitoring/errors/route.ts', keys: ['monitoring-errors'], sites: 1 },
  { file: 'src/app/api/delivery/webhook/glovo/route.ts', keys: ['glovo-webhook'], sites: 1 },
  { file: 'src/app/api/delivery/webhook/wolt/route.ts', keys: ['wolt-webhook'], sites: 1 },
  { file: 'src/app/api/delivery/webhook/bolt/route.ts', keys: ['bolt-webhook'], sites: 1 },
  { file: 'src/app/api/iot/readings/route.ts', keys: ['iot-readings'], sites: 1 },
  { file: 'src/app/api/settings/test-email/route.ts', keys: ['settings-test-email'], sites: 1 },
  { file: 'src/app/api/settings/route.ts', keys: ['settings'], sites: 2 },
  { file: 'src/app/api/reports/financial/route.ts', keys: ['reports-financial'], sites: 1 },
  { file: 'src/app/api/reports/digest-preview/route.ts', keys: ['digest-preview'], sites: 1 },
  { file: 'src/app/api/reports/vat/route.ts', keys: ['reports-vat'], sites: 1 },
  { file: 'src/app/api/reports/digest-trend/route.ts', keys: ['digest-trend'], sites: 1 },
  { file: 'src/app/api/reports/eod/route.ts', keys: ['reports-eod'], sites: 2 },
  { file: 'src/app/api/reports/sales/route.ts', keys: ['reports-sales'], sites: 1 },
  { file: 'src/app/api/reports/digest-send/route.ts', keys: ['digest-send'], sites: 1 },
  { file: 'src/app/api/seed/route.ts', keys: ['seed'], sites: 1 },
  { file: 'src/app/api/cash-register/route.ts', keys: ['cash-register'], sites: 2 },
  { file: 'src/app/api/print/route.ts', keys: ['print'], sites: 1 },
  { file: 'src/app/api/employees/route.ts', keys: ['employees'], sites: 2 },
  { file: 'src/app/api/digital-receipt/route.ts', keys: ['digital-receipt'], sites: 1 },
  { file: 'src/app/api/public/menu/route.ts', keys: ['public-menu'], sites: 1 },
  { file: 'src/app/api/public/promo-check/route.ts', keys: ['promo-check'], sites: 1 },
  { file: 'src/app/api/public/kiosk/route.ts', keys: ['kiosk-menu', 'kiosk-order'], sites: 2 },
  { file: 'src/app/api/public/online-order/route.ts', keys: ['online-order'], sites: 1 },
  { file: 'src/app/api/public/call-waiter/route.ts', keys: ['call-waiter'], sites: 1 },
  { file: 'src/app/api/orders/route.ts', keys: ['orders'], sites: 2 },
  { file: 'src/app/api/public/order/route.ts', keys: ['public-order'], sites: 1 },
  { file: 'src/app/api/public/order-config/route.ts', keys: ['order-config'], sites: 1 },
  { file: 'src/app/api/public/delivery-check/route.ts', keys: ['delivery-check'], sites: 1 },
  { file: 'src/app/api/public/verify-table/route.ts', keys: ['verify-table'], sites: 1 },
  { file: 'src/app/api/feedback-public/route.ts', keys: ['feedback-public'], sites: 1 },
  { file: 'src/app/api/public/order-track/route.ts', keys: ['order-track'], sites: 1 },
  { file: 'src/app/api/furs/helpers/storno-invoice/validate-and-submit.ts', keys: ['furs'], sites: 1 },
  { file: 'src/app/api/furs/helpers/verify-invoice/validate-and-submit.ts', keys: ['furs'], sites: 1 },
  { file: 'src/app/api/furs/route.ts', keys: ['furs'], sites: 1 },
  { file: 'src/app/api/seed-norms/route.ts', keys: ['seed-norms'], sites: 1 },
  { file: 'src/app/api/admin/migrate/route.ts', keys: ['migrate'], sites: 1 },
  { file: 'src/app/api/qr-pay/confirm/route.ts', keys: ['qr-pay-confirm'], sites: 1 },
  { file: 'src/app/api/qr-pay/route.ts', keys: ['qr-pay-session'], sites: 1 },
  { file: 'src/app/api/inventory/route.ts', keys: ['inventory'], sites: 2 },
  { file: 'src/app/api/cis/submit-invoice/route.ts', keys: ['cis-submit-invoice'], sites: 1 },
  { file: 'src/app/api/cis/test-invoice/route.ts', keys: ['cis-test-invoice'], sites: 1 },
  { file: 'src/app/api/cis/echo/route.ts', keys: ['cis-retry-pending', 'cis-echo'], sites: 2 },
  { file: 'src/app/api/loyalty/route.ts', keys: ['loyalty'], sites: 2 },
  { file: 'src/app/api/gift-cards/route.ts', keys: ['gift-cards'], sites: 2 },
  { file: 'src/app/api/auth/webauthn/route.ts', keys: ['webauthn-challenge', 'webauthn-login'], sites: 2 },
]

const HELPER_IMPORT = "from '@/lib/rate-limit/response'"

function readRepoFile(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split('/')), 'utf-8')
}

function listApiTsFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf-8' })
    .filter((f) => f.endsWith('.ts'))
    .map((f) => `${dir}/${f}`)
}

describe('R94-a — legacy 429 val migriran na rateLimitedResponse (fs-guard)', () => {
  it.each(CONVERTED_FILES)('$file: direkten helper import + brez inline 429 + ključi $keys', ({ file, keys, sites }) => {
    const src = readRepoFile(file)

    // 1. DIREKTEN helper import (ne barrel) — vzorec R92-b rotate / R93-b.
    expect(src).toContain(HELPER_IMPORT)

    // 2. Inline 'X-RateLimit-Remaining' header konstrukcija IZKORENJENA
    //    (glave prihajajo izključno iz helperja — enoten kontrakt).
    expect(src).not.toMatch(/X-RateLimit-Remaining.*:.*'0'/)

    // 3. Helper dejansko uporabljen (call-site števec — 2-method fajli imajo 2;
    //    import vrstice regex NE šteje, ker za imenom ni oklepaja).
    const callSites = src.match(/rateLimitedResponse\(/g)?.length ?? 0
    expect(callSites).toBe(sites)
  })

  it('vsak converted fajl še vedno drži svoje originalne checkRateLimitAsync store ključe (placement/key guard)', () => {
    for (const { file, keys } of CONVERTED_FILES) {
      const src = readRepoFile(file)
      for (const key of keys) {
        expect(src).toContain(`checkRateLimitAsync('${key}'`)
      }
    }
  })

  it('count pin: natanko 55 fajlov / 66 call-site-ov v seznamu', () => {
    expect(CONVERTED_FILES).toHaveLength(55)
    const total = CONVERTED_FILES.reduce((sum, { file }) => {
      return sum + (readRepoFile(file).match(/rateLimitedResponse\(/g)?.length ?? 0)
    }, 0)
    // vsak call-site natanko enkrat (import vrstica nima oklepaja — ne šteje)
    expect(total).toBe(66)
  })

  it('brez odvečnih NextResponse 429 blokov v src/app/api (razen PIN-lockout v auth/route.ts)', () => {
    const offenders: string[] = []
    for (const abs of listApiTsFiles('src/app/api')) {
      const src = readFileSync(abs, 'utf-8')
      if (!/status:\s*429/.test(src)) continue
      if (abs.endsWith('src/app/api/auth/route.ts')) continue // PIN-lockout veja — namerno (R92-b)
      offenders.push(abs)
    }
    expect(offenders).toEqual([])
  })

  // ---- (b) body-preservation spot-checks — originalni stringi dobesedno ----
  it('telo "Preveč zahtevkov" ohranjeno (settings ×2, kratka legacy oblika)', () => {
    const src = readRepoFile('src/app/api/settings/route.ts')
    const occurrences = src.match(/rateLimitedResponse\(rl\.retryAfterMs, 'Preveč zahtevkov'\)/g)?.length ?? 0
    expect(occurrences).toBe(2)
  })

  it('telo "… čez nekaj sekund." ohranjeno (public/menu, javna pot)', () => {
    const src = readRepoFile('src/app/api/public/menu/route.ts')
    expect(src).toContain("rateLimitedResponse(rateCheck.retryAfterMs, 'Preveč zahtevkov. Poskusite znova čez nekaj sekund.')")
  })

  it('telo "Seed je omejen na 3 zahtevke na uro." ohranjeno (seed)', () => {
    const src = readRepoFile('src/app/api/seed/route.ts')
    expect(src).toContain("rateLimitedResponse(rateLimit.retryAfterMs, 'Preveč zahtevkov. Seed je omejen na 3 zahtevke na uro.')")
  })

  it('telo "Preveč naročil…" ohranjeno (public/order) + "Preveč klicev…" (call-waiter)', () => {
    expect(readRepoFile('src/app/api/public/order/route.ts')).toContain(
      "rateLimitedResponse(rateCheck.retryAfterMs, 'Preveč naročil. Poskusite znova čez nekaj minut.')"
    )
    expect(readRepoFile('src/app/api/public/call-waiter/route.ts')).toContain(
      "rateLimitedResponse(rateCheck.retryAfterMs, 'Preveč klicev. Poskusite znova čez nekaj minut.')"
    )
  })

  it('telo "… čez minuto." ohranjeno (qr-pay — prej BREZ glav, zdaj poln kanon)', () => {
    const src = readRepoFile('src/app/api/qr-pay/route.ts')
    expect(src).toContain("rateLimitedResponse(rateCheck.retryAfterMs, 'Preveč zahtevkov. Poskusite znova čez minuto.')")
  })

  it('webauthn minute-based telo ohranjeno (template literal, R92-b auth IP-vzorec)', () => {
    const src = readRepoFile('src/app/api/auth/webauthn/route.ts')
    expect(src).toContain('rateLimitedResponse(rateCheck.retryAfterMs, `Preveč zahtevkov. Poskusite znova čez ${retryMin} min.`)')
    expect(src).toContain('rateLimitedResponse(rateCheck.retryAfterMs, `Preveč neuspešnih poskusov. Poskusite znova čez ${retryMin} min.`)')
  })

  it('canon helper (src/lib/rate-limit/response.ts) NEspremenjen — 3-glavna oblika', () => {
    const src = readRepoFile('src/lib/rate-limit/response.ts')
    expect(src).toContain('export function rateLimitedResponse(')
    expect(src).toContain("message = 'Preveč zahtev. Poskusite znova čez nekaj časa.'")
    expect(src).toContain('{ error: message }')
    expect(src).toContain('status: 429')
    expect(src).toContain("'Retry-After': String(retryAfter)")
    expect(src).toContain("'X-RateLimit-Remaining': '0'")
    expect(src).toContain('retryAfterMs ?? 60000')
  })
})
