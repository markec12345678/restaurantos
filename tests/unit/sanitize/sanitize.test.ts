// ============================================
// sanitizeValue / sanitizeObject — Unit testi
// XSS preprečevanje + ohranjanje podatkovnih struktur
// ============================================
import { describe, it, expect } from 'vitest'
import {
  sanitizeString,
  sanitizeValue,
  sanitizeObject,
  containsXssPatterns,
  truncateString,
} from '@/lib/sanitize'

describe('sanitizeString', () => {
  it('odstrani <script> tag-e z vsebino', () => {
    expect(sanitizeString('<script>alert(1)</script>')).toBe('')
    expect(sanitizeString('hello <script>evil()</script> world')).toBe('hello  world')
  })

  it('odstrani vse HTML oznake', () => {
    expect(sanitizeString('<b>bold</b>')).toBe('bold')
    expect(sanitizeString('<img src="x">')).toBe('')
    expect(sanitizeString('<div class="x">text</div>')).toBe('text')
  })

  it('odstrani javascript: protokol', () => {
    expect(sanitizeString('javascript:alert(1)')).toBe('alert(1)')
    expect(sanitizeString('JAVASCRIPT:alert(1)')).toBe('alert(1)')
  })

  it('odstrani on* event handler-je z narekovaji', () => {
    expect(sanitizeString('<img src=x onerror="alert(1)">')).toBe('')
    expect(sanitizeString('onclick="evil()"')).toBe('')
    expect(sanitizeString("onerror='evil()'")).toBe('')
  })

  it('NE odstrani on* handler-jev brez narekovajev (znana omejitev)', () => {
    // Regex: \bon\w+\s*=\s*["'][^"']*["'] zahteva narekovaje
    // onmouseover=alert(1) brez narekovajev ni ujet — znana omejitev
    // V praksi to ni kritično, ker HTML tag-i se odstranijo v prejšnjem koraku,
    // tako da on* handlerji zunaj HTML tag-ov redko pridejo do tukaj
    expect(sanitizeString('onmouseover=alert(1)')).toBe('onmouseover=alert(1)')
  })

  it('odstrani data:text/html URI-je', () => {
    // data:text/html se odstrani v celoti (regex: /data\s*:\s*text\/html/gi)
    // <script> se prav tako odstrani
    expect(sanitizeString('data:text/html,<script>')).toBe(',')
    expect(sanitizeString('link: data:text/html,payload')).toBe('link: ,payload')
  })

  it('ohrani legitimne znake (€, ñ, ü, čšž)', () => {
    expect(sanitizeString('Cena: 12,50 €')).toBe('Cena: 12,50 €')
    expect(sanitizeString('Niño')).toBe('Niño')
    expect(sanitizeString('Grüße')).toBe('Grüße')
    expect(sanitizeString('Čokolada')).toBe('Čokolada')
  })

  it('trim-a presledke na začetku in koncu', () => {
    expect(sanitizeString('  hello  ')).toBe('hello')
  })

  it('vrne prazen string za ne-string input', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeString(123 as any)).toBe('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeString(null as any)).toBe('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeString(undefined as any)).toBe('')
  })
})

describe('sanitizeValue — FIX PR #7: ohrani array-e na vrhnjem nivoju', () => {
  it('ohrani array na vrhnjem nivoju (NE pretvori v objekt)', () => {
    const input = [1, 2, 3, 'test']
    const result = sanitizeValue(input)
    // KLJUČNI TEST: rezultat mora biti array, ne objekt
    expect(Array.isArray(result)).toBe(true)
    expect(result).toEqual([1, 2, 3, 'test'])
  })

  it('sanatizira stringe znotraj vrhnjega array-a', () => {
    const input = ['<script>evil()</script>', 'safe', '<b>bold</b>']
    const result = sanitizeValue(input)
    expect(Array.isArray(result)).toBe(true)
    expect(result[0]).toBe('') // script odstranjen
    expect(result[1]).toBe('safe')
    expect(result[2]).toBe('bold') // b tag odstranjen, besedilo ohranjeno
  })

  it('ohrani mešane tipe v array-u (string, number, boolean, null)', () => {
    const input = ['text', 42, true, null, { key: 'val' }]
    const result = sanitizeValue(input)
    expect(result).toEqual(['text', 42, true, null, { key: 'val' }])
  })

  it('ohrani objekt na vrhnjem nivoju', () => {
    const input = { name: 'Test', value: 42 }
    const result = sanitizeValue(input)
    expect(result).toEqual({ name: 'Test', value: 42 })
  })

  it('sanatizira stringe znotraj objekta', () => {
    const input = { name: '<script>alert(1)</script>', safe: 'ok' }
    const result = sanitizeValue(input)
    expect(result.name).toBe('')
    expect(result.safe).toBe('ok')
  })

  it('ohrani array-e znotraj objekta', () => {
    const input = { items: [1, 2, 3], names: ['<b>a</b>', 'b'] }
    const result = sanitizeValue(input)
    expect(Array.isArray(result.items)).toBe(true)
    expect(result.items).toEqual([1, 2, 3])
    expect(result.names).toEqual(['a', 'b'])
  })

  it('ohrani gnezdene array-e v objektih v array-ih', () => {
    const input = [
      { id: 1, tags: ['<script>x</script>', 'safe'] },
      { id: 2, tags: ['ok'] },
    ]
    const result = sanitizeValue(input)
    expect(Array.isArray(result)).toBe(true)
    expect(Array.isArray(result[0].tags)).toBe(true)
    expect(result[0].tags[0]).toBe('')
    expect(result[0].tags[1]).toBe('safe')
  })

  it('ohrani number input nespremenjen', () => {
    expect(sanitizeValue(42)).toBe(42)
    expect(sanitizeValue(3.14)).toBe(3.14)
    expect(sanitizeValue(0)).toBe(0)
    expect(sanitizeValue(-1)).toBe(-1)
  })

  it('ohrani boolean input nespremenjen', () => {
    expect(sanitizeValue(true)).toBe(true)
    expect(sanitizeValue(false)).toBe(false)
  })

  it('ohrani null in undefined nespremenjena', () => {
    expect(sanitizeValue(null)).toBeNull()
    expect(sanitizeValue(undefined)).toBeUndefined()
  })

  it('sanatizira string input neposredno', () => {
    expect(sanitizeValue('<script>alert(1)</script>')).toBe('')
    expect(sanitizeValue('  hello  ')).toBe('hello')
  })

  it('ohrani prazen array', () => {
    const result = sanitizeValue([])
    expect(Array.isArray(result)).toBe(true)
    expect(result).toEqual([])
  })

  it('ohrani prazen objekt', () => {
    const result = sanitizeValue({})
    expect(result).toEqual({})
  })
})

