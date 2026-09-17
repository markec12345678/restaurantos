// ============================================
// refresh-draft.ts — osveži obstoječi Z-osnutek ob novem plačilu
// ============================================
// NOVA FUNKCIONALNOST (QA 2026-09-17, runda 10 — nadaljevanje runde 9):
// Z-osnutek je bil do zdaj osvežen SAMO ob zaprtju izmene (postShiftCloseActions)
// ali ročnem POST /api/z-report. Plačila, ki pridejo MED dnevom (po zadnjem
// zaprtju izmene), niso posodobila osnutka → vodja je na Nadzorni plošči videl
// ZASTARELE številke (zaznano: totalSales 43,04 € kljub 564,99 € plačil).
//
// Semantika (namenoma konzervativna):
//   - osveži SAMO ČE osnutek že obstaja za (ljubljanski dan, lokacija)
//   - NE ustvarjaj osnutka iz nič (to je domena zaprtja izmene — sicer bi
//     nastajali osnutki za dneve, ko sploh ni bilo izmene)
//   - finalized osnutek se NE dotika (upsertZReportForDay vrže
//     Z_REPORT_FINALIZED — tukaj tiho ignoriramo)
//   - lokacijsko ujemanje: najprej natančen match (order.locationId), nato
//     rezerva — nescope-ani osnutek (locationId=null, super-admin POST), ki se
//     osveži z dan-wide statistiko (upsert brez locationId) — konsistentno s
//     statistikami, ki jih ta osnutek že ima. NIKOLI ne mešamo lokacij
//     (plačilo lokacije A ne osveži osnutka lokacije B).
//
// Klicatelj (create-payment) pokliče fire-and-forget — plačilo NE čaka na
// osvežitev poročila (~80 ms izračuna), napaka se samo zabeleži.

import { db } from '@/lib/db'
import { ljubljanaDayBounds, ljubljanaTodayStr } from '@/lib/timezone-sl'
import { upsertZReportForDay } from './upsert-z-report'

/**
 * Osveži Z-osnutek za ljubljanski dan podanega časa (če obstaja in ni finalized).
 * Tiho preskoči, če osnutek ne obstaja ali je že zaključen.
 *
 * @param at       čas plačila (določa ljubljanski dan poročila)
 * @param locationId lokacija plačanega naročila (order.locationId; lahko null)
 */
export async function refreshZDraftForPayment(
  at: Date,
  locationId?: string | null,
): Promise<{ refreshed: boolean; reason?: string }> {
  const day = ljubljanaTodayStr(at)
  const { start } = ljubljanaDayBounds(day)

  const baseWhere = { reportDate: start, status: { not: 'finalized' as const } }

  // 1) Natančen match po lokaciji (običajen primer: osnutek iz zaprtja izmene)
  let existing = locationId
    ? await db.zReport.findFirst({
        where: { ...baseWhere, locationId },
        select: { id: true, status: true, locationId: true },
      })
    : null

  // 2) Rezerva: nescope-ani osnutek (super-admin POST brez lokacije) — osvežimo
  //    z dan-wide upsertom (locationId=undefined), ker tak osnutek pokriva VSE
  //    lokacije dneva. Scoped plačilo raje vzame svoj scoped osnutek (1).
  if (!existing) {
    existing = await db.zReport.findFirst({
      where: { ...baseWhere, locationId: null },
      select: { id: true, status: true, locationId: true },
    })
  }

  if (!existing) return { refreshed: false, reason: 'no_draft' }
  if (existing.status === 'finalized') return { refreshed: false, reason: 'finalized' }

  // Scoped osnutek → scoped upsert; nescope-ani osnutek → dan-wide upsert
  await upsertZReportForDay({
    date: day,
    locationId: existing.locationId ?? undefined,
  })
  return { refreshed: true }
}
