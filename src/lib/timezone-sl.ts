// ============================================
// ČASOVNI PAS — Europe/Ljubljana (poslovni dnevi)
// ============================================
// P2-UX FIX (pravilen timezone): EOD/Z-report so računali "danes" po UTC ali
// strežniškem TZ. Na UTC strežniku je poslovni dan začel ob 01:00/02:00
// ljubljanskega časa — naročila med polnočjo in 02:00 so padla v PREJŠNJI
// poslovni dan (napačni dnevni obračuni, napačen EOD depo).
//
// Ta modul izračuna UTC meje [00:00, 24:00) ljubljanskega koledarskega dne
// z uporabo Intl.DateTimeFormat round-trip (pravilno CET/CEST preklop),
// neodvisno od TZ spremenljivke procesa.

const LJUBLJANA_TZ = 'Europe/Ljubljana'

/** Odmik (ms) med UTC in časovnim pasom v danem trenutku. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  )
  return asUTC - date.getTime()
}

/**
 * UTC trenutek ljubljanske polnoči danega koledarskega dne.
 * ITERATIVNA konvergenca: na dan preklopa CET/CEST je odmik ob poldnevu
 * drugačen od odmika ob polnoči (začetek dneva je še v starem pasu),
 * zato odmik izpeljemo iz kandidata in ponavljamo, dokler se ne umiri.
 */
function localMidnightUTC(y: number, mo: number, d: number): Date {
  // Začetni približek: poldne UTC minus 12 h (vedno ~ polnoč lokalno ±1 h)
  let guess = Date.UTC(y, mo - 1, d, 12, 0, 0) - 12 * 3600 * 1000
  for (let i = 0; i < 4; i++) {
    const offset = tzOffsetMs(new Date(guess), LJUBLJANA_TZ)
    const candidate = Date.UTC(y, mo - 1, d, 0, 0, 0) - offset
    if (candidate === guess) break
    guess = candidate
  }
  return new Date(guess)
}

/**
 * UTC meje ljubljanskega koledarskega dne.
 * @param dateStr 'YYYY-MM-DD' v ljubljanskem lokalnem času
 * @returns start = UTC trenutek ljubljanske polnoči, end = polnoč naslednjega dne
 *          (na prehodnih dneh je razlika 23 h ali 25 h, ne fiksno 24 h)
 */
export function ljubljanaDayBounds(dateStr: string): { start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim())
  if (!m) throw new Error(`Neveljaven datum (pričakovan YYYY-MM-DD): ${dateStr}`)
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])

  const start = localMidnightUTC(y, mo, d)
  // Konec = polnoč NASLEDNJEGA dne — izračunana NEODVISNO (ne start+24h!)
  const end = localMidnightUTC(y, mo, d + 1)
  return { start, end }
}

/**
 * Današnji datum kot 'YYYY-MM-DD' v ljubljanskem času (ne UTC!).
 * Prej: new Date().toISOString().split('T')[0] → UTC datum.
 */
export function ljubljanaTodayStr(now: Date = new Date()): string {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: LJUBLJANA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now) // en-CA formatira kot YYYY-MM-DD
  return ymd
}
