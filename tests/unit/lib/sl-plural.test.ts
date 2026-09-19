import { describe, it, expect } from 'vitest'
import {
  slPluralForm,
  slPluralWord,
  slCount,
  REZERVACIJA_FORMS,
  GOST_FORMS,
  OSEBA_FORMS,
  OSEBA_TOZILNIK_FORMS,
  AKTIVNA_REZERVACIJA_FORMS,
  ARTIKEL_FORMS,
  KATEGORIJA_FORMS,
} from '@/lib/sl-plural'

describe('slPluralForm', () => {
  // --- osnovna pravila ---
  it('ednina za 1, 21, 31, 101, 201', () => {
    expect(slPluralForm(1)).toBe('one')
    expect(slPluralForm(21)).toBe('one')
    expect(slPluralForm(31)).toBe('one')
    expect(slPluralForm(101)).toBe('one')
    expect(slPluralForm(201)).toBe('one')
  })

  it('dvojina za 2, 22, 32, 102', () => {
    expect(slPluralForm(2)).toBe('two')
    expect(slPluralForm(22)).toBe('two')
    expect(slPluralForm(32)).toBe('two')
    expect(slPluralForm(102)).toBe('two')
  })

  it('množina za 3 in 4 (in 23, 24, 103, 104)', () => {
    expect(slPluralForm(3)).toBe('few')
    expect(slPluralForm(4)).toBe('few')
    expect(slPluralForm(23)).toBe('few')
    expect(slPluralForm(24)).toBe('few')
    expect(slPluralForm(103)).toBe('few')
    expect(slPluralForm(104)).toBe('few')
  })

  it('rodilnik množine za 0, 5–9, 10', () => {
    expect(slPluralForm(0)).toBe('many')
    expect(slPluralForm(5)).toBe('many')
    expect(slPluralForm(9)).toBe('many')
    expect(slPluralForm(10)).toBe('many')
    expect(slPluralForm(30)).toBe('many')
    expect(slPluralForm(100)).toBe('many')
  })

  // --- IZJEMA 11–14 (tudi v sestavljenih) ---
  it('11–14 ZMERAJ rodilnik (tudi 111–114, 211–214)', () => {
    for (const n of [11, 12, 13, 14, 111, 112, 113, 114, 211, 212, 213, 214]) {
      expect(slPluralForm(n)).toBe('many')
    }
  })

  it('11–14 izjema NE velja za 21–24 (21 ednina, 22 dvojina, 23/24 množina)', () => {
    expect(slPluralForm(21)).toBe('one')
    expect(slPluralForm(22)).toBe('two')
    expect(slPluralForm(23)).toBe('few')
    expect(slPluralForm(24)).toBe('few')
  })

  // --- varnostni pasovi ---
  it('NaN/Infinity/necela/negativna → varno obrezano (0 oz. abs+trunc)', () => {
    expect(slPluralForm(Number.NaN)).toBe('many') // 0
    expect(slPluralForm(Number.POSITIVE_INFINITY)).toBe('many') // 0
    expect(slPluralForm(2.9)).toBe('two') // trunc → 2
    expect(slPluralForm(-3)).toBe('few') // abs → 3
    expect(slPluralForm(-1.5)).toBe('one') // abs+trunc → 1
  })
})

