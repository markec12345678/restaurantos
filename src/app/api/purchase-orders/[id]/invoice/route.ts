// POST/GET /api/purchase-orders/[id]/invoice — Račun dobavitelja + three-way match
//
// R132 (epic #115 P1-12, §2c/§2d): three-way match kanon — PO (naročeno) ↔
// GRN (prejeto: sprejeto + zavrnjeno) ↔ Supplier Invoice (zaračunano).
// Variance se PRIKAŽE, nabavna cena se NE tiho prepše (price history se iz
// računa NIKOLI ne prepisuje — kanon #4 R130 / #6 R132).
//
// POST (§2c):
//   - Tx Serializable + advisory lock hashtext(poId) — pariteta prevzemnega
//     kanona (R105) + tx-fresh re-read PO.
//   - Če PO že ima AVTO-AP placeholder (invoiceNumber = poNumber, ustvarjen ob
//     full receive) → TA AP se POSODOBI (real invoiceNumber, datumi, linije) —
//     NIKOLI dvojni AP (kanon #4). Idempotentno: ponovljen POST z istim
//     invoiceNumber → update + recompute (deleteMany + createMany linij).
//   - AP brez PO poti se ne spreminja (tu ni dosegljiva — lookup je strogo per
//     purchaseOrderId).
//   - Per-line variance: price če |inv − ordered| > max(0.01, 0.5 % relativo);
//     qty če invoiced > accepted (GRN vsota). Roll-up: AP.matchStatus +
//     PO.invoiceStatus PERSISTIRANA (list filtering); per-line poročilo se
//     RAČUNA ŽIVO ob branju (GET), nikoli stale.
//   - Race-pathi P2002/P2034 → 409 (pariteta PO-2); strukturirani throw-i
//     { error, status } + structuredErrorResponse (R105 PO-6 kanon).
//
// GET (§2d): AP (če obstaja, z linijami) + ŽIVO recompute match (ista logika
// kot POST, brez pisanja). Brez AP → { accountsPayable: null, match: null }.

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import type { DecimalLike } from '@/lib/decimal'
import {
  deepToNumbers,
  toNum,
  round2,
  round3,
  greaterThan,
  multiply,
  subtract,
  sumBy,
  abs,
  calcVat,
} from '@/lib/decimal'
import { validateRequest } from '@/lib/api-utils'
import { structuredErrorResponse } from '@/lib/structured-error'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// ── Zod (§2c kontrakt) ──────────────────────────────────────────────
const invoiceLineSchema = z.object({
  poItemId: z.string().min(1, 'ID postavke je obvezen').max(100, 'ID postavke je predolg'),
  quantityInvoiced: z
    .number()
    .positive('Zaračunana količina mora biti pozitivna')
    .max(99999, 'Zaračunana količina je prevelika'),
  unitPriceInvoiced: z.number().min(0, 'Cena računa ne sme biti negativna'),
  vatRate: z.number().min(0, 'DDV stopnja ne sme biti negativna').max(100, 'DDV stopnja je prevelika').optional(),
})

const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1, 'Številka računa je obvezna').max(100, 'Številka računa je predolga'),
  invoiceDate: z
    .string()
    .refine(v => !Number.isNaN(new Date(v).getTime()), 'Datum računa ni veljaven')
    .optional(),
  dueDate: z
    .string()
    .min(1, 'Datum zapadlosti je obvezen')
    .max(30, 'Datum je predolg')
    .refine(v => !Number.isNaN(new Date(v).getTime()), 'Datum zapadlosti ni veljaven'),
  lines: z.array(invoiceLineSchema).min(1, 'Vsaj ena linija računa je obvezna').max(200, 'Največ 200 linij na račun'),
  notes: z.string().max(1000, 'Opombe so predolge').optional(),
})

// ── Match toleranca (kanon #5): price variance, če |inv − ordered| >
// max(0.01 absolutno, 0.5 % relativo); qty variance, če invoiced > accepted
// (+ epsilon za float dust). ──
const PRICE_ABS_TOLERANCE = 0.01
const PRICE_REL_TOLERANCE = 0.005 // 0.5 %
const QTY_EPSILON = 1e-9

