// ============================================
// VOICE ORDER PARSER — NL parser za naročanje z glasom
// ============================================
// Podpira:
//   - Slovenščina: "dve pivi prosim", "tri kava z mlekom"
//   - Števnike besedne: "ena", "dve", "tri", "štiri", "pet"...
//   - Modificiratorje: "brez čebule", "ekstra sir", "sladkor"
//   - Sinonime: "kava" = "espresso" = "caffe"
//   - Velikosti: "mala", "velika", "srednja"
//
// Uporablja se kot fallback ko Gemini AI ni na voljo, ali za hitro
// parsanje brez API klica.
// ============================================

// --- Slovenski števniki (normalizirano brez diakritik) ---
const SLOVENIAN_NUMBERS: Record<string, number> = {
  ena: 1, enega: 1, eno: 1, en: 1,
  dve: 2, dva: 2, dveh: 2,
  tri: 3, trije: 3, treh: 3,
  stiri: 4, stirje: 4, stirih: 4, // normalizirano iz štiri
  pet: 5, petih: 5,
  sest: 6, sestih: 6, // normalizirano iz šest
  sedem: 7, sedmih: 7,
  osem: 8, osmih: 8,
  devet: 9, devetih: 9,
  deset: 10, desetih: 10,
  enajst: 11,
  dvanajst: 12,
}

// --- Sinonimi za pogoste artikle (normalizirano) ---
const SYNONYMS: Record<string, string[]> = {
  kava: ['kava', 'kavo', 'kavi', 'kave', 'espresso', 'caffe', 'coffee'],
  piva: ['pivo', 'pivi', 'pive', 'piv', 'beer', 'lager', 'toceno pivo'],
  pizza: ['pica', 'pizo', 'pizza', 'pice'],
  burger: ['burger', 'hamburger', 'burgerji'],
  solata: ['solato', 'solata', 'salad', 'salata'],
  juha: ['juho', 'juha', 'supo', 'supa'],
  torta: ['sladico', 'desert', 'dessert', 'torta', 'torto', 'cokoladna'],
  vino: ['vino', 'vin', 'wine', 'rdece', 'belo'],
  voda: ['voda', 'vodo', 'water', 'negazirana', 'gazirana'],
  caj: ['caj', 'tea'], // čaj normalizirano
}

// --- Modificiratorji (normalizirano) ---
const MODIFIERS = {
  // Odstranitev sestavin
  without: ['brez', 'stran'],
  // Dodatek
  extra: ['ekstra', 'extra', 'vec', 'dodaten', 'dodatna'], // več normalizirano
  // Velikost
  sizeSmall: ['mala', 'majhna', 'small'],
  sizeMedium: ['srednja', 'medium', 'mid'],
  sizeLarge: ['velika', 'velik', 'large', 'big'],
  // Temperatura
  hot: ['vroce', 'vroca', 'toplo', 'hot'], // vroče/vroča normalizirano
  cold: ['hladno', 'hladna', 'mrzlo', 'mrzla', 'cold'],
}

// --- Tipi ---
export interface ParsedItem {
  name: string
  quantity: number
  modifiers: string[]
  size?: 'small' | 'medium' | 'large'
  temperature?: 'hot' | 'cold'
  // Confidence: 0-1 (koliko smo prepričani v match)
  confidence: number
}

export interface ParseResult {
  items: ParsedItem[]
  unrecognizedPhrases: string[]
  confidence: number // overall confidence
}

// --- Glavna funkcija ---

export function parseVoiceOrder(
  transcript: string,
  menuItemNames: string[] = [],
): ParseResult {
  const normalized = normalizeText(transcript)
  const items: ParsedItem[] = []
  const unrecognized: string[] = []

  // Razdeli na segmente (po "in", ",", "ter", "pa")
  const segments = splitIntoSegments(normalized)

  for (const segment of segments) {
    const parsed = parseSegment(segment, menuItemNames)
    if (parsed) {
      items.push(parsed)
    } else {
      // Samo če segment ni povsem prazen
      const trimmed = segment.trim()
      if (trimmed.length > 2 && !isFillerWord(trimmed)) {
        unrecognized.push(trimmed)
      }
    }
  }

  const overallConfidence = items.length > 0
    ? items.reduce((sum, i) => sum + i.confidence, 0) / items.length
    : 0

  return {
    items,
    unrecognizedPhrases: unrecognized,
    confidence: overallConfidence,
  }
}

// --- Pomožne funkcije ---

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Odstrani slovenske diakritične znake za lažje matching
    .replace(/[čć]/g, 'c')
    .replace(/[š]/g, 's')
    .replace(/[ž]/g, 'z')
    // Normaliziraj večkratne presledke
    .replace(/\s+/g, ' ')
}

function splitIntoSegments(text: string): string[] {
  // Razdeli po "in", ",", "ter", "pa", "ter še"
  return text
    .split(/\s*,\s*|\s+\bin\b\s+|\s+\bter\b\s+|\s+\bpa\b\s+|\s+\bter se\b\s+/i)
    .filter((s) => s.trim().length > 0)
}

