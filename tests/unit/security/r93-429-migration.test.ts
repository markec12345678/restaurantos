// ============================================
// R93-b — 429 MIGRACIJA: inline kanon bloki → rateLimitedResponse
// ============================================
// Zgodovina: R92-a je 11 admin write/izdajnih rut (integrations, locations,
// webhooks familije) zaščitil z inline 429 NextResponse.json bloki, ki so
// ROČNO podvajali hišni kanon (withRateLimit HOF oblika): telo
// 'Preveč zahtev. ...', Retry-After = ceil((retryAfterMs ?? 60000)/1000),
// X-RateLimit-Remaining '0', X-RateLimit-Reset unix+retryAfter. R92-b je ta
// oblika izvlekel v enoten helper rateLimitedResponse (rate-limit/response.ts),
// R93-b pa vse inline duplikate migrira nanj (istega R92-b vzorca kot
// ordering-token/rotate ruta).
//
// Zakaj fs-guard (readFileSync + source asserti) in ne runtime mock testi:
//   - runtime obliko 429 odgovorov ŽE pinjajo r92-429-shape (helper + auth),
//     r92-rate-limit-wave (4 rut iz te migracije) in r89-token-rotate — ti
//     ostanejo zeleni BREZ sprememb (helper oblika byte-identična inline bloku).
//   - fs-guard lovi regresijo, ki runtime pin-i ne morejo: kdor koli doda NAZAJ
//     inline NextResponse.json 429 blok (duplikat kanona = prihodnji drift) ali
//     odstrani/stakne fiksni store key (per-id fan-out luknja) — takoj rdeče.
//
// Ključna invarianta: helper je importiran DIREKTNO iz '@/lib/rate-limit/response'
// (NE prek barrela '@/lib/rate-limit') — testi (r92-rate-limit-wave, r89-token-rotate,
// ...) mockajo barrel z vi.hoisted tovarnami; nov barrel export bi vrgel vitest
// strict-mock error, direkten path pa teče REALEN helper (R92-b dokazan vzorec).
// ============================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// (fajl, fiksni store key, pričakovano število rateLimitedResponse call-site-ov)
const MIGRATED_FILES: ReadonlyArray<{ file: string; key: string; sites: number }> = [
  { file: 'src/app/api/integrations/route.ts', key: "'integrations-post'", sites: 1 },
  { file: 'src/app/api/integrations/[id]/route.ts', key: "'integrations-mutate'", sites: 2 },
  { file: 'src/app/api/integrations/[id]/rotate-key/route.ts', key: "'integrations-rotate-key'", sites: 1 },
  { file: 'src/app/api/integrations/[id]/sync/route.ts', key: "'integrations-sync'", sites: 1 },
  { file: 'src/app/api/integrations/scheduler/route.ts', key: "'integrations-scheduler'", sites: 1 },
  { file: 'src/app/api/locations/route.ts', key: "'locations-post'", sites: 1 },
  { file: 'src/app/api/locations/[id]/route.ts', key: "'locations-mutate'", sites: 2 },
  { file: 'src/app/api/locations/sync/route.ts', key: "'locations-sync'", sites: 1 },
  { file: 'src/app/api/webhooks/route.ts', key: "'webhooks-post'", sites: 1 },
  { file: 'src/app/api/webhooks/[id]/route.ts', key: "'webhooks-mutate'", sites: 2 },
  { file: 'src/app/api/webhooks/deliveries/route.ts', key: "'webhooks-deliveries-retry'", sites: 1 },
  // SMS (R93-b Package 2): prej SAMO Retry-After glava + telo 'Preveč zahtevkov'
  // (manjkajoči X-RateLimit-Remaining/Reset) — zdaj kanon z OHRANJENIM telesom.
  { file: 'src/app/api/sms/route.ts', key: "'sms'", sites: 2 },
]

const HELPER_IMPORT = "import { rateLimitedResponse } from '@/lib/rate-limit/response'"

function readRepoFile(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split('/')), 'utf-8')
}

describe('R93-b — 429 migracija na rateLimitedResponse (fs-guard)', () => {
  it.each(MIGRATED_FILES)('$file: helper direkten import + brez inline 429 bloka + fiksni ključ "$key"', ({ file, key, sites }) => {
    const src = readRepoFile(file)

    // 1. DIREKTEN helper import (ne barrel) — vzorec R92-b rotate rute.
    expect(src).toContain(HELPER_IMPORT)

    // 2. Inline kanon 429 blok je IZKORENJEN: noben NextResponse 429 z
    //    ročnimi X-RateLimit-* glavami / retryAfter matematiko v tem fajlu
    //    (glave prihajajo IZKLJUČNO iz helperja — enoten kontrakt).
    expect(src).not.toMatch(/status:\s*429/)
    expect(src).not.toMatch(/['"]X-RateLimit-Remaining['"]\s*:/)
    expect(src).not.toMatch(/retryAfterMs\s*(\?\?|\|\|)\s*60000/)

    // 3. Helper dejansko uporabljen (call-site števec — PUT+DELETE fajli imata 2).
    const callSites = src.match(/return rateLimitedResponse\(/g)?.length ?? 0
    expect(callSites).toBe(sites)

    // 4. Placement guard: fiksni store key checkRateLimitAsync klic NEODSTAKNJEN
    //    (ključ NI iz pathname — preprečuje per-id fan-out iz enega IP-ja).
    expect(src).toContain(`checkRateLimitAsync(${key}`)
  })

  it('skupno število migriranih call-site-ov = 16 (14 Package-1 + 2 SMS)', () => {
    const total = MIGRATED_FILES.reduce((sum, { file }) => {
      return sum + (readRepoFile(file).match(/return rateLimitedResponse\(/g)?.length ?? 0)
    }, 0)
    expect(total).toBe(16)
  })

  it('SMS telo "Preveč zahtevkov" OHRANJENO (zgodovinski pin te rute)', () => {
    const src = readRepoFile('src/app/api/sms/route.ts')
    // R93-b: samo glave DOBIŠ (kanon), sporočilo se NE spremeni — obstoječi
    // klienti/testi, ki pinjajo to telo, ostanejo veljavni.
    const occurrences = src.match(/rateLimitedResponse\(rl\.retryAfterMs, 'Preveč zahtevkov'\)/g)?.length ?? 0
    expect(occurrences).toBe(2)
  })

  it('kanon helper (src/lib/rate-limit/response.ts) NEspremenjen — 3-glavna oblika', () => {
    const src = readRepoFile('src/lib/rate-limit/response.ts')

    // Export + privzeto hišno sporočilo (canon telo).
    expect(src).toContain('export function rateLimitedResponse(')
    expect(src).toContain("message = 'Preveč zahtev. Poskusite znova čez nekaj časa.'")
    expect(src).toContain('{ error: message }')

    // 3 glave kanona + status 429 + 60 s fallback (retryAfterMs ?? 60000).
    expect(src).toContain('status: 429')
    expect(src).toContain("'Retry-After': String(retryAfter)")
    expect(src).toContain("'X-RateLimit-Remaining': '0'")
    expect(src).toContain("'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + retryAfter)")
    expect(src).toContain('retryAfterMs ?? 60000')
  })
})