export interface RecomputedLine {
  varianceStatus: 'match' | 'variance_qty' | 'variance_price' | 'variance_both' | 'unreceived'
  varianceNote: string
  priceVariancePct: number
  priceVar: boolean
  qtyVar: boolean
  lineTotal: number
  priceOrdered: number
  acceptedQty: number
  vatRate: number
}

/** Slovenski format denarja: 12.5 → '12,50' (determinističen, brez Intl). */
function fmtMoney(v: number): string {
  return v.toFixed(2).replace('.', ',')
}

/** Slovenski format količine: 60 → '60', 12.5 → '12,5' (do 3 dec, brez odvečnih ničel). */
function fmtQty(v: number): string {
  const s = v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',')
  return s === '' ? '0' : s
}

/**
 * Živi three-way match per linija (ista logika za POST persistiranje in GET
 * recompute — nikoli stale). GRN linije so v ISTI enoti kot PO postavka
 * (pack kanon R131) → direktna vsota quantityAccepted.
 */
export function recomputeInvoiceLine(input: {
  poItem: { description: string; unit: string; quantityOrdered: DecimalLike; quantityReceived: DecimalLike; quantityRejected: DecimalLike; unitPrice: DecimalLike; vatRate: DecimalLike } | null
  quantityInvoiced: number
  unitPriceInvoiced: number
  acceptedQty: number
  vatRateInvoiced: number | null
}): RecomputedLine {
  const { poItem, quantityInvoiced, unitPriceInvoiced, acceptedQty, vatRateInvoiced } = input
  const unit = poItem?.unit ?? ''
  const priceOrdered = poItem ? toNum(poItem.unitPrice) : 0

  // Price variance: |inv − ordered| > max(0.01, 0.5 % × ordered). Diff prek
  // Decimal subtract (float-dust varna meja — 1.01 − 1.00 je točno 0.01).
  const priceDiff = toNum(abs(subtract(unitPriceInvoiced, priceOrdered)))
  const priceTolerance = Math.max(PRICE_ABS_TOLERANCE, PRICE_REL_TOLERANCE * priceOrdered)
  const priceVar = greaterThan(priceDiff, priceTolerance)

  // Qty variance: invoiced > accepted + epsilon
  const qtyVar = quantityInvoiced > acceptedQty + QTY_EPSILON

  // Unreceived: prevzema ni (accepted ≈ 0), račun pa zaračunava
  const unreceived = acceptedQty <= QTY_EPSILON && quantityInvoiced > 0

  let varianceStatus: RecomputedLine['varianceStatus']
  if (unreceived) varianceStatus = 'unreceived'
  else if (priceVar && qtyVar) varianceStatus = 'variance_both'
  else if (priceVar) varianceStatus = 'variance_price'
  else if (qtyVar) varianceStatus = 'variance_qty'
  else varianceStatus = 'match'

  // priceVariancePct: relativni odmik cene (round2); ordered 0 → 100 %, če je
  // račun zaračunal karkoli (polna varanca), sicer 0.
  const priceVariancePct =
    priceOrdered > 0
      ? round2(((unitPriceInvoiced - priceOrdered) / priceOrdered) * 100)
      : unitPriceInvoiced > 0
        ? 100
        : 0

  // Razložljiv sl opis (kanon #5): 'Račun: 12,00 €/kg, naročeno: 10,50 €/kg
  // (+14,3 %)' / 'Račun: 60 kg, sprejeto: 50 kg'.
  const priceNote =
    `Račun: ${fmtMoney(unitPriceInvoiced)} €/${unit}, naročeno: ${fmtMoney(priceOrdered)} €/${unit}` +
    ` (${priceVariancePct >= 0 ? '+' : '−'}${Math.abs(priceVariancePct).toFixed(1).replace('.', ',')} %)`
  const qtyNote = `Račun: ${fmtQty(quantityInvoiced)} ${unit}, sprejeto: ${fmtQty(acceptedQty)} ${unit}`

  let varianceNote = ''
  if (varianceStatus === 'unreceived') varianceNote = `${qtyNote} — postavka ni bila prevzeta`
  else if (varianceStatus === 'variance_both') varianceNote = `${priceNote}; ${qtyNote}`
  else if (varianceStatus === 'variance_price') varianceNote = priceNote
  else if (varianceStatus === 'variance_qty') varianceNote = qtyNote

  return {
    varianceStatus,
    varianceNote,
    priceVariancePct,
    priceVar,
    qtyVar,
    lineTotal: round2(multiply(quantityInvoiced, unitPriceInvoiced)),
    priceOrdered,
    acceptedQty,
    vatRate: vatRateInvoiced ?? (poItem ? toNum(poItem.vatRate) : 0),
  }
}

