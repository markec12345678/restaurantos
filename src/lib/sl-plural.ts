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
// RUNDA 56: eliotska ženska oblika (samostalnik "kartica" je izpuščen) —
// KPI "N neaktivnih ali blokiranih" na darilnih karticah je pri 1/2/3/4
// slovnično napačen (živa QA ugotovitev R56: "1 neaktivnih ali blokiranih").
// 1 neaktivna ali blokirana (kartica) · 2 neaktivni ali blokirani (dvojina)
// · 3 neaktivne ali blokirane · 5 neaktivnih ali blokiranih
export const NEAKTIVNA_KARTICA_FORMS: SlPluralForms = [
  'neaktivna ali blokirana',
  'neaktivni ali blokirani',
  'neaktivne ali blokirane',
  'neaktivnih ali blokiranih',
]
// RUNDA 56: osnovna družina "kartica" (toast registra darilnih kartic:
// "Register izvožen — 2 kartici" ne "2 kartic")
export const KARTICA_FORMS: SlPluralForms = ['kartica', 'kartici', 'kartice', 'kartic']
// RUNDA 57: osnovna družina "naročilo" (srednji rod; KDS glava je imela
// ternarek 1→'naročilo' : 'naročil' — dvojina "2 naročili" je manjkala)
export const NAROCILO_FORMS: SlPluralForms = ['naročilo', 'naročili', 'naročila', 'naročil']
// RUNDA 57: ELIOTSKA SREDNJA OBLIKA (samostalnik "naročilo" izpuščen) za
// KPI/števce kuhinje — pridevnik/particip se sklada v SREDNJEM rodu:
//   1 čakajoče (naročilo) · 2 čakajoči (naročili — DVOJINA, končnica -i!)
//   · 3,4 čakajoča (naročila) · 5+ čakajočih (naročil)
// Živa QA ugotovitev R56: "2 čakajočih", "3 pripravljenih", "4 nujnih!"
// (rodilniške oblike pri 2–4 so slovnično napačne).
export const CAKAJOC_FORMS: SlPluralForms = ['čakajoče', 'čakajoči', 'čakajoča', 'čakajočih']
export const PRIPRAVLJENO_FORMS: SlPluralForms = ['pripravljeno', 'pripravljeni', 'pripravljena', 'pripravljenih']
export const NUJNO_FORMS: SlPluralForms = ['nujno', 'nujni', 'nujna', 'nujnih']
// RUNDA 57c: MOŠKI ROD (artikli) — KDS footer "N pripravljeni":
//   1 pripravljen · 2 pripravljena (dvojina) · 3,4 pripravljeni · 5+ pripravljenih
// Živa QA ugotovitev R57: "0 pripravljeni" (0/5+ zahteva rodilnik -ih).
export const PRIPRAVLJEN_FORMS: SlPluralForms = ['pripravljen', 'pripravljena', 'pripravljeni', 'pripravljenih']
// RUNDA 57c: GLAGOLSKE oblike (subjekt = števec + artikli): 1 čaka · 2 čakata
// (dvojina!) · 3,4 čakajo · 0/5+ čaka (za rodilnik kvantifikatorja gre glagol
// v ednino: "pet artiklov čaka"). Isti 4-tuple API, pomensko glagol.
export const CAKA_GLAGOL_FORMS: SlPluralForms = ['čaka', 'čakata', 'čakajo', 'čaka']
// RUNDA 59: TOŽILNIK za predlogom "za" ("premajhna za …", "Ni miz za …",
// "Za … oseb" pri čakanju): 1 osebo · 2 osebi · 3,4 osebe · 5+ oseb.
// Živa QA ugotovitev R59: "premajhna za 2 oseb" (API 400) — dvojina manjka.
export const OSEBA_TOZILNIK_FORMS: SlPluralForms = ['osebo', 'osebi', 'osebe', 'oseb']
// RUNDA 59: pridnevniška družina "aktivna rezervacija" (detail panel tlorisa:
// "1 aktivna rezervacija · 2 aktivni rezervaciji · 3 aktivne rezervacije ·
// 5 aktivnih rezervacij" — prej trdo kodiran ternarek brez oblike 3/4).
export const AKTIVNA_REZERVACIJA_FORMS: SlPluralForms = [
  'aktivna rezervacija',
  'aktivni rezervaciji',
  'aktivne rezervacije',
  'aktivnih rezervacij',
]
// RUNDA 66: osnovna družina "artikel" (moški rod, -el izpade v dvojini/mn.):
//   1 artikel · 2 artikla (dvojina) · 3,4 artikli · 5+ artiklov
// Uporaba: čip kategorije v CategoriesTab ("12 artiklov", "1 artikel") +
// zaščita brisanja kategorije (409 sporočilo "Kategorija vsebuje 2 artikla").
export const ARTIKEL_FORMS: SlPluralForms = ['artikel', 'artikla', 'artikli', 'artiklov']
// RUNDA 66: ženska družina "kategorija" (glava sekcije v CategoriesTab:
// "1 kategorija · 2 kategoriji · 3 kategorije · 5 kategorij" — prej vedno
// "N kategorij", kar je pri 1–4 slovnično napačno).
export const KATEGORIJA_FORMS: SlPluralForms = ['kategorija', 'kategoriji', 'kategorije', 'kategorij']
// RUNDA 67: moška družina "meni" (števec menijev v UI + sporočila zaščite:
// 1 meni · 2 menija · 3 meniji · 5 menijev).
export const MENI_FORMS: SlPluralForms = ['meni', 'menija', 'meniji', 'menijev']

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
