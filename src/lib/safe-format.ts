// ============================================
// SAFE FORMAT — Varna pretvorba za .toFixed() klice
// Rešuje: "e.price.toFixed is not a function" na Vercelu
// ============================================

/**
 * Varno pretvori vrednost v number in formatira z decimalnimi mesti.
 * Deluje z: number, string, Prisma.Decimal, null, undefined.
 */
export function safeToFixed(val: unknown, decimals = 2): string {
  if (val == null) return '0.' + '0'.repeat(decimals)
  if (typeof val === 'number') return val.toFixed(decimals)
  if (typeof val === 'string') {
    const n = parseFloat(val)
    return isNaN(n) ? '0.' + '0'.repeat(decimals) : n.toFixed(decimals)
  }
  // Prisma.Decimal ali drug objekt s toNumber()
  if (typeof val === 'object' && val !== null && 'toNumber' in val) {
    return (val as { toNumber: () => number }).toNumber().toFixed(decimals)
  }
  return '0.' + '0'.repeat(decimals)
}

/**
 * Varno pretvori vrednost v number.
 */
export function safeNum(val: unknown): number {
  if (val == null) return 0
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const n = parseFloat(val)
    return isNaN(n) ? 0 : n
  }
  if (typeof val === 'object' && val !== null && 'toNumber' in val) {
    return (val as { toNumber: () => number }).toNumber()
  }
  return Number(val) || 0
}

// ============================================
// P2-UX: FORMATIRANJE DENARJA (sl-SI) + VNOSI Z VEJICO
// ============================================

/**
 * Kanonični format denarja za slovenski POS: "1.234,56 €".
 *
 * Zakaj obstaja: v kodi so bile 3 konkurenčne konvencije —
 *   1) Intl.NumberFormat('sl-SI') v nekaterih modulih (pravilno "12,50 €")
 *   2) safeToFixed + '€' predpona → NAPAČNO "€12.50" (pika!)
 *   3) toFixed(2) + '€' pripona → NAPAČNO "12.50 €" (pika!)
 * Slovenska decimalna ločila so VEJICA — na POS-u in računih je bila pika
 * videna kot napačen format valute.
 *
 * IMPLEMENTACIJA: ročna (NE Intl) — Node z small-ICU (uradne Node binarke!)
 * nima podatkov za 'sl-SI' → brez ločil tisočic + tipografski minus (−),
 * drugače kot Node s full-ICU. Ročna implementacija je deterministična
 * povsod (dev, CI, Docker, standalone build).
 *
 * Deluje z: number, string, Prisma.Decimal, null, undefined (prek safeNum).
 */
function formatSlNumber(val: unknown): string {
  const n = safeNum(val)
  const neg = n < 0
  const fixed = Math.abs(n).toFixed(2)
  const [int, dec] = fixed.split('.')
  // Ločila tisočic: pika na vsake 3 mesta od desne ("1.234.567")
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${neg ? '-' : ''}${grouped},${dec}`
}

export function formatEUR(val: unknown): string {
  return `${formatSlNumber(val)} €`
}

/**
 * Isto kot formatEUR, a brez simbola valute ("1.234,56").
 * Za kolone, kjer je € že v glavi tabele.
 */
export function formatNumberSl(val: unknown): string {
  return formatSlNumber(val)
}

/**
 * P2-UX FIX (vnos z vejico): Slovenska tipkovnica ima decimalno VEJICO.
 * "12,50" v parseFloat da 12 (tiho!) — natakar vnese 12,50 €, shrani se 12 €.
 * Ta parser sprejme tako "12.50" kot "12,50" ter ignorira ločila tisočic:
 *   "12,50" → 12.5  |  "12.50" → 12.5  |  "1.234,56" → 1234.56  |  "1 234,56" → 1234.56
 */
export function parseDecimalInput(val: unknown): number {
  if (val == null) return 0
  if (typeof val === 'number') return val
  if (typeof val !== 'string') return safeNum(val)
  let s = val.trim().replace(/\s/g, '')
  if (s === '') return 0
  if (s.includes(',')) {
    // Slovenski zapis: pike = ločila tisočic, vejica = decimalna
    s = s.replace(/\./g, '').replace(/,/g, '.')
  } else if ((s.match(/\./g) || []).length > 1) {
    // Več pik brez vejice = ločila tisočic ("1.234.567")
    s = s.replace(/\./g, '')
  }
  // Ena pika brez vejice = decimalna ("12.50") — pusti kot je
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}
