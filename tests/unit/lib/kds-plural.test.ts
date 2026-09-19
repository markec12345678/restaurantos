// ─── RUNDA 57: KDS/kuhinja besedne družine (srednji rod) ───
// Živa QA ugotovitev R56: "2 čakajočih", "3 pripravljenih", "4 nujnih!"
// so slovnično napačne (rodilnik pri 2–4). Eliotska srednja oblika
// (samostalnik "naročilo" izpuščen) se sklada po SREDNJEM rodu:
//   1 čakajoče · 2 čakajoči (DVOJINA — končnica -i, ne -a!) ·
//   3,4 čakajoča · 5+ čakajočih
// Plus osnovna družina NAROCILO_FORMS (KDS glava: dvojina "2 naročili"
// je manjkala — ternarek je poznal samo ednino/rodilnik).
import { describe, it, expect } from 'vitest'
import { slCount, slPluralWord, NAROCILO_FORMS, CAKAJOC_FORMS, PRIPRAVLJENO_FORMS, NUJNO_FORMS, PRIPRAVLJEN_FORMS, CAKA_GLAGOL_FORMS } from '@/lib/sl-plural'

describe('NAROCILO_FORMS (KDS glava)', () => {
  it('osnovne oblike: 1 naročilo · 2 naročili · 3 naročila · 5 naročil', () => {
    expect(slCount(1, NAROCILO_FORMS)).toBe('1 naročilo')
    expect(slCount(2, NAROCILO_FORMS)).toBe('2 naročili')
    expect(slCount(3, NAROCILO_FORMS)).toBe('3 naročila')
    expect(slCount(5, NAROCILO_FORMS)).toBe('5 naročil')
  })

  it('0 in velika števila → rodilnik: 0 naročil · 30 naročil', () => {
    expect(slCount(0, NAROCILO_FORMS)).toBe('0 naročil')
    expect(slCount(30, NAROCILO_FORMS)).toBe('30 naročil')
  })

  it('izjema 11–14 → vedno rodilnik: 11 naročil · 14 naročil', () => {
    expect(slCount(11, NAROCILO_FORMS)).toBe('11 naročil')
    expect(slCount(14, NAROCILO_FORMS)).toBe('14 naročil')
  })

  it('tradicionalna norma zadnje številke: 21 naročilo · 22 naročili · 23 naročila', () => {
    expect(slCount(21, NAROCILO_FORMS)).toBe('21 naročilo')
    expect(slCount(22, NAROCILO_FORMS)).toBe('22 naročili')
    expect(slCount(23, NAROCILO_FORMS)).toBe('23 naročila')
  })
})

describe('CAKAJOC_FORMS (eliotska srednja oblika)', () => {
  it('1 čakajoče · 2 čakajoči (dvojina) · 3 čakajoča · 5 čakajočih', () => {
    expect(slCount(1, CAKAJOC_FORMS)).toBe('1 čakajoče')
    expect(slCount(2, CAKAJOC_FORMS)).toBe('2 čakajoči')
    expect(slCount(3, CAKAJOC_FORMS)).toBe('3 čakajoča')
    expect(slCount(4, CAKAJOC_FORMS)).toBe('4 čakajoča')
    expect(slCount(5, CAKAJOC_FORMS)).toBe('5 čakajočih')
  })

  it('rodilniške napake R56 so odpravljene: 2 NI "čakajočih"', () => {
    expect(slCount(2, CAKAJOC_FORMS)).not.toBe('2 čakajočih')
    expect(slCount(4, CAKAJOC_FORMS)).not.toBe('4 čakajočih')
  })

  it('izjema 11–14 + norma zadnje številke: 11 čakajočih · 21 čakajoče · 22 čakajoči', () => {
    expect(slCount(11, CAKAJOC_FORMS)).toBe('11 čakajočih')
    expect(slCount(21, CAKAJOC_FORMS)).toBe('21 čakajoče')
    expect(slCount(22, CAKAJOC_FORMS)).toBe('22 čakajoči')
  })
})

