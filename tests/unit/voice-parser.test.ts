// ============================================
// Voice Order Parser — Unit testi
// ============================================
import { describe, it, expect } from 'vitest'
import { parseVoiceOrder } from '@/lib/voice-parser'

// Mock meni artikel imena
const MENU_ITEMS = [
  'Pizza Margherita',
  'Pizza Pepperoni',
  'Coca Cola',
  'Kava',
  'Pivo Laško',
  'Burger Classic',
  'Solata Cezar',
  'Juha dnevna',
  'Torta čokoladna',
  'Voda',
]

describe('parseVoiceOrder — basic parsing', () => {
  it('prepozna enostavno naročilo', () => {
    const result = parseVoiceOrder('ena kava prosim', MENU_ITEMS)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].name).toBe('Kava')
    expect(result.items[0].quantity).toBe(1)
  })

  it('prepozna številko', () => {
    const result = parseVoiceOrder('3 kava', MENU_ITEMS)
    expect(result.items[0].quantity).toBe(3)
  })

  it('prepozna slovenski števnik "dve"', () => {
    const result = parseVoiceOrder('dve pivo', MENU_ITEMS)
    expect(result.items[0].quantity).toBe(2)
    expect(result.items[0].name).toBe('Pivo Laško')
  })

  it('prepozna slovenski števnik "tri"', () => {
    const result = parseVoiceOrder('tri kava', MENU_ITEMS)
    expect(result.items[0].quantity).toBe(3)
  })

  it('prepozna več artiklov z "in"', () => {
    const result = parseVoiceOrder('ena kava in dve pivo', MENU_ITEMS)
    expect(result.items).toHaveLength(2)
    expect(result.items[0].name).toBe('Kava')
    expect(result.items[1].name).toBe('Pivo Laško')
    expect(result.items[1].quantity).toBe(2)
  })

  it('prepozna več artiklov z vejico', () => {
    const result = parseVoiceOrder('kava, pivo, voda', MENU_ITEMS)
    expect(result.items).toHaveLength(3)
  })
})

describe('parseVoiceOrder — diakritični znaki', () => {
  it('normalizira č → c', () => {
    const result = parseVoiceOrder('čokoladna torta', MENU_ITEMS)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].name).toBe('Torta čokoladna')
  })

  it('normalizira š → s', () => {
    const result = parseVoiceOrder('štiri kava', MENU_ITEMS)
    expect(result.items[0].quantity).toBe(4)
  })

  it('normalizira ž → z', () => {
    const result = parseVoiceOrder('želim eno kavo', MENU_ITEMS)
    expect(result.items).toHaveLength(1)
  })
})

describe('parseVoiceOrder — modificiratorji', () => {
  it('prepozna "brez čebule"', () => {
    const result = parseVoiceOrder('pizza brez čebule', MENU_ITEMS)
    // Parser normalizira diakritike interno
    expect(result.items[0].modifiers.some(m => m.includes('cebule') || m.includes('čebule'))).toBe(true)
  })

  it('prepozna "ekstra sir"', () => {
    const result = parseVoiceOrder('burger ekstra sir', MENU_ITEMS)
    expect(result.items[0].modifiers.some(m => m.includes('sir'))).toBe(true)
  })

  it('prepozna velikost "mala"', () => {
    const result = parseVoiceOrder('mala kava', MENU_ITEMS)
    expect(result.items[0].size).toBe('small')
  })

  it('prepozna velikost "velika"', () => {
    const result = parseVoiceOrder('velika pizza', MENU_ITEMS)
    expect(result.items[0].size).toBe('large')
  })

  it('prepozna temperaturo "vroče"', () => {
    const result = parseVoiceOrder('vroča juha', MENU_ITEMS)
    expect(result.items[0].temperature).toBe('hot')
  })

  it('prepozna temperaturo "hladno"', () => {
    const result = parseVoiceOrder('hladna voda', MENU_ITEMS)
    expect(result.items[0].temperature).toBe('cold')
  })
})

describe('parseVoiceOrder — sinonimi', () => {
  it('kava = espresso', () => {
    const result = parseVoiceOrder('ena espresso prosim', MENU_ITEMS)
    expect(result.items).toHaveLength(1)
  })

  it('pivo = beer', () => {
    const result = parseVoiceOrder('dve beer', MENU_ITEMS)
    expect(result.items).toHaveLength(1)
  })
})

describe('parseVoiceOrder — confidence', () => {
  it('direct match → confidence 1.0', () => {
    const result = parseVoiceOrder('kava', MENU_ITEMS)
    expect(result.items[0].confidence).toBe(1.0)
  })

  it('synonym match → confidence 0.8', () => {
    const result = parseVoiceOrder('espresso', MENU_ITEMS)
    expect(result.items[0].confidence).toBe(0.8)
  })

  it('overall confidence je povprečje', () => {
    const result = parseVoiceOrder('kava in espresso', MENU_ITEMS)
    expect(result.confidence).toBeGreaterThan(0.8)
    expect(result.confidence).toBeLessThanOrEqual(1.0)
  })
})

describe('parseVoiceOrder — unrecognized', () => {
  it('neznane fraze zabeleži', () => {
    const result = parseVoiceOrder('kava in nekaj neznanega', MENU_ITEMS)
    expect(result.items.length).toBeGreaterThanOrEqual(1)
    expect(result.unrecognizedPhrases.length).toBeGreaterThan(0)
  })

  it('praznega transkripta → prazni items', () => {
    const result = parseVoiceOrder('', MENU_ITEMS)
    expect(result.items).toHaveLength(0)
  })

  it('samo filler besede → prazni items', () => {
    const result = parseVoiceOrder('prosim hvala ja', MENU_ITEMS)
    expect(result.items).toHaveLength(0)
  })
})

describe('parseVoiceOrder — kompleksni primeri', () => {
  it('kompleksno naročilo z vsemi elementi', () => {
    const transcript = 'Dober dan, rad bi tri pivo in dve kavi brez sladkorja, ter velika pizza brez čebule, prosim'
    const result = parseVoiceOrder(transcript, MENU_ITEMS)
    expect(result.items.length).toBeGreaterThanOrEqual(3)
    const pivo = result.items.find(i => i.name === 'Pivo Laško')
    expect(pivo?.quantity).toBe(3)
    const kava = result.items.find(i => i.name === 'Kava')
    expect(kava?.quantity).toBe(2)
    expect(kava?.modifiers).toContain('brez: sladkorja')
  })

  it('naročilo z vejico in "in"', () => {
    const result = parseVoiceOrder('kava, pivo in voda', MENU_ITEMS)
    expect(result.items).toHaveLength(3)
  })
})

describe('parseVoiceOrder — edge cases', () => {
  it('količina brez artikla → unrecognized', () => {
    const result = parseVoiceOrder('tri nekaj neznanega', MENU_ITEMS)
    expect(result.items).toHaveLength(0)
  })

  it('samo artikel brez količine → default 1', () => {
    const result = parseVoiceOrder('kava', MENU_ITEMS)
    expect(result.items[0].quantity).toBe(1)
  })

  it('velika količina (10+)', () => {
    const result = parseVoiceOrder('deset pivo', MENU_ITEMS)
    expect(result.items[0].quantity).toBe(10)
  })

  it('dvojna količina vzame prvo', () => {
    const result = parseVoiceOrder('tri dve kava', MENU_ITEMS)
    expect(result.items[0].quantity).toBe(3)
  })
})
