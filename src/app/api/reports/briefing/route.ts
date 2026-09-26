// ============================================
// P2-28 (epic #115, R141-b) — GET /api/reports/briefing
// Manager daily briefing: EN strežniški agregat za jutranji pregled menedžerja
// namesto 8–12 klijentskih klicev na heterogenimi gates in TZ semantiko
// (kontrakt R141-a audit). Sekcije: reservations, staff, inventory,
// purchasing, yesterday, issues, kds.
//
// Kanon (1:1 z /api/dashboard):
//   • force-dynamic + maxDuration 30 (dragocenejše agregacije),
//   • rate limit AUTHENTICATED_LIMIT bucket 'reports-briefing' (obstoječi
//     preset — novi NE izmišljevati, R140-b),
//   • requireAuth view_reports + resolveTenantLocationIdOrThrow (fail-closed;
//     lokacijska seja IGNORIRA ?locationId, super-admin brez parametra = null
//     scope = globalni pogled),
//   • deepToNumbers na meji odgovora,
//   • VSAKA sekcija v svojem try/catch z nevtralnim fallbackom — ena padla
//     sekcija nikoli ne 500-a celotnega briefinja; napaka gre v strukturiran
//     log (nikoli v odgovor),
//   • Cache-Control no-store (osvežinski pregled, ni cache-friendly),
//   • brez createAuditLog (read-only GET — vsi report GET-i).
//
// ČASOVNI KANON P2-08/R126: "danes"/"včeraj" sekcije rabi ljubljanaDayBounds
// (LJ poslovni dan). Obstoječi /api/reports/sales rabi UTC meje — briefing
// tega NAMERNO ne posnema (R126 lekcija: UTC meje prestavijo nočna plačila v
// napačen poslovni dan). Podrobnosti per-model v _helpers.ts headerju.

import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError } from '@/lib/api-utils'
import { deepToNumbers } from '@/lib/decimal'
import { logger } from '@/lib/logger'
import { ljubljanaDayBounds, ljubljanaTodayStr } from '@/lib/timezone-sl'
import {
  fetchReservationsSection,
  fetchStaffSection,
  fetchInventorySection,
  fetchPurchasingSection,
  fetchYesterdaySection,
  fetchIssuesSection,
  fetchKdsSection,
  NEUTRAL_RESERVATIONS,
  NEUTRAL_STAFF,
  NEUTRAL_PURCHASING,
  NEUTRAL_YESTERDAY,
  NEUTRAL_ISSUES,
  NEUTRAL_KDS,
  addDaysToYmd,
  type InventorySectionData,
} from './_helpers'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const DATE_FORMAT_RE = /^\d{4}-\d{2}-\d{2}$/

// Nevtralni fallback sekcije inventory (vključno z internimi števci za
// issues.operational — v odgovor grejo SAMO kontraktna polja).
const NEUTRAL_INVENTORY: InventorySectionData = {
  lowStock: [], lowStockCount: 0, expiring: [], expiredCount: 0,
  _criticalCount: 0, _expiringTotal: 0,
}

