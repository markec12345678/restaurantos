// ============================================
// SANITIZACIJA VNOSA — Preprečevanje XSS napadov
// Čiščenje uporabniškega vnosa pred shranjevanjem v bazo
// ============================================

/**
 * Odstrani potencialno nevarne HTML oznake iz niza.
 * Uporabi se za vsa besedilna polja, ki jih vnese uporabnik
 * (ime stranke, opombe, imena artiklov itd.).
 *
 * Ne odstranja navadne interpunkcije ali posebnih znakov,
 * ki so legitimni v restavratorskem kontekstu (npr. €, ñ, ü).
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return ''
  return input
    // Odstrani <script> oznake in vsebino
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Odstrani vse HTML oznake
    .replace(/<[^>]*>/g, '')
    // Odstrani javascript: protokol v href/src itd.
    .replace(/javascript\s*:/gi, '')
    // Odstrani on* event handlerje (onclick, onerror, onload...)
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
    // Odstrani data: URI-je (lahko vsebujejo JS)
    .replace(/data\s*:\s*text\/html/gi, '')
    // Trim presledke
    .trim()
}

/**
 * Sanitizira poljubno vrednost — string, array, ali objekt.
 * Rekurzivno preišče strukturo in sanitizira vse string vrednosti.
 * Številke, booleani in null/undefined ostanejo nespremenjeni.
 *
 * FIX (PR #7): Prej je sanitizeObject sprejel samo Record<string, unknown>,
 * kar je pomenilo, da so se VRHNI array-i (npr. JSON body `[1,2,3]`)
 * pretvorili v objekte s številskimi ključi ({"0":1,"1":2,"2":3}).
 * Sedaj sanitizeValue pravilno ohrani array-e na kateremkoli nivoju.
 */
export function sanitizeValue<T>(value: T): T {
  if (typeof value === 'string') {
    return sanitizeString(value) as unknown as T
  }
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item)) as unknown as T
  }
  if (typeof value === 'object' && value !== null) {
    return sanitizeObject(value as Record<string, unknown>) as unknown as T
  }
  // number, boolean, null, undefined, function, symbol — nespremenjeno
  return value
}

/**
 * Sanitizira objekt z besedilnimi polji.
 * Rekurzivno preišče objekt in sanitizira vse string vrednosti.
 * Številke, booleani in null/undefined ostanejo nespremenjeni.
 *
 * OPOMBA: Za sanitizacijo poljubne vrednosti (vključno z array-i
 * na vrhnjem nivoju) uporabite `sanitizeValue`.
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeString(value)
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        typeof item === 'string' ? sanitizeString(item)
        : typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>)
        : item
      )
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result as T
}

/**
 * Preveri, ali niz vsebuje sumljive vzorce, ki bi lahko bili XSS.
 * Uporabno za logging/detekcijo, ne za čiščenje.
 */
export function containsXssPatterns(input: string): boolean {
  if (typeof input !== 'string') return false
  const patterns = [
    /<script\b/i,
    /javascript\s*:/i,
    /\bon\w+\s*=/i,
    /<iframe\b/i,
    /<object\b/i,
    /<embed\b/i,
    /<link\b/i,
    /data\s*:\s*text\/html/i,
    /expression\s*\(/i,
    /url\s*\(\s*javascript/i,
  ]
  return patterns.some(pattern => pattern.test(input))
}

/**
 * Omeji dolžino niza na največ maxLength znakov.
 * Prepreči pošiljanje ekstremno dolgih nizov, ki bi lahko
 * povzročili težave s pomnilnikom ali bazo.
 */
export function truncateString(input: string, maxLength: number): string {
  if (typeof input !== 'string') return ''
  if (input.length <= maxLength) return input
  return input.substring(0, maxLength)
}