describe('slPluralWord / slCount', () => {
  it('rezervacija: vsi štirje sklopi', () => {
    expect(slCount(1, REZERVACIJA_FORMS)).toBe('1 rezervacija')
    expect(slCount(2, REZERVACIJA_FORMS)).toBe('2 rezervaciji')
    expect(slCount(3, REZERVACIJA_FORMS)).toBe('3 rezervacije')
    expect(slCount(4, REZERVACIJA_FORMS)).toBe('4 rezervacije')
    expect(slCount(5, REZERVACIJA_FORMS)).toBe('5 rezervacij')
    expect(slCount(0, REZERVACIJA_FORMS)).toBe('0 rezervacij')
  })

  it('rezervacija: sestavljena števila', () => {
    expect(slCount(11, REZERVACIJA_FORMS)).toBe('11 rezervacij')
    expect(slCount(12, REZERVACIJA_FORMS)).toBe('12 rezervacij')
    expect(slCount(21, REZERVACIJA_FORMS)).toBe('21 rezervacija')
    expect(slCount(22, REZERVACIJA_FORMS)).toBe('22 rezervaciji')
    expect(slCount(23, REZERVACIJA_FORMS)).toBe('23 rezervacije')
    expect(slCount(101, REZERVACIJA_FORMS)).toBe('101 rezervacija')
    expect(slCount(112, REZERVACIJA_FORMS)).toBe('112 rezervacij')
  })

  it('gost: 1 gost · 2 gosta · 3 gosti · 5 gostov', () => {
    expect(slCount(1, GOST_FORMS)).toBe('1 gost')
    expect(slCount(2, GOST_FORMS)).toBe('2 gosta')
    expect(slCount(3, GOST_FORMS)).toBe('3 gosti')
    expect(slCount(5, GOST_FORMS)).toBe('5 gostov')
    expect(slCount(22, GOST_FORMS)).toBe('22 gosta')
    expect(slCount(11, GOST_FORMS)).toBe('11 gostov')
  })

  it('oseba: 1 oseba · 2 osebi · 3 osebe · 5 oseb', () => {
    expect(slCount(1, OSEBA_FORMS)).toBe('1 oseba')
    expect(slCount(2, OSEBA_FORMS)).toBe('2 osebi')
    expect(slCount(3, OSEBA_FORMS)).toBe('3 osebe')
    expect(slCount(5, OSEBA_FORMS)).toBe('5 oseb')
  })

  // RUNDA 59: tožilnik za predlogom "za" (API napaka, čakalna vrsta)
  it('oseba (tožilnik, za): 1 osebo · 2 osebi · 3 osebe · 5 oseb', () => {
    expect(slCount(1, OSEBA_TOZILNIK_FORMS)).toBe('1 osebo')
    expect(slCount(2, OSEBA_TOZILNIK_FORMS)).toBe('2 osebi')
    expect(slCount(3, OSEBA_TOZILNIK_FORMS)).toBe('3 osebe')
    expect(slCount(5, OSEBA_TOZILNIK_FORMS)).toBe('5 oseb')
    // živa QA runda 59: "premajhna za 2 oseb" → "premajhna za 2 osebi"
    expect(slCount(22, OSEBA_TOZILNIK_FORMS)).toBe('22 osebi')
    expect(slCount(12, OSEBA_TOZILNIK_FORMS)).toBe('12 oseb')
  })

  // RUNDA 59: pridnevniška družina "aktivna rezervacija" (detail panel tlorisa)
  it('aktivna rezervacija: 1 aktivna · 2 aktivni · 3 aktivne · 5 aktivnih', () => {
    expect(slCount(1, AKTIVNA_REZERVACIJA_FORMS)).toBe('1 aktivna rezervacija')
    expect(slCount(2, AKTIVNA_REZERVACIJA_FORMS)).toBe('2 aktivni rezervaciji')
    expect(slCount(3, AKTIVNA_REZERVACIJA_FORMS)).toBe('3 aktivne rezervacije')
    expect(slCount(4, AKTIVNA_REZERVACIJA_FORMS)).toBe('4 aktivne rezervacije')
    expect(slCount(5, AKTIVNA_REZERVACIJA_FORMS)).toBe('5 aktivnih rezervacij')
    expect(slCount(0, AKTIVNA_REZERVACIJA_FORMS)).toBe('0 aktivnih rezervacij')
  })

  // RUNDA 66: moška družina "artikel" (CategoriesTab čip + zaščita brisanja)
  it('artikel: 1 artikel · 2 artikla · 3 artikli · 5 artiklov', () => {
    expect(slCount(1, ARTIKEL_FORMS)).toBe('1 artikel')
    expect(slCount(2, ARTIKEL_FORMS)).toBe('2 artikla')
    expect(slCount(3, ARTIKEL_FORMS)).toBe('3 artikli')
    expect(slCount(4, ARTIKEL_FORMS)).toBe('4 artikli')
    expect(slCount(5, ARTIKEL_FORMS)).toBe('5 artiklov')
    // dvojina po številki 22 (ne rodilnik!), sklop 11–14 vedno rodilnik
    expect(slCount(22, ARTIKEL_FORMS)).toBe('22 artikla')
    expect(slCount(12, ARTIKEL_FORMS)).toBe('12 artiklov')
  })

  // RUNDA 66: ženska družina "kategorija" (glava sekcije po meniju)
  it('kategorija: 1 kategorija · 2 kategoriji · 3 kategorije · 5 kategorij', () => {
    expect(slCount(1, KATEGORIJA_FORMS)).toBe('1 kategorija')
    expect(slCount(2, KATEGORIJA_FORMS)).toBe('2 kategoriji')
    expect(slCount(3, KATEGORIJA_FORMS)).toBe('3 kategorije')
    expect(slCount(5, KATEGORIJA_FORMS)).toBe('5 kategorij')
    expect(slCount(0, KATEGORIJA_FORMS)).toBe('0 kategorij')
  })

  it('slPluralWord vrne samo obliko (brez števca)', () => {
    expect(slPluralWord(1, GOST_FORMS)).toBe('gost')
    expect(slPluralWord(6, GOST_FORMS)).toBe('gostov')
  })

  it('invarianta: rezultat slCount se vedno začne s števcem', () => {
    for (let n = 0; n <= 130; n++) {
      const out = slCount(n, REZERVACIJA_FORMS)
      expect(out.startsWith(`${n} `), `n=${n} → ${out}`).toBe(true)
    }
  })
})