interface LineComputation {
  poItemId: string
  poItem: { id: string; description: string; unit: string; quantityOrdered: DecimalLike; quantityReceived: DecimalLike; quantityRejected: DecimalLike; unitPrice: DecimalLike; vatRate: DecimalLike } | null
  description: string
  quantityInvoiced: number
  unitPriceInvoiced: number
  vatRateInvoiced: number | null
  match: RecomputedLine
}

/** Vsota quantityAccepted iz GRN linij per poItemId (tx-fresh / živo).
 * Klient je OBVEZEN parameter: znotraj POST tx teče prek tx (tx-fresh kanon
 * #1 — module-level db bi bil izven Serializable snapshot/locka), GET pa
 * prek db (živo branje brez pisanja). */
async function acceptedQtyByPoItem(client: Pick<typeof db, 'goodsReceiptItem'> | Prisma.TransactionClient, poItemIds: string[]): Promise<Map<string, number>> {
  if (poItemIds.length === 0) return new Map()
  const grnItems = await client.goodsReceiptItem.findMany({
    where: { purchaseOrderItemId: { in: poItemIds } },
    select: { purchaseOrderItemId: true, quantityAccepted: true },
  })
  const map = new Map<string, number>()
  for (const gi of grnItems) {
    const key = gi.purchaseOrderItemId
    if (!key) continue
    map.set(key, (map.get(key) ?? 0) + toNum(gi.quantityAccepted))
  }
  return map
}

/** Roll-up (kanon #5): match.lines → AP.matchStatus + PO.invoiceStatus. */
function rollUpStatuses(lines: LineComputation[], totalOrdered: number, totalInvoiced: number) {
  const matchStatus =
    lines.length === 0 ? 'unmatched' : lines.every(l => l.match.varianceStatus === 'match') ? 'matched' : 'variance'
  const anyVariance = lines.some(l => l.match.varianceStatus !== 'match')
  // PO.invoiceStatus: vsak variance → 'variance' (prednost pred invoiced);
  // vse match: Σ < Σ ordered → 'partial', sicer 'invoiced'.
  const invoiceStatus = anyVariance
    ? 'variance'
    : totalInvoiced < totalOrdered - QTY_EPSILON
      ? 'partial'
      : 'invoiced'
  return { matchStatus, invoiceStatus }
}

