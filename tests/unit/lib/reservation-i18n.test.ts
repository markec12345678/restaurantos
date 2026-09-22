import { describe, it, expect } from 'vitest'
import { slPluralForm, slPluralWord, slCount, REZERVACIJA_FORMS } from '@/lib/sl-plural'
import { closestTimeSlot, hmToMinutes, shiftHm } from '@/lib/reservation-timeline'
import { timeSlots } from '@/components/pos/reservation/constants'

// ─── sl-plural: samo ključne kontraktné točke (izčrpna pokritost v
// sl-plural.test.ts) — tu predvsem TRADICIONALNA norma (21 → ednina),
// ki je zavestna odstopnica od Intl.PluralRules('sl') (CLDR vrne 'other'). ───

describe('slPluralForm — tradicionalna slovenska norma (odstopnica od CLDR)', () => {
  it('21 → ednina, 22 → dvojina, 23/24 → malo mn. ("enaindviget rezervacija")', () => {
    expect(slPluralForm(21)).toBe('one')
    expect(slPluralForm(22)).toBe('two')
    expect(slPluralForm(23)).toBe('few')
    expect(slPluralForm(24)).toBe('few')
  })

  it('11–14 ZMERAJ rodilnik (tudi 111–114) — izjema velja TUDI za sestavljene', () => {
    for (const n of [11, 12, 13, 14, 111, 112, 113, 114]) {
      expect(slPluralForm(n)).toBe('many')
    }
  })

  it('osnovne (1/2/3/4/0/5) — sanity', () => {
    expect(slPluralForm(1)).toBe('one')
    expect(slPluralForm(2)).toBe('two')
    expect(slPluralForm(3)).toBe('few')
    expect(slPluralForm(4)).toBe('few')
    expect(slPluralForm(0)).toBe('many')
    expect(slPluralForm(5)).toBe('many')
  })

  it('varnost: NaN/Infinity → many, negativne abs, necela trunc', () => {
    expect(slPluralForm(Number.NaN)).toBe('many')
    expect(slPluralForm(Number.POSITIVE_INFINITY)).toBe('many')
    expect(slPluralForm(-2)).toBe('two')
    expect(slPluralForm(-1.5)).toBe('one')
  })

  it('REZERVACIJA_FORMS vrstni red = [one, two, few, many]', () => {
    expect(slPluralWord(1, REZERVACIJA_FORMS)).toBe('rezervacija')
    expect(slPluralWord(2, REZERVACIJA_FORMS)).toBe('rezervaciji')
    expect(slPluralWord(3, REZERVACIJA_FORMS)).toBe('rezervacije')
    expect(slPluralWord(5, REZERVACIJA_FORMS)).toBe('rezervacij')
    expect(slCount(2, REZERVACIJA_FORMS)).toBe('2 rezervaciji')
  })
})

// ─── reservation-timeline: prava minutna razdalja (fix localeCompare) ───

describe('closestTimeSlot — prava časovna razdalja (fix localeCompare)', () => {
  it('točni zadetek', () => {
    expect(closestTimeSlot('19:00', timeSlots)).toBe('19:00')
  })

  it('KONTRAKT (prej localeCompare izbral napačen slot): 15:00 → 14:30', () => {
    // leksikografsko je '15:00' najbližje '14:00' (diff 1 vs 2 pri '17:00'),
    // po času pa je 30 min od '14:30'
    expect(closestTimeSlot('15:00', timeSlots)).toBe('14:30')
  })

  it('izenačena razdalja → deterministično prvi bližji slot (19:15 → 19:00)', () => {
    expect(closestTimeSlot('19:15', timeSlots)).toBe('19:00')
  })

  it('pred prvim slotom → prvi slot; za zadnjim → zadnji', () => {
    expect(closestTimeSlot('09:59', timeSlots)).toBe('11:00')
    expect(closestTimeSlot('23:30', timeSlots)).toBe('21:00')
  })

  it('neveljavni vnosi → null', () => {
    expect(closestTimeSlot('25:00', timeSlots)).toBeNull()
    expect(closestTimeSlot('abc', timeSlots)).toBeNull()
    expect(closestTimeSlot('', timeSlots)).toBeNull()
    expect(closestTimeSlot('12:00', [])).toBeNull()
  })

  it('hmToMinutes + shiftHm osnovni kontrakti', () => {
    expect(hmToMinutes('00:00')).toBe(0)
    expect(hmToMinutes('23:59')).toBe(1439)
    expect(hmToMinutes('7:5')).toBeNull() // format zahteva \d{2} za minute
    expect(shiftHm('19:00', 30)).toBe('19:30')
    expect(shiftHm('19:00', -30)).toBe('18:30')
    expect(shiftHm('00:00', -1)).toBeNull() // wrap ni podprt (dnevni UI)
    expect(shiftHm('23:59', 2)).toBeNull()
    expect(shiftHm('xx', 10)).toBeNull()
  })
})
