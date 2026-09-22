// ─── RUNDA 55: hmDelta — delta za drag-to-reschedule ───
// Drag na timeline: karta (lahko OFF-slot, npr. 19:15) se spusti na
// slot → delta = cilj − trenutno (min). Negativna delta = drag navzgor.
// 0 = isti slot (UI izpusti klic), null = pokvarjen vnos.
import { describe, it, expect } from 'vitest'
import { hmDelta, shiftHm } from '@/lib/reservation-timeline'

describe('hmDelta (drag-to-reschedule delta)', () => {
  it('naprej po uri: 19:00 → 20:30 = +90 min', () => {
    expect(hmDelta('19:00', '20:30')).toBe(90)
  })

  it('nazaj po uri (drag navzgor): 20:00 → 19:30 = −30 min', () => {
    expect(hmDelta('20:00', '19:30')).toBe(-30)
  })

  it('isti slot = 0 (UI izpusti PUT)', () => {
    expect(hmDelta('19:00', '19:00')).toBe(0)
  })

  it('OFF-slot karta: 19:15 → 19:00 = −15 (delta od TRENUTNEGA časa, ne od slotova)', () => {
    expect(hmDelta('19:15', '19:00')).toBe(-15)
    expect(hmDelta('19:15', '19:30')).toBe(15)
  })

  it('čez uro in polnoč meje znotraj dneva: 11:00 → 17:30 = +390', () => {
    expect(hmDelta('11:00', '17:30')).toBe(390)
  })

  it('neveljaven vnos → null (pokvarjen vnos nikoli ne premakne rezervacije)', () => {
    expect(hmDelta('ne-ura', '19:00')).toBeNull()
    expect(hmDelta('19:00', '25:00')).toBeNull()
    expect(hmDelta('19:00', '19:60')).toBeNull()
    expect(hmDelta('', '')).toBeNull()
  })

  it('integracijski kontrakt: shiftHm(hmDelta) vrne ciljni slot', () => {
    // Droppanje kartice 19:15 na slot 21:00 mora rezultirati v 21:00
    const delta = hmDelta('19:15', '21:00')
    expect(delta).not.toBeNull()
    expect(shiftHm('19:15', delta!)).toBe('21:00')
  })
})