// ════════════════════════════════════════════════════════════════════
// POST — zabeleži račun dobavitelja (match + AP update/create + roll-up)
// ════════════════════════════════════════════════════════════════════
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { id } = await params

    const { data: body, error: validationError } = await validateRequest(req, invoiceSchema)
    if (validationError) return validationError

    // R86-2b kanon: centralni tenant scope resolver takoj za requireAuth.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'POST /api/purchase-orders/[id]/invoice',
    })
    if ('error' in scope) return scope.error

    const result = await db.$transaction(async (tx) => {
      // Pariteta prevzemnega kanona (R105): advisory lock per PO + Serializable.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`

      // Tx-fresh scoped re-read (kanon #1 — validacija samo proti svežim podatkom).
      const po = await tx.purchaseOrder.findFirst({
        where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
        include: { items: true },
      })
      if (!po) throw { error: 'Naročilo ni najdeno', status: 404 }
      if (po.status === 'cancelled') {
        throw { error: 'Računa dobavitelja ni mogoče zabeležiti — naročilo je preklicano', status: 400 }
      }

      // Tx-fresh AP lookup (kanon #4): avto-AP placeholder iz prevzema?
      const existingAp = await tx.accountsPayable.findFirst({
        where: { purchaseOrderId: id },
      })

      // Zaščita duplikata (kanon #4): isti invoiceNumber na DRUGEM AP-ju tega
      // dobavitelja → 409. Own placeholder (id match) je izključen → re-POST
      // je idempotenten update + recompute.
      const duplicateAp = await tx.accountsPayable.findFirst({
        where: {
          supplierId: po.supplierId,
          invoiceNumber: body.invoiceNumber,
          id: { not: existingAp?.id ?? '' },
        },
        select: { id: true },
      })
      if (duplicateAp) {
        throw { error: 'Račun s to številko že obstaja', status: 409 }
      }

      // Fail-closed (kanon PO-4 pariteta): neznan poItemId → 400, brez pisanj.
      for (const line of body.lines) {
        if (!po.items.some(i => i.id === line.poItemId)) {
          throw { error: `Postavka ${line.poItemId} ni najdena v naročilu`, status: 400 }
        }
      }

      // Vsota sprejetih količin iz GRN linij (tx-fresh, ista enota kot PO item).
      const acceptedMap = await acceptedQtyByPoItem(tx, po.items.map(i => i.id))

      // Per-line match račun (proti tx-fresh podatkom) + denar iz linij.
      const computations: LineComputation[] = body.lines.map(line => {
        const poItem = po.items.find(i => i.id === line.poItemId) ?? null
        const match = recomputeInvoiceLine({
          poItem,
          quantityInvoiced: line.quantityInvoiced,
          unitPriceInvoiced: line.unitPriceInvoiced,
          acceptedQty: acceptedMap.get(line.poItemId) ?? 0,
          vatRateInvoiced: line.vatRate ?? null,
        })
        return {
          poItemId: line.poItemId,
          poItem,
          description: poItem?.description ?? '',
          quantityInvoiced: line.quantityInvoiced,
          unitPriceInvoiced: line.unitPriceInvoiced,
          vatRateInvoiced: line.vatRate ?? null,
          match,
        }
      })

      // Denar IZ LINIJ (kanon #4): subtotal = Σ round2(qty×price), vatAmount =
      // Σ round2(qty×price×vat/100), total = subtotal + vat (round2).
      const subtotal = round2(sumBy(computations, c => c.match.lineTotal))
      const vatAmount = round2(sumBy(computations, c => calcVat(c.match.lineTotal, c.match.vatRate)))
      const totalAmount = round2(subtotal + vatAmount)

      // Roll-up (kanon #5) — persistirana (list filtering).
      const totalOrdered = sumBy(po.items, i => toNum(i.quantityOrdered))
      const totalInvoiced = sumBy(computations, c => c.quantityInvoiced)
      const { matchStatus, invoiceStatus } = rollUpStatuses(
        computations,
        round3(totalOrdered),
        round3(totalInvoiced),
      )

      // AP update (avto-AP placeholder — NIKOLI dvojni AP) ali create.
      let apId: string
      let apNumber: string
      if (existingAp) {
        apId = existingAp.id
        apNumber = existingAp.apNumber // STAR apNumber ostane (interni ključ)
        await tx.accountsPayable.update({
          where: { id: existingAp.id },
          data: {
            invoiceNumber: body.invoiceNumber, // realna številka računa
            invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : existingAp.invoiceDate,
            dueDate: new Date(body.dueDate),
            subtotal,
            vatAmount,
            totalAmount,
            matchStatus,
            ...(body.notes !== undefined ? { notes: body.notes } : {}),
          },
        })
      } else {
        // apNumber count+1 (pariteta PO-2: @unique + P2002 → 409 retry — catch v ruti).
        const year = new Date().getFullYear()
        const apCount = await tx.accountsPayable.count({ where: { apNumber: { startsWith: `AP-${year}-` } } })
        apNumber = `AP-${year}-${String(apCount + 1).padStart(6, '0')}`
        const created = await tx.accountsPayable.create({
          data: {
            apNumber,
            supplierId: po.supplierId,
            purchaseOrderId: po.id,
            invoiceNumber: body.invoiceNumber,
            invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : new Date(),
            dueDate: new Date(body.dueDate),
            subtotal,
            vatAmount,
            totalAmount,
            status: 'open',
            matchStatus,
            notes: body.notes ?? '',
            locationId: po.locationId ?? null,
          },
        })
        apId = created.id
      }

      // AP linije: deleteMany + createMany per line (idempotenten re-POST).
      await tx.accountsPayableLine.deleteMany({ where: { accountsPayableId: apId } })
      await tx.accountsPayableLine.createMany({
        data: computations.map(c => ({
          accountsPayableId: apId,
          purchaseOrderItemId: c.poItemId,
          description: c.description,
          quantityInvoiced: c.quantityInvoiced,
          unitPriceInvoiced: c.unitPriceInvoiced,
          vatRateInvoiced: c.vatRateInvoiced,
          lineTotal: c.match.lineTotal,
          varianceStatus: c.match.varianceStatus,
          varianceNote: c.match.varianceNote,
        })),
      })

      // PO.invoiceStatus persistirana (list filtering).
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { invoiceStatus },
      })

      // Svež read za odgovor (z linijami).
      const apWithLines = await tx.accountsPayable.findUniqueOrThrow({
        where: { id: apId },
        include: {
          lines: { orderBy: { createdAt: 'asc' } },
          supplier: { select: { id: true, name: true, code: true } },
        },
      })

      return {
        ap: apWithLines as unknown as Record<string, unknown>,
        apNumber,
        matchStatus,
        invoiceStatus,
        poNumber: po.poNumber,
        computations,
        totalOrdered: round3(toNum(totalOrdered)),
        totalInvoiced: round3(toNum(totalInvoiced)),
        totalAccepted: round3(sumBy(po.items, i => acceptedMap.get(i.id) ?? 0)),
        varianceLines: computations.filter(c => c.match.varianceStatus !== 'match').length,
      }
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10_000,
    })

    // Audit ZUNAJ tx (kanon #8 — pariteta receive route).
    try {
      await createAuditLog({
        userId: authResult.session?.employeeId,
        action: 'SUPPLIER_INVOICE_RECORDED',
        entityType: 'AccountsPayable',
        entityId: (result.ap as { id?: string }).id ?? '',
        details: {
          poNumber: result.poNumber,
          apNumber: result.apNumber,
          invoiceNumber: body.invoiceNumber,
          matchStatus: result.matchStatus,
          varianceLines: result.varianceLines,
        },
      })
    } catch {
      // Audit log napaka ne sme blokirati knjiženja računa
    }

    // Match poročilo (201) — per-line + totals (deepToNumbers čez API mejo).
    const matchLines = result.computations.map(c => ({
      poItemId: c.poItemId,
      description: c.description,
      unit: c.poItem?.unit ?? '',
      quantityOrdered: c.poItem ? toNum(c.poItem.quantityOrdered) : 0,
      quantityAccepted: c.match.acceptedQty,
      quantityRejected: c.poItem ? toNum(c.poItem.quantityRejected) : 0,
      quantityInvoiced: c.quantityInvoiced,
      unitPriceOrdered: c.match.priceOrdered,
      unitPriceInvoiced: c.unitPriceInvoiced,
      priceVariancePct: c.match.priceVariancePct,
      vatRateInvoiced: c.match.vatRate,
      lineTotal: c.match.lineTotal,
      varianceStatus: c.match.varianceStatus,
      varianceNote: c.match.varianceNote,
    }))
    const totals = {
      ordered: result.totalOrdered,
      accepted: result.totalAccepted,
      invoiced: result.totalInvoiced,
      priceVarTotal: round2(sumBy(
        result.computations.filter(c => c.match.priceVar),
        c => multiply(c.unitPriceInvoiced - c.match.priceOrdered, c.quantityInvoiced),
      )),
      qtyVarTotal: round3(sumBy(
        result.computations.filter(c => c.match.qtyVar),
        c => c.quantityInvoiced - c.match.acceptedQty,
      )),
    }

    return NextResponse.json({
      accountsPayable: deepToNumbers(result.ap),
      match: {
        matchStatus: result.matchStatus,
        invoiceStatus: result.invoiceStatus,
        lines: deepToNumbers(matchLines),
        totals: deepToNumbers(totals),
      },
    }, { status: 201 })
  } catch (error: unknown) {
    // Race-pathi nikoli 500 — P2002 (apNumber @unique count+1 med sočasna
    // knjiženja) → 409 retry; P2034 serialization conflict → 409 retry.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return NextResponse.json(
        { error: 'Račun je v obdelavi (sočasen dostop) — poskusite znova' },
        { status: 409 }
      )
    }
    // R105 PO-6 kanon: strukturirani { error, status } throw-i iz tx teles
    // (400/404/409) → pravi statusi.
    return structuredErrorResponse(error, 'POST /api/purchase-orders/[id]/invoice', 'Napaka pri shranjevanju računa dobavitelja')
  }
}

