// ─── RUNDA 56: CSV izvoz (ENOTEN VIR) ───
// Prvi uporabnik: Zgodovina transakcij darilnih kartic (TransactionHistoryDialog).
// Cilj: datoteka, ki se v slovenskem Excelu ODPRE PRAVILNO ob dvokliku:
//   • ločilo ';' (SI/HR regionalne nastavitve Excela pričakujo podpičje —
//     vejica jedecimalni ločilec, zato ',' kot separator razbije stolpce)
//   • decimalna VEJICA ("10,50" namesto "10.50") — združljivo s knjigovodstvom
//   • UTF-8 BOM (\uFEFF) — Excel sicer šumi (šČŽ postanejo mojibake)
//   • CRLF vrstični konec (RFC 4180 + Excel prijazen)
//
// Bežna varnost: vse celice z ločilom, navedkom ali prelomom se ovijejo
// v navedke, notranji navedki se podvojijo (RFC 4180 §2.7).

export interface CsvBuildOptions {
  /** Stolpčni ločilo (privzeto ';'). */
  delimiter?: string
  /** Decimalna vejica namesto pike (privzeto true — SI knjigovodstvo). */
  decimalComma?: boolean
  /** UTF-8 BOM na začetku (privzeto true — Excel kompatibilnost). */
  bom?: boolean
  /** Vrstični konec (privzeto '\r\n'). */
  lineEnding?: '\r\n' | '\n'
}

export interface CsvDownloadFile {
  /** Predlagano ime datoteke (brez poti). */
  filename: string
  /** Vsebina datoteke (z BOM, pripravljena za Blob). */
  content: string
}

/** Števec na 2 decimalni mesti; neštevilčne/neskončne vrednosti → '' (prazna celica). */
export function formatCsvNumber(value: number, opts?: { decimalComma?: boolean }): string {
  const decimalComma = opts?.decimalComma ?? true
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  // toFixed zaokroži na 2 mesti; "-0,00" normaliziramo na "0,00" (kozmetični šum)
  const fixed = value.toFixed(2)
  const normalized = fixed === '-0.00' ? '0.00' : fixed
  return decimalComma ? normalized.replace('.', ',') : normalized
}

/** Ubeži eno celico: navedki, ločilo, prelomi → ovij v navedke (RFC 4180). */
export function csvEscapeCell(value: unknown, opts?: { delimiter?: string }): string {
  const delimiter = opts?.delimiter ?? ';'
  if (value === null || value === undefined) return ''
  const s = typeof value === 'string' ? value : String(value)
  const needsQuoting = s.includes('"') || s.includes(delimiter) || /[\r\n]/.test(s)
  if (!needsQuoting) return s
  return `"${s.replace(/"/g, '""')}"`
}

/**
 * Zgradi CSV dokument: glava + vrstice. Vse celice gredo skozi
 * csvEscapeCell; števila ostanejo surova (klicatelj jih formatira
 * z formatCsvNumber, če želi decimalno vejico).
 */
export function buildCsv(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
  opts?: CsvBuildOptions,
): string {
  const delimiter = opts?.delimiter ?? ';'
  const bom = opts?.bom ?? true
  const lineEnding = opts?.lineEnding ?? '\r\n'
  const cell = (v: unknown) => csvEscapeCell(v, { delimiter })
  const lines: string[] = [headers.map(cell).join(delimiter)]
  for (const row of rows) lines.push(row.map(cell).join(delimiter))
  return (bom ? '\uFEFF' : '') + lines.join(lineEnding)
}

/**
 * Časovni žig v Excel-prijazni obliki dd.MM.yyyy HH:mm v Europe/Ljubljana
 * (enaka časovna zona kot formatLjubljanaTime iz R54 — rezervacije).
 * Neveljaven datum → '' (prazna celica, ne 'Invalid Date').
 */
