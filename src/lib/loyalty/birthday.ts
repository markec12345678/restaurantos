// ============================================
// ROJSTNI DAN — mesec/dan primerjava v LJUBLJANSKEM času
// R143-b (epic #115 #30, denar+SMS bug fix)
// ============================================
// Prej je processBirthdayBatch podelil 100 točk + SMS VSAKEMU aktivnemu
// računu ob VSAKEM dnevnem cronu (MVP hevristika brez birthday pogoja —
// priznano v zgodovinskih komentarjih lib/loyalty-automation). Ta modul je
// čisto jedro mesec/dan primerjave, da je obnašanje pinnano v unit testih.
//
// IZBIRA ZA 29. FEBRUAR (dokumentirano, pinned v r143 testih): rojstni dan
// 02-29 ujema SAMO na 29. 2. (prestopno leto). Na neprestopnih letih NE
// ujema 28. 2. (in niti 1. 3.) — konservativna izbira: gost z 29. 2. dobi
// bonus samo v prestopnih letih, namesto da bi sistem izmišljal nadomestni
// dan (duplikati dveh smiselnih kandidatov: 28. 2. ali 1. 3.).
//
// ČASOVNI PAS: "danes" je vedno Europe/Ljubljana (ljubljanaTodayStr — enoten
// kanon P2-08/timezone-sl, en-CA Intl format), NE UTC — cron teče ob 03:00
// UTC, kar je med 04:00 in 05:00 po ljubljansko; brez tega bi ob mejnih
// urah praznovali napačen dan.

import { ljubljanaTodayStr } from '@/lib/timezone-sl'

/**
 * Izvleči (mesec, dan) iz rojstnega dneva.
 *  - Date (Prisma DateTime): bere UTC dele. Prisma za date-only vrednosti
 *    shrani UTC polnoč ('1990-02-14' → 1990-02-14T00:00:00.000Z), zato UTC
 *    branje vrača točno zapisan koledarski datum (deterministična izbira).
 *  - string: surovi datumski predponi 'YYYY-MM-DD' sledimo 1:1 (date-only
 *    niz ne nosi časovnega pasu). Polni ISO nizi z urou so odgovornost
 *    klicatelja — DB pot vedno posreduje Date objekte.
 *  - null/undefined/neveljaven vnos → null (brez rojstnega dneva).
 */
function birthdayMonthDay(birthday: string | Date | null | undefined): { month: string; day: string } | null {
  if (birthday == null) return null
  if (birthday instanceof Date) {
    if (Number.isNaN(birthday.getTime())) return null
    return {
      month: String(birthday.getUTCMonth() + 1).padStart(2, '0'),
      day: String(birthday.getUTCDate()).padStart(2, '0'),
    }
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(birthday).trim())
  if (!m) return null
  return { month: m[2], day: m[3] }
}

/**
 * Ali ima gost DANES (Europe/Ljubljana) rojstni dan? Čisto primerjava
 * mesec/dan — leto se ignorira (rojstni leto je lahko katero koli).
 *
 * @param birthday Guest.birthday (Date iz Prisme, ali 'YYYY-MM-DD' niz, ali null)
 * @param now referenčni trenutek (privzeto zdaj; testi podajo deterministični)
 */
export function isBirthdayToday(
  birthday: string | Date | null | undefined,
  now: Date | string = new Date(),
): boolean {
  const md = birthdayMonthDay(birthday)
  if (!md) return false
  const nowDate = now instanceof Date ? now : new Date(now)
  if (Number.isNaN(nowDate.getTime())) return false
  const todayYmd = ljubljanaTodayStr(nowDate) // 'YYYY-MM-DD' v LJ času
  return todayYmd.slice(5, 7) === md.month && todayYmd.slice(8, 10) === md.day
}
