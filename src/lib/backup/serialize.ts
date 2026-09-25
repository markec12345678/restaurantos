// ============================================
// BACKUP — KANONIČNA SERIALIZACIJA (P0-6)
// ============================================
// Deterministična (kanonična) oblika vsebine backupa — temelj za checksum,
// ki mora preživeti JSON round-trip (datoteka na disku → JSON.parse → restore):
//  • ključi objektov SORTIRANI (obyčajen .sort() = codepoint red, determinističen)
//  • Decimal (decimal.js instance) → toString() STRING — natančen round-trip
//    (db.ts patcha Decimal.prototype.toJSON → toNumber(), kar bi PRIKRADLO
//    decimalko; tu namerno NE uporabimo toJSON)
//  • Date → ISO string
//  • BigInt → tag { __rsType: 'bigint', v: '...' } (forward-compat, danes v
//    shemi ni BigInt polj)
//  • Uint8Array/Buffer → tag { __rsType: 'bytes', v: base64 } (forward-compat)
//  • globinski varoval > 100 nivojev → BackupError FORMAT
//
// decodeRowValues je inverz tagov za restore pot (rekurzivno hoja po objektih).

import { createHash } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { Prisma } from '@prisma/client'
import { BackupError } from './errors'

const MAX_DEPTH = 100

/** Tag za vrednosti, ki jih JSON ne prenese natanko (BigInt/bytes). */
interface RsTag {
  __rsType: 'bigint' | 'bytes'
  v: string
}

type JsonSafeValue = string | number | boolean | null | RsTag | JsonSafeValue[] | { [key: string]: JsonSafeValue }

/**
 * Pretvori poljubno vrednost v JSON-varno strukturo s sortiranimi ključi.
 * Vrne JS vrednost (ne string) — canonicalStringify jo samo še stringify-a,
 * encodeRowValues pa jo uporabi za JSON-varne vrstice v BackupFile.
 */
export function encodeValue(value: unknown, depth = 0): JsonSafeValue {
  if (depth > MAX_DEPTH) {
    throw new BackupError('FORMAT', `Pregloboka struktura (> ${MAX_DEPTH} nivojev) — vrstice so drevesa brez ciklov`)
  }
  if (value === null) return null
  // Direktni typeof checki (ne alias prek const) — zagotovi pravilno
  // TS narrowing primitivov (string/boolean/number) v JsonSafeValue.
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'bigint') return { __rsType: 'bigint', v: value.toString() }
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return null
  const obj = value as object
  if (obj instanceof Date) return obj.toISOString()
  // Decimal → toString STRING (natančen round-trip; NE toJSON, ki ga db.ts
  // patcha na toNumber() in bi izgubil decimalna mesta)
  if (obj instanceof Prisma.Decimal) return obj.toString()
  if (obj instanceof Uint8Array) {
    return { __rsType: 'bytes', v: Buffer.from(obj).toString('base64') }
  }
  if (Array.isArray(obj)) {
    const out: JsonSafeValue[] = []
    for (const item of obj) out.push(encodeValue(item, depth + 1))
    return out
  }
  // Objekt (tudi class instance) — lastni ključi, SORTIRANI po codepointu
  const sorted: Record<string, JsonSafeValue> = {}
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = encodeValue((obj as Record<string, unknown>)[key], depth + 1)
  }
  return sorted
}

/** Determinističen JSON string (sortirani ključi, tagi za BigInt/bytes). */
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(encodeValue(value))
}

/** SHA-256 nad kanonično obliko vrednosti (hex). */
export function computeChecksum(value: unknown): string {
  return createHash('sha256').update(canonicalStringify(value)).digest('hex')
}

/**
 * Pretvori vrstico (Record) v JSON-varno vrstico: Decimal→string, Date→ISO,
 * BigInt/bytes→tag. Uporablja createBackup — BackupFile je s tem direktno
 * JSON-serializabilen BREZ izgube natančnosti (checksum stabilen tudi po
 * JSON round-tripu na disku).
 */
export function encodeRowValues(row: Record<string, unknown>): Record<string, unknown> {
  const encoded = encodeValue(row)
  if (encoded !== null && typeof encoded === 'object' && !Array.isArray(encoded)) {
    return encoded as Record<string, unknown>
  }
  return {}
}

/** Obrni tag: { __rsType: 'bigint', v } → BigInt(v); bytes → Buffer. */
function decodeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return value
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value.map(item => decodeValue(item, depth + 1))
  }
  const rec = value as Record<string, unknown>
  const keys = Object.keys(rec)
  if (keys.length === 2 && typeof rec.v === 'string') {
    if (rec.__rsType === 'bigint') {
      try {
        return BigInt(rec.v)
      } catch {
        return value // pokvarjen tag → pusti kot je (restore bo javil napako per kolono)
      }
    }
    if (rec.__rsType === 'bytes') {
      return Buffer.from(rec.v, 'base64')
    }
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rec)) {
    out[k] = decodeValue(v, depth + 1)
  }
  return out
}

/**
 * Obrne tag-encoding (bigint/bytes) čez celotno vrstico — rekurzivno v
 * gnezdena objekta/sezname. Uporablja restore pred vstavljanjem.
 */
export function decodeRowValues(row: Record<string, unknown>): Record<string, unknown> {
  return decodeValue(row, 0) as Record<string, unknown>
}

/**
 * Topološka rekonstrukcija AuditLog hash verige (previousHash → chainHash).
 * Začne pri genesis vrstici (previousHash ''/null/undefined), nadaljuje prek
 * indeksa po previousHash. Vrstice s prekinjeno verigo (orphan — previousHash
 * ne najde starša) gredo na KONEC v izvirnem vrstnem redu + warning — restore
 * mora biti mogoč tudi z delno pokvarjeno verigo (ne meče napake).
 *
 * KONTRAKT (R127-c se zanaša): vrne { rows, warnings }.
 */
export function sortAuditLogRows(rows: Array<Record<string, unknown>>): {
  rows: Array<Record<string, unknown>>
  warnings: string[]
} {
  const warnings: string[] = []
  if (rows.length === 0) return { rows: [], warnings }

  // Indeks: previousHash → prva vrstica z njim (podvojitve ostanejo orphan)
  const byPrev = new Map<string, Record<string, unknown>>()
  for (const r of rows) {
    const p = r.previousHash
    if (typeof p === 'string' && p !== '' && !byPrev.has(p)) byPrev.set(p, r)
  }

  const isGenesis = (r: Record<string, unknown>): boolean => {
    const p = r.previousHash
    return p === '' || p === null || p === undefined
  }

  const used = new Set<Record<string, unknown>>()
  const ordered: Array<Record<string, unknown>> = []

  const genesis = rows.find(isGenesis)
  if (genesis) {
    ordered.push(genesis)
    used.add(genesis)
    // Varovalka proti ciklu v verigi: največ rows.length korakov
    let guard = 0
    while (guard++ <= rows.length) {
      const cur = ordered[ordered.length - 1] as Record<string, unknown>
      const ch = cur.chainHash
      if (typeof ch !== 'string' || ch === '') break
      const next = byPrev.get(ch)
      if (!next || used.has(next)) break
      ordered.push(next)
      used.add(next)
    }
  }

  const orphans = rows.filter(r => !used.has(r))
  if (orphans.length > 0) {
    warnings.push(
      `AuditLog veriga: ${orphans.length} vrstic brez povezave na starša (dodane na konec v izvirnem vrstnem redu)`,
    )
  }
  return { rows: [...ordered, ...orphans], warnings }
}