export function formatCsvTimestamp(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const fmt = new Intl.DateTimeFormat('sl-SI', {
    timeZone: 'Europe/Ljubljana',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  // sl-SI deli komponente z '. ' in ',' — sestavimo deterministično iz delov
  const parts = fmt.formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`
}

// ─── Darilne kartice: preslikava transakcij → CSV ───

export interface GiftCardTxForCsv {
  type: string
  amount: number
  balanceAfter: number
  note?: string | null
  createdAt: string
}

export const GIFT_CARD_CSV_HEADERS = [
  'Datum in ura',
  'Vrsta',
  'Znesek (EUR)',
  'Stanje po (EUR)',
  'Opomba',
] as const

/**
 * Zgradi celotno CSV datoteko zgodovine transakcij darilne kartice.
 * Zneski so BREZ predznaka '+' (surova števila, da SUM v Excelu deluje);
 * poraba je negativna (-5,00). Vrsta = prijazno ime kategorije.
 */
export function giftCardHistoryCsv(
  transactions: ReadonlyArray<GiftCardTxForCsv>,
  typeLabels: Record<string, string>,
  opts?: CsvBuildOptions,
): string {
  const rows = transactions.map((tx) => {
    const type = typeof tx?.type === 'string' ? tx.type : ''
    return [
      formatCsvTimestamp(tx.createdAt),
      typeLabels[type] ?? 'Prilagojeno',
      formatCsvNumber(tx.amount, opts),
      formatCsvNumber(tx.balanceAfter, opts),
      tx.note ?? '',
    ] as ReadonlyArray<unknown>
  })
  return buildCsv(GIFT_CARD_CSV_HEADERS, rows, opts)
}

/**
 * Predlagano ime datoteke: zgodovina-{kartica}-{YYYY-MM-DD}.csv.
 * Številka kartice se očisti presledkov in znakov, nevarnih za datotečni sistem.
 */
export function giftCardCsvFilename(cardNumber: string, now: Date = new Date()): string {
  const safeCard = (cardNumber || 'kartica')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `zgodovina-${safeCard}-${y}-${m}-${d}.csv`
}

// ─── Darilne kartice: register kartic → CSV (RUNDA 56, drugi izvoz) ───

export interface GiftCardForCsv {
  cardNumber: string
  ownerName: string
  status: string
  initialBalance: number
  balance: number
  purchasedAt: string
  expiresAt: string | null
}

export const GIFT_CARD_REGISTRY_CSV_HEADERS = [
  'Številka kartice',
  'Lastnik',
  'Status',
  'Začetno stanje (EUR)',
  'Trenutno stanje (EUR)',
  'Datum nakupa',
  'Datum poteka',
] as const

/**
 * Register kartic (trenutno filtriran/sortiran seznam) → CSV.
 * Datum poteka je lahko prazen ("Brez roka" v UI → prazna celica).
 */
export function giftCardRegistryCsv(
  cards: ReadonlyArray<GiftCardForCsv>,
  statusLabels: Record<string, string>,
  opts?: CsvBuildOptions,
): string {
  const rows = cards.map((c) => [
    c.cardNumber ?? '',
    c.ownerName ?? '',
    statusLabels[c.status] ?? c.status,
    formatCsvNumber(c.initialBalance, opts),
    formatCsvNumber(c.balance, opts),
    formatCsvTimestamp(c.purchasedAt),
    c.expiresAt ? formatCsvTimestamp(c.expiresAt) : '',
  ] as ReadonlyArray<unknown>)
  return buildCsv(GIFT_CARD_REGISTRY_CSV_HEADERS, rows, opts)
}

/** Ime datoteke registra: register-darilnih-kartic-{YYYY-MM-DD}.csv. */
export function giftCardRegistryCsvFilename(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `register-darilnih-kartic-${y}-${m}-${d}.csv`
}

/**
 * Prenesi CSV v brskalniku (Blob + object URL). Vrne false v ne-brskalniški
 * sredini (SSR/testi) ali če URL API manjka — klicatelj lahko pokaže napako.
 */
export function downloadCsv(filename: string, content: string): boolean {
  if (typeof window === 'undefined' || typeof window.document === 'undefined') return false
  try {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = window.document.createElement('a')
    a.href = url
    a.download = filename
    window.document.body.appendChild(a)
    a.click()
    a.remove()
    // URL.release — po _click_ (ne takoj), zato rahel zamik prek timeouta
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  } catch {
    return false
  }
}
