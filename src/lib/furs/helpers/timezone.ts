// ============================================
// FURS POMOŽNE FUNKCIJE — SLOVENSKA ČASOVNA CONA
// CET/CEST konverzija za FURS zahteve
// FIX BUG-F7: FURS zahteva lokalni čas za ZOI in račune
// ============================================

/**
 * Pretvori Date v slovenski lokalni čas (CET/CEST)
 * FURS specifikacija zahteva dd.MM.yyyy HH:mm:ss v CET/CEST
 */
export function toSlovenianDate(dt: Date): { year: number; month: number; day: number; hours: number; minutes: number; seconds: number } {
  // Določi DST (Daylight Saving Time) za Slovenijo
  // Zadnja nedelja v marcu 02:00 CET -> CEST (UTC+2)
  // Zadnja nedelja v oktobru 03:00 CEST -> CET (UTC+1)
  const year = dt.getUTCFullYear()
  const marchLastSun = getLastSunday(year, 2, 31) // March
  const octLastSun = getLastSunday(year, 9, 31)   // October

  const utcMs = dt.getTime()
  const marchTransition = Date.UTC(year, 2, marchLastSun, 1, 0, 0) // 01:00 UTC = 02:00 CET
  const octTransition = Date.UTC(year, 9, octLastSun, 0, 0, 0)     // 00:00 UTC = 02:00 CEST

  const isDST = utcMs >= marchTransition && utcMs < octTransition
  const offsetMs = isDST ? (2 * 60 * 60 * 1000) : (1 * 60 * 60 * 1000)

  const localMs = utcMs + offsetMs
  const localDt = new Date(localMs)

  return {
    year: localDt.getUTCFullYear(),
    month: localDt.getUTCMonth() + 1,
    day: localDt.getUTCDate(),
    hours: localDt.getUTCHours(),
    minutes: localDt.getUTCMinutes(),
    seconds: localDt.getUTCSeconds(),
  }
}

/**
 * Pridobi zadnjo nedeljo v mesecu
 */
export function getLastSunday(year: number, month: number, lastDay: number): number {
  const d = new Date(Date.UTC(year, month, lastDay))
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return d.getUTCDate()
}

/**
 * Pretvori Date v ISO 8601 format s slovenskim časom (CET/CEST)
 * FURS zahteva IssueDateTime v lokalnem času
 * FIX BUG-5: Uporabi UTC-osnovan DST izračun (ne getTimezoneOffset()),
 * ki pravilno deluje tudi na UTC strežnikih (Docker).
 */
export function toSlovenianISO(dt: Date): string {
  // Določi DST glede na slovenske prehode (ne strežnikov timezone)
  const year = dt.getUTCFullYear()
  const marchLastSun = getLastSunday(year, 2, 31)
  const octLastSun = getLastSunday(year, 9, 31)

  const utcMs = dt.getTime()
  const marchTransition = Date.UTC(year, 2, marchLastSun, 1, 0, 0) // 01:00 UTC = 02:00 CET
  const octTransition = Date.UTC(year, 9, octLastSun, 0, 0, 0)     // 00:00 UTC = 02:00 CEST

  const isDST = utcMs >= marchTransition && utcMs < octTransition
  const offsetHours = isDST ? 2 : 1 // CEST=+2, CET=+1

  // Ustvari lokalni čas z ustreznim offsetom
  const localMs = utcMs + (offsetHours * 60 * 60 * 1000)
  const localDt = new Date(localMs)

  const pad = (n: number) => String(n).padStart(2, '0')
  const isoStr = `${localDt.getUTCFullYear()}-${pad(localDt.getUTCMonth() + 1)}-${pad(localDt.getUTCDate())}T${pad(localDt.getUTCHours())}:${pad(localDt.getUTCMinutes())}:${pad(localDt.getUTCSeconds())}+${pad(offsetHours)}:00`
  return isoStr
}
