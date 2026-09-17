import { describe, it, expect } from 'vitest'
import { applyPinDigit } from '@/components/pos/pin-login/pin-digit'
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '@/components/pos/pin-login/constants'
import { recordRecentId, RECENTS_MAX } from '@/lib/recents-store'

// ============================================
// RUNDA 25 — UI/UX primerjava z najboljšimi POS (Square/Toast/Clover):
//  1) PIN vpis: auto-submit pri max dolžini + fizična tipkovnica
//     (prej MRTVA koda — keyboard listener ni bil povezan)
//  2) Recents hitra vrstica: čista logika zapisa nedavnih artiklov
// ============================================

describe('applyPinDigit (PIN vpis — Square auto-submit vzorec)', () => {
  it('doda števko na prazen PIN', () => {
    expect(applyPinDigit('', '5')).toEqual({ pin: '5', autoSubmit: false })
  })

  it('doda števko na obstoječi PIN', () => {
    expect(applyPinDigit('12', '3')).toEqual({ pin: '123', autoSubmit: false })
  })

  it('NE sproži auto-submit pri PIN_MIN_LENGTH (spremenljiva dolžina 4–6)', () => {
    // Uporabnik z 4-mestnim PIN-om: 4. števka še NE odda — ne vemo, ali
    // vpiše 5. in 6. (Toast vzorec za spremenljivo dolžino)
    const { pin, autoSubmit } = applyPinDigit('123', '4')
    expect(pin).toBe('1234')
    expect(autoSubmit).toBe(false)
  })

  it(`sproži auto-submit pri max dolžini (${PIN_MAX_LENGTH})`, () => {
    const prev = '1'.repeat(PIN_MAX_LENGTH - 1)
    const { pin, autoSubmit } = applyPinDigit(prev, '7')
    expect(pin).toBe('1'.repeat(PIN_MAX_LENGTH - 1) + '7')
    expect(pin.length).toBe(PIN_MAX_LENGTH)
    expect(autoSubmit).toBe(true)
  })

  it('zavrne števko, če je PIN že poln (idempotentno)', () => {
    const full = '9'.repeat(PIN_MAX_LENGTH)
    expect(applyPinDigit(full, '5')).toEqual({ pin: full, autoSubmit: false })
  })

  it('podpira custom maxLength (kontekstno testiranje)', () => {
    expect(applyPinDigit('123', '4', 4)).toEqual({ pin: '1234', autoSubmit: true })
    expect(applyPinDigit('1234', '5', 4)).toEqual({ pin: '1234', autoSubmit: false })
  })

  it('konstante so usklajene (min < max)', () => {
    expect(PIN_MIN_LENGTH).toBe(4)
    expect(PIN_MAX_LENGTH).toBe(6)
    expect(PIN_MIN_LENGTH).toBeLessThan(PIN_MAX_LENGTH)
  })
})

describe('recordRecentId (Recents hitra vrstica — Square "Recents" vzorec)', () => {
  it('vstavi nov id na začetek (najnovejši prvi)', () => {
    expect(recordRecentId([], 'a')).toEqual(['a'])
    expect(recordRecentId(['a'], 'b')).toEqual(['b', 'a'])
  })

  it('odstrani duplikat in ga premakne na začetek (LRU vedenje)', () => {
    expect(recordRecentId(['b', 'a', 'c'], 'a')).toEqual(['a', 'b', 'c'])
    expect(recordRecentId(['a', 'b'], 'a')).toEqual(['a', 'b'])
  })

  it(`obreže na ${RECENTS_MAX} vnosov (najstarejši odpade)`, () => {
    const full = ['1', '2', '3', '4', '5', '6', '7', '8']
    const next = recordRecentId(full, '9')
    expect(next.length).toBe(RECENTS_MAX)
    expect(next[0]).toBe('9')
    expect(next).not.toContain('8') // najstarejši odpade
  })

  it('obdela prazen id kot običajen vnos (klicatelj filtrira neveljavne)', () => {
    expect(recordRecentId([], '')).toEqual([''])
  })
})
