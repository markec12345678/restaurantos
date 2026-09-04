// ============================================
// MEALTIME RULES — TastyIgniter-style per-item availability scheduling
//
// Artikel je dostopen samo ob določenih dneh/časih (npr. zajtrk 6-11h,
// nedeljska pečenka). Model MealtimeRule v Prisma shemi shranjuje
// daysOfWeek (JSON array 0-6) + timeFrom/timeTo ("HH:MM") + isActive.
//
// Dan v tednu: 0=nedelja, 1=ponedeljek, ..., 6=sobota
// (enako kot JavaScript Date.prototype.getDay())
// ============================================

export interface MealtimeRuleLike {
  /** JSON array string npr. "[1,2,3,4,5]" ali array številk */
  daysOfWeek: string | number[]
  /** "HH:MM" ali prazno = cel dan */
  timeFrom: string
  /** "HH:MM" ali prazno = cel dan */
  timeTo: string
  isActive: boolean
}

/**
 * Vrne trenutni dan v tednu (0=nedelja, 1=ponedeljek, ..., 6=sobota).
 * Privzeto uporablja aktualni čas; za testiranje lahko podamo `now`.
 */
export function getCurrentDayOfWeek(now: Date = new Date()): number {
  return now.getDay()
}

/**
 * Pretvori "HH:MM" v število minut od polnoči.
 * Vrne -1 če je string neveljaven ali prazen.
 */
function parseTimeToMinutes(time: string): number {
  if (!time || typeof time !== 'string') return -1
  const trimmed = time.trim()
  if (!trimmed) return -1
  // Podpira tudi "HH:MM:SS"
  const parts = trimmed.split(':')
  if (parts.length < 2) return -1
  const h = parseInt(parts[0] || '', 10)
  const m = parseInt(parts[1] || '', 10)
  if (Number.isNaN(h) || Number.isNaN(m)) return -1
  if (h < 0 || h > 23 || m < 0 || m > 59) return -1
  return h * 60 + m
}

/**
 * Pretvori daysOfWeek (JSON string ali array številk) v array numberjev.
 * Vrne prazen array če ne more razčleniti.
 */
function parseDaysOfWeek(daysOfWeek: string | number[]): number[] {
  if (Array.isArray(daysOfWeek)) {
    return daysOfWeek.filter(d => typeof d === 'number' && d >= 0 && d <= 6)
  }
  if (typeof daysOfWeek !== 'string' || !daysOfWeek.trim()) return []
  try {
    const parsed: unknown = JSON.parse(daysOfWeek)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6)
    }
  } catch {
    // Ni JSON — poskusi vejice ločen format "1,2,3"
    return daysOfWeek
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(d => !Number.isNaN(d) && d >= 0 && d <= 6)
  }
  return []
}

/**
 * Preveri ali posamezno pravilo velja za podani čas.
 *
 * Pravilo velja kadar:
 *  1. isActive === true
 *  2. daysOfWeek vsebuje trenutni dan (če je daysOfWeek prazen → vsi dnevi)
 *  3. čas je znotraj [timeFrom, timeTo] (če sta timeFrom/timeTo prazna → ves dan)
 *
 * Časovno okno je inkluzivno na obeh straneh. Če je timeTo < timeFrom
 * (npr. nočni meni 22:00 → 02:00), se okvo razdeli čez polnoč.
 */
export function doesRuleMatchNow(
  rule: MealtimeRuleLike,
  now: Date = new Date(),
): boolean {
  if (!rule.isActive) return false

  const days = parseDaysOfWeek(rule.daysOfWeek)
  if (days.length > 0) {
    const today = getCurrentDayOfWeek(now)
    if (!days.includes(today)) return false
  }

  const fromMin = parseTimeToMinutes(rule.timeFrom)
  const toMin = parseTimeToMinutes(rule.timeTo)

  // Obe prazni → velja ves dan
  if (fromMin < 0 && toMin < 0) return true
  // Samo ena podana → obravnavaj kot odprto okno (od from naprej ali do to)
  if (fromMin < 0) return true
  if (toMin < 0) return true

  const curHours = now.getHours()
  const curMinutes = now.getMinutes()
  const currentMin = curHours * 60 + curMinutes

  if (fromMin <= toMin) {
    // Normalno okno (npr. 06:00 → 11:00)
    return currentMin >= fromMin && currentMin <= toMin
  }
  // Okno čez polnoč (npr. 22:00 → 02:00)
  return currentMin >= fromMin || currentMin <= toMin
}

/**
 * Ali je artikel na voljo TRENUTNO glede na svoje mealtimeRules?
 *
 * - Če ni pravil (empty array) → artikel je vedno na voljo (return true)
 * - Če ima pravila → artikel je na voljo kadar vsaj eno AKTIVNO pravilo
 *   ustreza trenutnemu dnevu/času. (Neaktivna pravila se ignorirajo.)
 * - Če ima pravila ampak nobeno ne ustreza → return false
 *
 * Podpora tako za Prisma MealtimeRule objekte kot tudi plain object z
 * enako strukturo (glej MealtimeRuleLike).
 */
export function isItemAvailableNow(
  mealtimeRules: Array<MealtimeRuleLike> | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!mealtimeRules || mealtimeRules.length === 0) {
    // Brez pravil → vedno dostopen (default behavior)
    return true
  }
  // Artikel je na voljo če vsaj eno aktivno pravilo ustreza
  return mealtimeRules.some(rule => doesRuleMatchNow(rule, now))
}
