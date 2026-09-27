// ============================================
// R146-b (epic #115 #33 Accounting exports) — CSV generatorji za računovodske
// izvoze: payments / refunds / purchases / expenses / daily-close / journal.
//
// Pariteta order-reports.ts:
//   • { csv, filename } oblika (filename pusti '' — nastavi ga klicatelj prek
//     getFilename, da ostane enoten vzorec z obstoječimi 6 tipi),
//   • CSV ';' ločilo + CSV-injection zaščita ('=' '+' '-' '@' → '\'' prefix,
//     escapeCsvField v csv-utils.ts) — BOM doda route,
//   • toNum za Prisma.Decimal pretvorbo.
//
// SCOPE (MODEL A, R82-F kanon):
//   • payments/refunds: Payment NIMA locationId → relacijski scope prek
//     check.order.locationId (Order.locationId NOT NULL) — NIKOLI filtrirati
//     na Payment nivoju (LEAK-HIGH R82 regresija),
//   • purchases: PurchaseOrder.locationId je NULLABLE → pogojni spread;
//     lokacijski scope IZKLJUČI null-PO vrstice (fail-closed, pariteta
//     employees CSV komentarja; super-admin jih vidi v globalnem pogledu),
//   • expenses: AuditLog.locationId (R81) — pogojni spread,
//   • daily-close: DailyClose.locationId NOT NULL — pogojni spread,
//   • journal: JournalLine.locationId je denormalizirana kopija; source of
//     truth je JournalEntry.locationId → scope/filter teče prek `journalEntry`
//     relacije (R146-a kontrakt).
//
// REPRODUCIBILNOST (epic gate "accounting export reproducibility"):
//   • vsi zneski so Decimal(12,2) EUR (NI v centih — preverjeno v
//     prisma/schema.prisma :671/:2197/:2920/:3210) → toNum(x).toFixed(2),
//     BREZ /100 deljenja,
//   • datumi ISO-8601 UTC (new Date(x).toISOString()) — deterministični,
//     za razliko od toLocaleString (obstoječi orders CSV; tu namerno ISO,
//     ker računovodski izvoz mora biti byte-reproducibilen čez runtime),
//   • izrecen determinističen orderBy (+ sekundarni unique ključ) na VSIH
//     poizvedbah,
//   • expenses CAP take: 5000 (documents determinizem) — če je odrezano,
//     je to vidno kot manjkajoče vrstice pri naslednjem klicu; orderBy +
//     cap sta stabilna, zato je izvoz za isti DB snapshot reproducibilen.
//
// PII kanon: Kartica = '****' + cardLast4 (ALI '' za gotovino) — polna
// številka kartice / authorizationCode / idempotencyKey NIKOLI ne grejo v
// CSV. Uporabnik pri expenses = AuditLog.userId (employee ID, ne email/ime).
// ============================================

import { db } from '@/lib/db'
import { toNum, type DecimalLike } from '@/lib/decimal'
import { toCsvRow } from './csv-utils'

/** ISO-8601 UTC deterministic datum (računovodska reproducibilnost). */
function iso(value: Date | string): string {
  return new Date(value).toISOString()
}

/** Decimal(12,2) EUR → "12.34" (NI v centih — glej header). */
function eur(value: unknown): string {
  return toNum(value as DecimalLike).toFixed(2)
}

/** Kartica: "visa ****1234" / "****1234" / "" (NIKOLI polna številka). */
function cardMask(cardType: string, cardLast4: string): string {
  if (!cardLast4) return ''
  return cardType ? `${cardType} ****${cardLast4}` : `****${cardLast4}`
}

/**
 * Quote-aware štetje podatkovnih vrstic CSV-ja (escapeCsvField lahko v narekovajih
 * vsebuje vsebovane nove vrstice — blind split('\n') bi precenil). Header se
 * ne šteje: "h\nr1\n" → 1 podatkovna vrstica.
 */
export function countCsvRows(csv: string): number {
  if (!csv) return 0
  let newlines = 0
  let inQuotes = false
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i]
    if (ch === '"') {
      if (inQuotes && csv[i + 1] === '"') i++ // escaped "" — preskoči par
      else inQuotes = !inQuotes
    } else if (ch === '\n' && !inQuotes) {
      newlines++
    }
  }
  // Vsaka vrstica (header + podatkovne) se konča z '\n' → podatkovnih = newlines - 1
  return Math.max(0, newlines - 1)
}