function parseSegment(segment: string, menuItemNames: string[]): ParsedItem | null {
  // 0. Odstrani filler besede na začetku (rad, bi, želim, itd.)
  const fillerRegex = /^(dober dan\s+|rad\s+bi\s+|zelim\s+|rabil\s+|lahko\s+|mi\s+|bi\s+|rad\s+)/i
  let workingSegment = segment.replace(fillerRegex, '').trim()
  if (!workingSegment) workingSegment = segment

  // 1. Poizkusi najti količino (števnik ali številka)
  let quantity = 1

  // Najprej številka
  const numberMatch = workingSegment.match(/^(\d+)\s+/)
  if (numberMatch) {
    quantity = parseInt(numberMatch[1], 10)
    workingSegment = workingSegment.substring(numberMatch[0].length)
  } else {
    // Slovenski števnik
    for (const [word, num] of Object.entries(SLOVENIAN_NUMBERS)) {
      const regex = new RegExp(`^${word}\\s+`, 'i')
      if (regex.test(workingSegment)) {
        quantity = num
        workingSegment = workingSegment.replace(regex, '')
        break
      }
    }
  }

  // 2. Poizkusi match-ati z meni artikelom
  const matchedItem = matchMenuItem(workingSegment, menuItemNames)
  if (!matchedItem) {
    return null
  }

  // 3. Ekstrahiraj modificiratorje
  const { modifiers, size, temperature, remainingText } = extractModifiers(workingSegment)

  // 4. Confidence:
  // - 1.0 če exact match
  // - 0.8 če synonym match
  // - 0.6 če partial match
  const confidence = matchedItem.confidence

  return {
    name: matchedItem.name,
    quantity,
    modifiers,
    size,
    temperature,
    confidence,
  }
}

function matchMenuItem(
  segment: string,
  menuItemNames: string[],
): { name: string; confidence: number } | null {
  const normalizedSegment = normalizeText(segment)

  // 1. Direct match z menijem
  for (const name of menuItemNames) {
    const normalizedName = normalizeText(name)
    if (normalizedSegment.includes(normalizedName)) {
      return { name, confidence: 1.0 }
    }
  }

  // 2. Synonym match
  for (const [canonical, synonyms] of Object.entries(SYNONYMS)) {
    for (const syn of synonyms) {
      const normalizedSyn = normalizeText(syn)
      if (normalizedSegment.includes(normalizedSyn)) {
        // Preveri ali je v meniju — išči po vseh sinonimih in canonical
        const allWords = [canonical, ...synonyms]
        const matchedMenuItem = menuItemNames.find((name) => {
          const normalizedName = normalizeText(name)
          return allWords.some(w => normalizedName.includes(normalizeText(w)))
        })
        return {
          name: matchedMenuItem || canonical,
          confidence: 0.8,
        }
      }
    }
  }

  return null
}

function extractModifiers(segment: string): {
  modifiers: string[]
  size?: 'small' | 'medium' | 'large'
  temperature?: 'hot' | 'cold'
  remainingText: string
} {
  const modifiers: string[] = []
  let size: 'small' | 'medium' | 'large' | undefined
  let temperature: 'hot' | 'cold' | undefined
  let remainingText = segment

  // Brez čebule, brez sladkorja, itd.
  // Poisci originalne besede (ne normalizirane) za prikaz
  const originalWords = segment.split(/\s+/)
  for (const word of MODIFIERS.without) {
    const regex = new RegExp(`\\b${word}\\s+(\\w+)`, 'gi')
    let match
    while ((match = regex.exec(segment)) !== null) {
      // Najdi originalno besedo (z diakritiko) iz segmenta
      const matchedWord = match[1]
      modifiers.push(`brez: ${matchedWord}`)
      remainingText = remainingText.replace(match[0], '')
    }
  }

  // Ekstra sir, ekstra čokolada
  for (const word of MODIFIERS.extra) {
    const regex = new RegExp(`\\b${word}\\s+(\\w+)`, 'gi')
    let match
    while ((match = regex.exec(segment)) !== null) {
      const matchedWord = match[1]
      modifiers.push(`ekstra: ${matchedWord}`)
      remainingText = remainingText.replace(match[0], '')
    }
  }

  // Velikost
  for (const word of MODIFIERS.sizeSmall) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(segment)) {
      size = 'small'
      break
    }
  }
  for (const word of MODIFIERS.sizeMedium) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(segment)) {
      size = 'medium'
      break
    }
  }
  for (const word of MODIFIERS.sizeLarge) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(segment)) {
      size = 'large'
      break
    }
  }

  // Temperatura
  for (const word of MODIFIERS.hot) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(segment)) {
      temperature = 'hot'
      break
    }
  }
  for (const word of MODIFIERS.cold) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(segment)) {
      temperature = 'cold'
      break
    }
  }

  return { modifiers, size, temperature, remainingText }
}

function isFillerWord(word: string): boolean {
  const fillers = ['prosim', 'hvala', 'ja', 'ne', 'bi', 'rad', 'rabil', 'zelim', 'zelim', 'dober', 'dan', 'dober dan', 'lahko', 'maj', 'mi']
  return fillers.includes(word.toLowerCase().trim())
}
