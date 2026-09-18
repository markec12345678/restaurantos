import { describe, it, expect } from 'vitest'
import { intervalsOverlap } from '@/lib/reservation-timeline'

// RUNDA 53: konflikt detekcija rezervacij — kanonični pogoj polodprtih
// intervalov [start, end): startA < endB && endA > startB.
// Dotik robov NI prekrivanje (konec ob 20:00 + začetek ob 20:00 = prosta miza).
// Kontekst API buga (prej): findFirst z dateTime <= newEnd + ročni check
// ENE vrstice → lažni negativ/pozitiv (arbitrarna izbira brez orderBy).

/** epoch ms za 2026-09-18 ob h:m UTC */
const at = (h: number, m = 0) => Date.UTC(2026, 8, 18, h, m)
const MIN = 60_000

describe('intervalsOverlap — delna/vsotna prekrivanja', () => {
  const s = at(20)
  const e = at(21, 30) // testni interval 20:00–21:30

  it('drugi se konča sredi našega (prekrivanje na začetku)', () => {
    expect(intervalsOverlap(s, e, at(18, 30), at(20, 15))).toBe(true)
  })

  it('drugi se začne sredi našega (prekrivanje na koncu)', () => {
    expect(intervalsOverlap(s, e, at(21), at(23))).toBe(true)
  })

  it('drugi povsem znotraj našega (vsebovanje)', () => {
    expect(intervalsOverlap(s, e, at(20, 30), at(21))).toBe(true)
  })

  it('naš povsem znotraj drugega (obratno vsebovanje)', () => {
    expect(intervalsOverlap(at(19), at(23), s, e)).toBe(true)
  })

  it('identična intervala', () => {
    expect(intervalsOverlap(s, e, s, e)).toBe(true)
  })

  it('1-minutni pesterk na sredini', () => {
    expect(intervalsOverlap(s, e, at(20, 59), at(21))).toBe(true)
  })
})

describe('intervalsOverlap — dotik robov in ločenost', () => {
  const s = at(20)
  const e = at(21, 30)

  it('konec drugega == naš začetek → NI konflikt (miza prosta takoj)', () => {
    expect(intervalsOverlap(s, e, at(18), s)).toBe(false)
  })

  it('začetek drugega == naš konec → NI konflikt', () => {
    expect(intervalsOverlap(s, e, e, at(23))).toBe(false)
  })

  it('popolnoma pred našim intervalom', () => {
    expect(intervalsOverlap(s, e, at(17), at(18))).toBe(false)
  })

  it('popolnoma za našim intervalom', () => {
    expect(intervalsOverlap(s, e, at(22), at(23, 30))).toBe(false)
  })
})

describe('intervalsOverlap — robni primeri in varnost', () => {
  const s = at(20)
  const e = at(21, 30)

  it('ničelni interval (trenutek) znotraj zasedenega okna → konflikt', () => {
    expect(intervalsOverlap(at(20, 45), at(20, 45), s, e)).toBe(true)
  })

  it('ničelni interval na robu → ni konflikt (polodprto)', () => {
    expect(intervalsOverlap(s, s, s, e)).toBe(false)
    expect(intervalsOverlap(e, e, s, e)).toBe(false)
  })

  it('ničelni interval zunaj → ni konflikt', () => {
    expect(intervalsOverlap(at(20, 45), at(20, 45), at(21, 45), at(22))).toBe(false)
  })

  it('obrnjeni argumenti se normalizirajo (defenzivno)', () => {
    // (e, s) je isti interval kot (s, e)
    expect(intervalsOverlap(e, s, at(19), at(23))).toBe(true)
    expect(intervalsOverlap(e, s, at(17), at(18))).toBe(false)
    expect(intervalsOverlap(s, e, at(23), at(22))).toBe(false)
  })

  it('NaN/Infinity → false (pokvarjen vnos nikoli ni konflikt)', () => {
    expect(intervalsOverlap(NaN, e, s, e)).toBe(false)
    expect(intervalsOverlap(s, Number.POSITIVE_INFINITY, s, e)).toBe(false)
    expect(intervalsOverlap(s, e, NaN, at(21))).toBe(false)
    expect(intervalsOverlap(s, e, s, Number.NEGATIVE_INFINITY)).toBe(false)
  })

  it('realni API scenarij: 30-min premik na zasedeno mizo → 409', () => {
    // Miza 6: A = 19:00–21:00 (120 min). B poskuša 19:30 (premaknjena iz 19:00).
    const aStart = at(19)
    const aEnd = aStart + 120 * MIN
    const bStart = at(19, 30)
    const bEnd = bStart + 120 * MIN
    expect(intervalsOverlap(bStart, bEnd, aStart, aEnd)).toBe(true) // blokirana
  })

  it('realni API scenarij: 30-min premik na prosto mizo → dovoljeno', () => {
    // Miza 6: A = 19:00–21:00. B gre na 21:00 (točno po A) → dotik, dovoljeno.
    const aStart = at(19)
    const aEnd = aStart + 120 * MIN
    const bStart = at(21)
    const bEnd = bStart + 120 * MIN
    expect(intervalsOverlap(bStart, bEnd, aStart, aEnd)).toBe(false)
  })
})
