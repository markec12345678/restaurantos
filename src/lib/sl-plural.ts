// ─── RUNDA 52: slovenske množinske oblike (ENOTEN VIR) ───
// Slovenščina ima DVOJINO — trdo kodirane množine ("2 rezervacij",
// "2 oseb") so slovnično napačne in žive na produkciji (worklog R51-QA).
//
// PRAVILNIK (tradicionalna slovenska norma — zadnja številka, izjema 11–14):
//   1, 21, 31, 41, 51, 61, 71, 81, 101 … → EDNINA    (1 rezervacija)
//   2, 22, 32, 102 …                     → DVOJINA    (2 rezervaciji)
//   3, 4, 23, 24, 33, 34 …               → MALO MN.   (3 rezervacije)
//   0, 5–20, 30, 100, 111–114 …          → RODILNIK MN. (5 rezervacij)
//
// ⚠️ Namerna odstopnica od Intl.PluralRules('sl') (CLDR): Intl za 21–24
// vrne 'other' ("21 rezervacij"), kar native govorcev sliši napačno —
// tradicionalna norma ("enaindviget rezervacija") sledi zadnji številki,
// SAMO sklop 11–14 je vedno rodilnik. Testa zaklepata to normo.
//
// ⚠️ ZGODOVINA: ta datoteka je bila dvakrat hkrati pisana s strani dveh
// agentov (kolizija v rundi 52) — ENOTEN API sta se dogovorila prek
// testov v tests/unit/lib/sl-plural.test.ts + reservation-i18n.test.ts.

export type SlPluralForm = 'one' | 'two' | 'few' | 'many'

/** [ednina, dvojina, malo-množina, rodilnik-množine] */
export type SlPluralForms = readonly [string, string, string, string]

/** Najpogostejše besedne družine — komponente NE smejo pisati lastnih nizov. */
export const REZERVACIJA_FORMS: SlPluralForms = ['rezervacija', 'rezervaciji', 'rezervacije', 'rezervacij']
export const GOST_FORMS: SlPluralForms = ['gost', 'gosta', 'gosti', 'gostov']
export const OSEBA_FORMS: SlPluralForms = ['oseba', 'osebi', 'osebe', 'oseb']
export const MINUTA_FORMS: SlPluralForms = ['minuta', 'minuti', 'minute', 'minut']
// RUNDA 54: opomniki gostom (reminderSent flow) — KPI čip "N brez opomnika"
export const OPOMNIK_FORMS: SlPluralForms = ['opomnik', 'opomnika', 'opomniki', 'opomnikov']

/**
 * Katera množinska oblika za n? Tradicionalna slovenska norma:
 * zadnja številka (1 → ednina, 2 → dvojina, 3/4 → malo mn.), SAMO
 * sklop 11–14 je vedno rodilnik množine. NaN/Infinity/necela/negativna
 * se varno obrežejo (abs + trunc, pokvarjen vnos → rodilnik).
 */
export function slPluralForm(n: number): SlPluralForm {
  const safe = typeof n === 'number' && Number.isFinite(n) ? Math.abs(Math.trunc(n)) : 0
  const mod100 = safe % 100
  if (mod100 >= 11 && mod100 <= 14) return 'many'
  const mod10 = safe % 10
  if (mod10 === 1) return 'one'
  if (mod10 === 2) return 'two'
  if (mod10 >= 3 && mod10 <= 4) return 'few'
  return 'many'
}

/** Samo beseda v pravilni obliki (brez števca). */
export function slPluralWord(n: number, forms: SlPluralForms): string {
  const form = slPluralForm(n)
  const idx = form === 'one' ? 0 : form === 'two' ? 1 : form === 'few' ? 2 : 3
  return forms[idx] ?? forms[3]
}

/** "N beseda" — najpogostejša uporaba v UI nizih. */
export function slCount(n: number, forms: SlPluralForms): string {
  return `${n} ${slPluralWord(n, forms)}`
}