type DateFilter = Record<string, Date>

function hasRange(dateFilter: DateFilter): boolean {
  return Object.keys(dateFilter).length > 0
}

// ─────────────────────────────────────────────────────────────
// payments — Payment prek check→order (relacijski lokacijski scope)
// ─────────────────────────────────────────────────────────────
export async function generatePaymentsCsv(dateFilter: DateFilter, locationId?: string | null): Promise<{ csv: string; filename: string }> {
  const payments = await db.payment.findMany({
    where: {
      ...(hasRange(dateFilter) ? { createdAt: dateFilter } : {}),
      ...(locationId ? { check: { order: { locationId } } } : {}),
    },
    include: {
      check: { include: { order: { select: { orderNumber: true, locationId: true } } } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  let csv = toCsvRow(['Datum', 'Metoda', 'Status', 'Znesek (EUR)', 'Napitnina (EUR)', 'Povračilo (EUR)', 'Kartica', 'Referenca'])
  csv += '\n'
  for (const p of payments) {
    csv += toCsvRow([
      iso(p.createdAt),
      p.type,
      p.status,
      eur(p.amount),
      eur(p.tipAmount),
      eur(p.refundAmount),
      cardMask(p.cardType, p.cardLast4),
      p.id,
    ])
    csv += '\n'
  }
  return { csv, filename: '' }
}

// ─────────────────────────────────────────────────────────────
// refunds — isti vir (Payment), filter refundAmount > 0 ALI status 'refunded'
// (Payment.status kanon: completed | refunded | voided — schema :691)
// ─────────────────────────────────────────────────────────────
export async function generateRefundsCsv(dateFilter: DateFilter, locationId?: string | null): Promise<{ csv: string; filename: string }> {
  const payments = await db.payment.findMany({
    where: {
      ...(hasRange(dateFilter) ? { createdAt: dateFilter } : {}),
      ...(locationId ? { check: { order: { locationId } } } : {}),
      OR: [{ refundAmount: { gt: 0 } }, { status: 'refunded' }],
    },
    include: {
      check: { include: { order: { select: { orderNumber: true, locationId: true } } } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  let csv = toCsvRow(['Datum', 'Originalni znesek', 'Povračilo', 'Metoda', 'Status', 'Referenca'])
  csv += '\n'
  for (const p of payments) {
    csv += toCsvRow([
      iso(p.createdAt),
      eur(p.amount),
      eur(p.refundAmount),
      p.type,
      p.status,
      p.id,
    ])
    csv += '\n'
  }
  return { csv, filename: '' }
}

// ─────────────────────────────────────────────────────────────
// purchases — PurchaseOrder + supplier (locationId nullable → pogojni spread)
// ─────────────────────────────────────────────────────────────
export async function generatePurchasesCsv(dateFilter: DateFilter, locationId?: string | null): Promise<{ csv: string; filename: string }> {
  const purchaseOrders = await db.purchaseOrder.findMany({
    where: {
      ...(hasRange(dateFilter) ? { orderDate: dateFilter } : {}),
      ...(locationId ? { locationId } : {}),
    },
    include: { supplier: { select: { name: true } } },
    orderBy: [{ orderDate: 'asc' }, { poNumber: 'asc' }],
  })

  let csv = toCsvRow(['Datum', 'Št. naročila', 'Dobavitelj', 'Stanje računa', 'Brez DDV', 'DDV', 'Skupaj'])
  csv += '\n'
  for (const po of purchaseOrders) {
    csv += toCsvRow([
      iso(po.orderDate),
      po.poNumber,
      po.supplier?.name || '',
      po.invoiceStatus,
      eur(po.subtotal),
      eur(po.vatAmount),
      eur(po.totalAmount),
    ])
    csv += '\n'
  }
  return { csv, filename: '' }
}

// ─────────────────────────────────────────────────────────────
// expenses — AuditLog(entityType 'Expense') (audit-log-as-ledger, isti vir
// kot GET /api/expenses); details JSON string → parse; CAP 5000 vrstic.
// PII: Uporabnik = userId (employee ID) — brez email/imena.
// ─────────────────────────────────────────────────────────────
const EXPENSES_EXPORT_CAP = 5000

/** Varni parse details JSON stringa (pariteta /api/expenses parseDetails). */
function parseDetails(d: unknown): Record<string, unknown> {
  if (typeof d === 'string') {
    try { return JSON.parse(d) as Record<string, unknown> } catch { return {} }
  }
  return (d as Record<string, unknown>) || {}
}

export async function generateExpensesCsv(dateFilter: DateFilter, locationId?: string | null): Promise<{ csv: string; filename: string }> {
  const logs = await db.auditLog.findMany({
    where: {
      entityType: 'Expense',
      ...(hasRange(dateFilter) ? { timestamp: dateFilter } : {}),
      ...(locationId ? { locationId } : {}),
    },
    orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
    take: EXPENSES_EXPORT_CAP,
  })

  let csv = toCsvRow(['Datum', 'Opis', 'Kategorija', 'Znesek', 'Uporabnik', 'Referenca'])
  csv += '\n'
  for (const log of logs) {
    const details = parseDetails(log.details)
    csv += toCsvRow([
      iso(log.timestamp),
      (details.description as string) || '',
      (details.category as string) || '',
      eur(details.amount),
      log.userId || '',
      log.id,
    ])
    csv += '\n'
  }
  return { csv, filename: '' }
}

// ─────────────────────────────────────────────────────────────
// daily-close — DailyClose snapshot (Z-pariteta), include location
// ─────────────────────────────────────────────────────────────
export async function generateDailyCloseCsv(dateFilter: DateFilter, locationId?: string | null): Promise<{ csv: string; filename: string }> {
  const closes = await db.dailyClose.findMany({
    where: {
      ...(hasRange(dateFilter) ? { businessDate: dateFilter } : {}),
      ...(locationId ? { locationId } : {}),
    },
    include: { location: { select: { name: true, code: true } } },
    orderBy: [{ businessDate: 'asc' }, { id: 'asc' }],
  })

  let csv = toCsvRow(['Poslovni dan', 'Lokacija', 'Prodaja skupaj', 'Gotovina', 'Kartica', 'Mobilna', 'Alternativna', 'Popusti', 'Napitnine', 'Preklici', 'Povračila', 'Odstopanje gotovine'])
  csv += '\n'
  for (const c of closes) {
    csv += toCsvRow([
      iso(c.businessDate),
      c.location?.name || c.locationId,
      eur(c.totalSales),
      eur(c.cashSales),
      eur(c.cardSales),
      eur(c.mobileSales),
      eur(c.alternateSales),
      eur(c.totalDiscounts),
      eur(c.totalTips),
      eur(c.totalVoided),
      eur(c.totalRefunds),
      eur(c.cashVariance),
    ])
    csv += '\n'
  }
  return { csv, filename: '' }
}

// ─────────────────────────────────────────────────────────────
// journal — double-entry izpis PO JournalLine vrsticah (include entry);
// scope prek entry.locationId (source of truth; denormalizacija je samo
// optimizacija — schema :3214). orderBy entry.createdAt + line id (determin).
// ─────────────────────────────────────────────────────────────
export async function generateJournalCsv(dateFilter: DateFilter, locationId?: string | null): Promise<{ csv: string; filename: string }> {
  const lines = await db.journalLine.findMany({
    where: {
      ...(locationId || hasRange(dateFilter)
        ? {
            journalEntry: {
              ...(locationId ? { locationId } : {}),
              ...(hasRange(dateFilter) ? { date: dateFilter } : {}),
            },
          }
        : {}),
    },
    include: { journalEntry: true },
    orderBy: [{ journalEntry: { createdAt: 'asc' } }, { id: 'asc' }],
  })

  let csv = toCsvRow(['Vnos', 'Datum', 'Konto', 'Konto ime', 'Bremenitev (debit)', 'Kronanje (kredit)', 'Referenca', 'Vir', 'Status vnosa'])
  csv += '\n'
  for (const line of lines) {
    const entry = line.journalEntry
    const reference = [entry.referenceType, entry.reference].filter(Boolean).join(':')
    csv += toCsvRow([
      entry.entryNumber,
      iso(entry.date),
      line.accountCode,
      line.accountName,
      eur(line.debit),
      eur(line.credit),
      reference,
      entry.source,
      entry.status,
    ])
    csv += '\n'
  }
  return { csv, filename: '' }
}