// ════════════════════════════════════════════════════════════════════
// GET — AP + ŽIVO recompute match (per-line poročilo je NIKOLI stale; kanon #5)
// ════════════════════════════════════════════════════════════════════
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Pariteta AP GET: view_reports (branje poročila, ne write).
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { id } = await params

    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'GET /api/purchase-orders/[id]/invoice',
    })
    if ('error' in scope) return scope.error

    // Cross-tenant → 404 (scoped where na PO).
    const po = await db.purchaseOrder.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
      include: { items: true },
    })
    if (!po) return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })

    const ap = await db.accountsPayable.findFirst({
      where: { purchaseOrderId: id },
      include: {
        lines: { orderBy: { createdAt: 'asc' } },
        supplier: { select: { id: true, name: true, code: true } },
      },
    })

    // Brez AP → { accountsPayable: null, match: null } 200 (klient CTA).
    if (!ap) {
      return NextResponse.json({ accountsPayable: null, match: null })
    }

    // ŽIVO recompute (brez pisanja) — match.lines vsebuje SAMO invoice linije.
    const acceptedMap = await acceptedQtyByPoItem(db, po.items.map(i => i.id))
    const computations: LineComputation[] = ap.lines.map(line => {
      const poItem = po.items.find(i => i.id === line.purchaseOrderItemId) ?? null
      const match = recomputeInvoiceLine({
        poItem,
        quantityInvoiced: toNum(line.quantityInvoiced),
        unitPriceInvoiced: toNum(line.unitPriceInvoiced),
        acceptedQty: line.purchaseOrderItemId ? (acceptedMap.get(line.purchaseOrderItemId) ?? 0) : 0,
        vatRateInvoiced: line.vatRateInvoiced != null ? toNum(line.vatRateInvoiced) : null,
      })
      return {
        poItemId: line.purchaseOrderItemId ?? '',
        poItem,
        description: poItem?.description ?? line.description,
        quantityInvoiced: toNum(line.quantityInvoiced),
        unitPriceInvoiced: toNum(line.unitPriceInvoiced),
        vatRateInvoiced: line.vatRateInvoiced != null ? toNum(line.vatRateInvoiced) : null,
        match,
      }
    })

    const totalOrdered = round3(sumBy(po.items, i => toNum(i.quantityOrdered)))
    const totalInvoiced = round3(sumBy(computations, c => c.quantityInvoiced))
    const { matchStatus } = rollUpStatuses(computations, totalOrdered, totalInvoiced)

    const matchLines = computations.map(c => ({
      poItemId: c.poItemId,
      description: c.description,
      unit: c.poItem?.unit ?? '',
      quantityOrdered: c.poItem ? toNum(c.poItem.quantityOrdered) : 0,
      quantityAccepted: c.match.acceptedQty,
      quantityRejected: c.poItem ? toNum(c.poItem.quantityRejected) : 0,
      quantityInvoiced: c.quantityInvoiced,
      unitPriceOrdered: c.match.priceOrdered,
      unitPriceInvoiced: c.unitPriceInvoiced,
      priceVariancePct: c.match.priceVariancePct,
      vatRateInvoiced: c.match.vatRate,
      lineTotal: c.match.lineTotal,
      varianceStatus: c.match.varianceStatus,
      varianceNote: c.match.varianceNote,
    }))
    const totals = {
      ordered: totalOrdered,
      accepted: round3(sumBy(po.items, i => acceptedMap.get(i.id) ?? 0)),
      invoiced: totalInvoiced,
      priceVarTotal: round2(sumBy(
        computations.filter(c => c.match.priceVar),
        c => multiply(c.unitPriceInvoiced - c.match.priceOrdered, c.quantityInvoiced),
      )),
      qtyVarTotal: round3(sumBy(
        computations.filter(c => c.match.qtyVar),
        c => c.quantityInvoiced - c.match.acceptedQty,
      )),
    }

    return NextResponse.json({
      accountsPayable: deepToNumbers(ap),
      match: {
        matchStatus,
        lines: deepToNumbers(matchLines),
        totals: deepToNumbers(totals),
      },
    })
  } catch (error: unknown) {
    return structuredErrorResponse(error, 'GET /api/purchase-orders/[id]/invoice', 'Napaka pri pridobivanju računa dobavitelja')
  }
}
