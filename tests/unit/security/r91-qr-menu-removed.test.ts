// ============================================
// R91 — /api/qr-menu ODSTRANJEN — regresijski varovalki
// ============================================
// Zgodovina: /api/qr-menu je bil javni GET z P0-C3B fallbackom (brez
// ?locationId → findFirst({ isActive: true }, orderBy createdAt asc) = prva
// aktivna lokacija KATEREGA KOLI tenanta → njen celoten meni + branding,
// anonimno). R90-1 je ta fallback izkoreninil iz /api/public/menu in
// /api/public/kiosk, ta pa je bil NEDOJAVLJEN sibling vse do R91, ko je
// e2e pin audit (MENU-4/EDGE-8 so pinjale to surface kot "pričakovano
// vedenje") razkril, da ruta še živi.
//
// R91 odločitev: ruta je IZBRISANA (ne canon-fix), ker:
//   1. NI produkcijskih klicočev (stran /qr-menu bere /api/public/menu —
//      R90-2 sekvenčni tok; noben fetch v repozitoriju ne cilja /api/qr-menu),
//   2. je funkcionalni duplikat /api/public/menu (isti {menus, settings}),
//   3. redundantna anonimna površina = napadna površina (surface minimizacija).
//
// Testa varujeta dve stvari:
//   A. PUBLIC_GET_ROUTES ne sme več vsebovati '/api/qr-menu' (re-allowlisting
//      izbrisane surface = takojšen cross-tenant read leak).
//   B. Ruta fajl NE SME obstajati (kdor koli re-adda samo route.ts brez
//      allowlist pin-a dobi 401 na vseh preverjenih GET klicih — fail-closed;
//      allowlist + route morata biti VEDNO skupaj).
// ============================================

import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import { PUBLIC_GET_ROUTES } from '@/lib/auth-middleware/constants'

describe('R91 — /api/qr-menu odstranjen (P0-C3B residual)', () => {
  it('A: PUBLIC_GET_ROUTES ne vsebuje /api/qr-menu', () => {
    expect(PUBLIC_GET_ROUTES.some(r => r.startsWith('/api/qr-menu'))).toBe(false)
  })

  it('B: route fajl /api/qr-menu/route.ts ne obstaja (izbrisan)', () => {
    const routeFile = join(process.cwd(), 'src', 'app', 'api', 'qr-menu', 'route.ts')
    expect(existsSync(routeFile)).toBe(false)
  })

  it('C: javni meni ostane izključno /api/public (allowlist kanon nespremenjen)', () => {
    // /api/public prefix pokriva /api/public/menu (R90 kanon: izrecen
    // ?locationId obvezen) — edini javni meni surface.
    expect(PUBLIC_GET_ROUTES).toContain('/api/public')
    // Ostali javni GET-i (nespremenjeni s strani R91 — pin proti pomotičnim
    // allowlist čistilam v prihodnjih rundah):
    expect(PUBLIC_GET_ROUTES).toContain('/api/auth')
    expect(PUBLIC_GET_ROUTES).toContain('/api/digital-receipt')
    expect(PUBLIC_GET_ROUTES).toContain('/api/feedback-public')
  })
})