/** Dashboard-kanon .catch tovarna: logiraj sekcijo, vrni nevtralni fallback. */
function sectionFallback<T>(section: string, neutral: T) {
  return (error: unknown): T => {
    logger.error('GET /api/reports/briefing', 'BRIEFING_SECTION_FALLBACK', {
      section,
      error: error instanceof Error ? error.message : String(error),
    })
    return neutral
  }
}

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja (pariteta dashboard/eod)
    const rl = await checkRateLimitAsync('reports-briefing', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    // date: opcijsko — privzeto današnji LJ poslovni dan; format pin YYYY-MM-DD.
    // (validacija PRED scope resolverjem — pariteta /api/reports/eod)
    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date')
    if (dateParam != null && dateParam !== '') {
      // Format + semantika: ljubljanaDayBounds bi '2026-13-99' tiho
      // normaliziral (Date.UTC overflow), zato briefing zavraža že mesece
      // 01-12 in dneve 01-31 (nadaljnja semantika - npr. 30. februar - ostane
      // na ljubljanaDayBounds normalizaciji, kot pri digest-trend kanonu).
      const mm = Number(dateParam.slice(5, 7))
      const dd = Number(dateParam.slice(8, 10))
      if (!DATE_FORMAT_RE.test(dateParam) || mm < 1 || mm > 12 || dd < 1 || dd > 31) {
        return NextResponse.json(
          { error: 'Neveljaven datum (pričakovan YYYY-MM-DD).' },
          { status: 400 },
        )
      }
    }
    const date = dateParam != null && dateParam !== '' ? dateParam : ljubljanaTodayStr()

    // R80/R85 kanon: tenant scope — lokacijska seja je avtoritativna
    // (?locationId IGNORIRAN), super-admin brez parametra = null scope
    // (globalni pogled — sekciji, ki brez lokacije ne moreta odgovoriti,
    // vrneta null, ne izmišljenega "none").
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/reports/briefing',
    })
    if ('error' in scope) return scope.error
    const locationId = scope.locationId

    // LJ poslovni dnevi (P2-08): izbrani dan, včeraj (sales/waste/KDS/Z/DC)
    // in predvčerajšnji (revenueChangePct primerjava).
    const todayBounds = ljubljanaDayBounds(date)
    const yesterdayYmd = addDaysToYmd(date, -1)
    const yBounds = ljubljanaDayBounds(yesterdayYmd)
    const d2Bounds = ljubljanaDayBounds(addDaysToYmd(date, -2))

    // Vse sekcije VZPOREDNO (dashboard kanon) — vsaka z lastnim .catch.
    const [reservations, staff, inventoryData, purchasing, yesterday, issues, kds] = await Promise.all([
      fetchReservationsSection(locationId, todayBounds)
        .catch(sectionFallback('reservations', NEUTRAL_RESERVATIONS)),
      fetchStaffSection(locationId, date)
        .catch(sectionFallback('staff', NEUTRAL_STAFF)),
      fetchInventorySection(locationId, date, todayBounds)
        .catch(sectionFallback('inventory', NEUTRAL_INVENTORY)),
      fetchPurchasingSection(locationId, todayBounds)
        .catch(sectionFallback('purchasing', NEUTRAL_PURCHASING)),
      fetchYesterdaySection(locationId, yesterdayYmd, yBounds, d2Bounds)
        .catch(sectionFallback('yesterday', NEUTRAL_YESTERDAY)),
      fetchIssuesSection(locationId)
        .catch(sectionFallback('issues', NEUTRAL_ISSUES)),
      fetchKdsSection(locationId, yBounds)
        .catch(sectionFallback('kds', NEUTRAL_KDS)),
    ])

    // issues.operational — minimalna poštena izpeljava po kontraktu P2-28:
    // /api/operational-alerts je monolitna ruta in NE izvaža svoje severity
    // računanje, zato briefing izpelje operativne števce iz že izračunanih
    // zalogovnih podatkov INVENTARNE sekcije (celoten vzorec, brez cap-ov),
    // z vokabularjem 1:1 te rute: critical = zaloga 0/≤safety + pretečene
    // serije z ostankom; warning = serije, ki potekajo v ≤7 dneh.
    const { _criticalCount, _expiringTotal, ...inventory } = inventoryData

    const payload = {
      date,
      generatedAt: new Date().toISOString(),
      locationId,
      reservations,
      staff,
      inventory,
      purchasing,
      yesterday,
      issues: {
        ...issues,
        operational: {
          critical: _criticalCount + inventory.expiredCount,
          warning: _expiringTotal,
        },
      },
      kds,
    }

    return NextResponse.json(deepToNumbers(payload), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/reports/briefing', 'Napaka pri pridobivanju dnevne informacije')
  }
}