describe('sanitizeObject — backward compatibility', () => {
  it('sanatizira string vrednosti v objektu', () => {
    const input = { name: '<script>x</script>', value: 42 }
    const result = sanitizeObject(input)
    expect(result.name).toBe('')
    expect(result.value).toBe(42)
  })

  it('ohrani array-e kot vrednosti (nested)', () => {
    const input = { items: [1, 2, '<b>3</b>'] }
    const result = sanitizeObject(input)
    expect(Array.isArray(result.items)).toBe(true)
    expect(result.items).toEqual([1, 2, '3'])
  })

  it('NE obravnava pravilno vrhnjega array-a (znana omejitev — uporabite sanitizeValue)', () => {
    // Ta test dokumentira obstoječo obnašanje sanitizeObject
    // Za pravilno obravnavo vrhnjih array-ev uporabite sanitizeValue
    const input = [1, 2, 3] as unknown as Record<string, unknown>
    const result = sanitizeObject(input)
    // sanitizeObject uporabi Object.entries, ki vrne številske ključe
    expect(result).toEqual({ '0': 1, '1': 2, '2': 3 })
    expect(Array.isArray(result)).toBe(false) // znana napaka
  })
})

describe('containsXssPatterns', () => {
  it('true za <script>', () => {
    expect(containsXssPatterns('<script>alert(1)</script>')).toBe(true)
  })

  it('true za javascript: protokol', () => {
    expect(containsXssPatterns('javascript:alert(1)')).toBe(true)
  })

  it('true za on* event handler-je', () => {
    expect(containsXssPatterns('onclick=evil()')).toBe(true)
    expect(containsXssPatterns('onerror=alert(1)')).toBe(true)
  })

  it('true za <iframe>, <object>, <embed>, <link>', () => {
    expect(containsXssPatterns('<iframe src="evil">')).toBe(true)
    expect(containsXssPatterns('<object data="evil">')).toBe(true)
    expect(containsXssPatterns('<embed src="evil">')).toBe(true)
    expect(containsXssPatterns('<link href="evil">')).toBe(true)
  })

  it('false za legitimno besedilo', () => {
    expect(containsXssPatterns('Hello world')).toBe(false)
    expect(containsXssPatterns('Cena: 12,50 €')).toBe(false)
    expect(containsXssPatterns('Normalno sporočilo')).toBe(false)
  })

  it('false za ne-string input', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(containsXssPatterns(123 as any)).toBe(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(containsXssPatterns(null as any)).toBe(false)
  })
})

describe('truncateString', () => {
  it('ohrani kratek string nespremenjen', () => {
    expect(truncateString('hello', 10)).toBe('hello')
  })

  it('skrajša dolg string na maxLength', () => {
    expect(truncateString('hello world', 5)).toBe('hello')
  })

  it('ohrani string natanko dolg kot maxLength', () => {
    expect(truncateString('hello', 5)).toBe('hello')
  })

  it('vrne prazen string za ne-string input', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(truncateString(123 as any, 10)).toBe('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(truncateString(null as any, 10)).toBe('')
  })

  it('pravilno obdela prazen string', () => {
    expect(truncateString('', 10)).toBe('')
  })
})