describe('PRIPRAVLJENO_FORMS (eliotska srednja oblika)', () => {
  it('1 pripravljeno · 2 pripravljeni · 3 pripravljena · 5 pripravljenih', () => {
    expect(slCount(1, PRIPRAVLJENO_FORMS)).toBe('1 pripravljeno')
    expect(slCount(2, PRIPRAVLJENO_FORMS)).toBe('2 pripravljeni')
    expect(slCount(3, PRIPRAVLJENO_FORMS)).toBe('3 pripravljena')
    expect(slCount(5, PRIPRAVLJENO_FORMS)).toBe('5 pripravljenih')
  })

  it('11–14 rodilnik: 12 pripravljenih', () => {
    expect(slCount(12, PRIPRAVLJENO_FORMS)).toBe('12 pripravljenih')
  })
})

describe('NUJNO_FORMS (eliotska srednja oblika, destruktivni badge)', () => {
  it('1 nujno · 2 nujni · 4 nujna · 5 nujnih — "4 nujnih!" je odpravljeno', () => {
    expect(slCount(1, NUJNO_FORMS)).toBe('1 nujno')
    expect(slCount(2, NUJNO_FORMS)).toBe('2 nujni')
    expect(slCount(4, NUJNO_FORMS)).toBe('4 nujna')
    expect(slCount(5, NUJNO_FORMS)).toBe('5 nujnih')
    expect(slCount(4, NUJNO_FORMS)).not.toBe('4 nujnih')
  })

  it('slPluralWord posamezne besede sovpadajo s slCount priključkom', () => {
    expect(slPluralWord(3, NUJNO_FORMS)).toBe('nujna')
    expect(slPluralWord(7, CAKAJOC_FORMS)).toBe('čakajočih')
  })
})

describe('PRIPRAVLJEN_FORMS (moški rod — artikli, KDS footer)', () => {
  it('1 pripravljen · 2 pripravljena · 3 pripravljeni · 5 pripravljenih', () => {
    expect(slPluralWord(1, PRIPRAVLJEN_FORMS)).toBe('pripravljen')
    expect(slPluralWord(2, PRIPRAVLJEN_FORMS)).toBe('pripravljena')
    expect(slPluralWord(3, PRIPRAVLJEN_FORMS)).toBe('pripravljeni')
    expect(slPluralWord(4, PRIPRAVLJEN_FORMS)).toBe('pripravljeni')
    expect(slPluralWord(5, PRIPRAVLJEN_FORMS)).toBe('pripravljenih')
  })

  it('živa napaka R57: "0 pripravljeni" → "0 pripravljenih" (rodilnik pri 0)', () => {
    expect(slPluralWord(0, PRIPRAVLJEN_FORMS)).toBe('pripravljenih')
    expect(slPluralWord(0, PRIPRAVLJEN_FORMS)).not.toBe('pripravljeni')
  })
})

describe('CAKA_GLAGOL_FORMS (glagolsko soglasje — KDS footer)', () => {
  it('1 čaka · 2 čakata (dvojina) · 3 čakajo · 0/5 čaka (ednina ob rodilniku)', () => {
    expect(slPluralWord(1, CAKA_GLAGOL_FORMS)).toBe('čaka')
    expect(slPluralWord(2, CAKA_GLAGOL_FORMS)).toBe('čakata')
    expect(slPluralWord(3, CAKA_GLAGOL_FORMS)).toBe('čakajo')
    expect(slPluralWord(4, CAKA_GLAGOL_FORMS)).toBe('čakajo')
    expect(slPluralWord(0, CAKA_GLAGOL_FORMS)).toBe('čaka')
    expect(slPluralWord(5, CAKA_GLAGOL_FORMS)).toBe('čaka')
    expect(slPluralWord(11, CAKA_GLAGOL_FORMS)).toBe('čaka')
  })
})
