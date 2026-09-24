// ============================================
// WASTE LEDGER API — odpad / pokvarjeno / inventurna razlika
// (epic #115 §3, runda 119)
// ============================================
// GET  /api/waste — scoped seznam + pošten summary (realni podatki, NIČ
//                   fabriciranih sample vrstic — prej je UI izmišljal razloge
//                   po modulo in trdo kodiral wasteRate/foodCost!).
// POST /api/waste — zabeleži odpad: atomarno (R106 kanon) odpise zaloge +
//                   StockTransaction('write-off') + WasteRecord; idempotentno
//                   po (locationId, idempotencyKey) — retry ne odpiše dvakrat.
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { resolveWriteLocationId } from '@/lib/tenant-scope'
import { toNum, round2, deepToNumbers, type DecimalLike } from '@/lib/decimal'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { structuredErrorResponse } from '@/lib/structured-error'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { WASTE_REASONS, wasteReasonLabel } from '@/lib/waste-reasons'
import { createWasteRecord } from './_helpers/waste-mutations'

export const dynamic = 'force-dynamic'

const createWasteSchema = z.object({
  inventoryItemId: z.string().min(1, 'Artikel je obvezen').max(100),
  quantity: z
    .number()
    .positive('Količina mora biti pozitivna')
    .max(100000, 'Količina presega limit'),
  reason: z.enum(WASTE_REASONS, { message: 'Neveljaven razlog odpada' }),
  note: z.string().max(1000, 'Opomba je predolga').default(''),
  locationId: z.string().max(100).optional(),
  // R116 kanon: client generira stabilen ključ ob submitu — retry/duplicate
  // submit vrne ISTO vrstico brez sekundarnega odpisa.
  idempotencyKey: z.string().min(1).max(100).optional(),
  // R120 (epic #115 §4): opcijska ciljna serija (lot). Brez nje se odpad
  // razporedi FEFO (First Expired, First Out).
  batchId: z.string().min(1).max(100).optional(),
})

/** Pogoj odpisa, ki je bil uspešno zabeležen (reversal NIKOLI ne briše vrstice). */
interface WasteEntry {
  id: string
  inventoryItemId: string
  itemName: string
  category: string
  quantity: number
  unit: string
  costPerUnit: number
  totalCost: number
  reason: string
  reasonLabel: string
  note: string
  date: string
  recordedBy: string | null
  reversedAt: string | null
  stockTransactionId: string | null
}

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/waste',
    })
    if ('error' in scope) return scope.error

    // Obdobje (default: zadnjih 30 dni) — od tod tudi vse agregacije
    const to = parseDateParam(searchParams.get('to')) ?? new Date()
    const from =
      parseDateParam(searchParams.get('from')) ??
      new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
    const reasonFilter = searchParams.get('reason')
    const itemFilter = searchParams.get('inventoryItemId')

    const records = await db.wasteRecord.findMany({
      where: {
        ...(scope.locationId ? { locationId: scope.locationId } : {}),
        createdAt: { gte: from, lte: to },
        ...(reasonFilter ? { reason: reasonFilter } : {}),
        ...(itemFilter ? { inventoryItemId: itemFilter } : {}),
      },
      include: {
        inventoryItem: { select: { name: true, category: true, unit: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    })

    const entries: WasteEntry[] = records.map(r => ({
      id: r.id,
      inventoryItemId: r.inventoryItemId,
      itemName: r.inventoryItem?.name ?? '(izbrisan artikel)',
      category: r.inventoryItem?.category ?? 'Ostalo',
      quantity: toNum(r.quantity),
      unit: r.unit || r.inventoryItem?.unit || '',
      costPerUnit: toNum(r.costPerUnit),
      totalCost: toNum(r.totalCost),
      reason: r.reason,
      reasonLabel: wasteReasonLabel(r.reason),
      note: r.note,
      date: r.createdAt.toISOString(),
      recordedBy: r.recordedByUserId,
      reversedAt: r.reversedAt ? r.reversedAt.toISOString() : null,
      stockTransactionId: r.stockTransactionId,
    }))

    // ── Summary: SAMO aktivni (ne-razveljavljeni) zapisi ──
    const active = entries.filter(e => !e.reversedAt)
    const totalWasteCost = round2(active.reduce((s, e) => s + e.totalCost, 0))
    const totalWasteItems = round2(active.reduce((s, e) => s + e.quantity, 1e-9))

    const itemCosts: Record<string, number> = {}
    for (const e of active) itemCosts[e.itemName] = (itemCosts[e.itemName] ?? 0) + e.totalCost
    const topWasteItems = Object.entries(itemCosts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, cost]) => ({
        name,
        cost: round2(cost),
        percentage: totalWasteCost > 0 ? Math.round((cost / totalWasteCost) * 100) : 0,
      }))

    const reasonAgg: Record<string, { cost: number; count: number }> = {}
    for (const e of active) {
      const key = wasteReasonLabel(e.reason)
      reasonAgg[key] = reasonAgg[key] ?? { cost: 0, count: 0 }
      reasonAgg[key].cost += e.totalCost
      reasonAgg[key].count += 1
    }
    const wasteByReason = Object.entries(reasonAgg)
      .map(([label, d]) => ({
        reason: label,
        cost: round2(d.cost),
        count: d.count,
        percentage: totalWasteCost > 0 ? Math.round((d.cost / totalWasteCost) * 100) : 0,
      }))
      .sort((a, b) => b.cost - a.cost)

    const categoryAgg: Record<string, { cost: number; count: number }> = {}
    for (const e of active) {
      categoryAgg[e.category] = categoryAgg[e.category] ?? { cost: 0, count: 0 }
      categoryAgg[e.category].cost += e.totalCost
      categoryAgg[e.category].count += 1
    }
    const wasteByCategory = Object.entries(categoryAgg)
      .map(([category, d]) => ({ category, cost: round2(d.cost), count: d.count }))
      .sort((a, b) => b.cost - a.cost)

    const dailyAgg: Record<string, { cost: number; items: number }> = {}
    for (const e of active) {
      const day = e.date.slice(0, 10)
      dailyAgg[day] = dailyAgg[day] ?? { cost: 0, items: 0 }
      dailyAgg[day].cost += e.totalCost
      dailyAgg[day].items += e.quantity
    }
    const dailyWaste = Object.entries(dailyAgg)
      .map(([date, d]) => ({ date, cost: round2(d.cost), items: round2(d.items) }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // ── Pošten source-of-truth metrika: COGS iz StockTransaction('sale') in
    // prihodek iz plačanih Order-ov ISTEGA obdobja/scope-a (prej trdo kodirano!). ──
    const [cogsAgg, revenueAgg] = await Promise.all([
      db.stockTransaction.aggregate({
        _sum: { totalCost: true },
        where: {
          type: 'sale',
          createdAt: { gte: from, lte: to },
          ...(scope.locationId ? { inventoryItem: { locationId: scope.locationId } } : {}),
        },
      }),
      db.order.aggregate({
        _sum: { total: true },
        where: {
          createdAt: { gte: from, lte: to },
          paymentStatus: 'paid',
          ...(scope.locationId ? { locationId: scope.locationId } : {}),
        },
      }),
    ])
    const saleCogs = round2(toNum(cogsAgg._sum.totalCost as DecimalLike))
    const revenue = round2(toNum(revenueAgg._sum.total as DecimalLike))

    const summary = {
      totalWasteCost,
      totalWasteItems,
      topWasteItems,
      wasteByReason,
      wasteByCategory,
      dailyWaste,
      currentWasteRate: saleCogs > 0 ? Math.round((totalWasteCost / saleCogs) * 1000) / 10 : 0,
      foodCostPercentage: revenue > 0 ? Math.round((saleCogs / revenue) * 1000) / 10 : 0,
      saleCogs,
      revenue,
      count: entries.length,
      reversedCount: entries.length - active.length,
    }

    return NextResponse.json({ entries, summary, period: { from: from.toISOString(), to: to.toISOString() } })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/waste', 'Napaka pri pridobivanju odpadkov')
  }
}

export async function POST(req: Request) {
  try {
    // Rate limit — pisalna pot (enaka higiena kot /api/inventory)
    const rl = await checkRateLimitAsync('waste', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    // MODEL A: seja avtoritativna; super-admin MORA podati izrecen locationId
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'POST /api/waste',
    })
    if ('error' in scope) return scope.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(createWasteSchema, bodyResult.data)
    if (validationError) return validationError

    const locRes = resolveWriteLocationId(scope.locationId, data.locationId)
    if (!locRes.ok) return locRes.response
    const locationId = locRes.locationId

    const idempotencyKey = data.idempotencyKey?.trim() || null

    // Fast-path replay (R116 kanon) — pošteno 200 z ISTO vrstico
    if (idempotencyKey) {
      const existing = await db.wasteRecord.findFirst({
        where: { locationId, idempotencyKey },
      })
      if (existing) {
        return NextResponse.json(
          { record: deepToNumbers(existing), replay: true, message: 'Odpad je bil že zabeležen' },
          { status: 200 },
        )
      }
    }

    const result = await createWasteRecord({
      locationId,
      inventoryItemId: data.inventoryItemId,
      quantity: data.quantity,
      reason: data.reason,
      note: data.note,
      idempotencyKey,
      recordedByUserId: authResult.session?.employeeId ?? null,
      batchId: data.batchId ?? null,
    })

    const record = result.record as {
      id: string
      quantity: DecimalLike
      totalCost: DecimalLike
      reason: string
      stockTransactionId: string | null
    }

    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'WASTE_CREATE',
      entityType: 'WasteRecord',
      entityId: record.id,
      details: {
        locationId,
        inventoryItemId: data.inventoryItemId,
        quantity: toNum(record.quantity),
        reason: record.reason,
        reasonLabel: wasteReasonLabel(record.reason),
        totalCost: toNum(record.totalCost),
        stockTransactionId: record.stockTransactionId,
        replay: result.replay,
      },
      locationId,
    })

    return NextResponse.json(
      { record: deepToNumbers(result.record), replay: result.replay },
      { status: 201 },
    )
  } catch (error: unknown) {
    // Idempotency race: dva vzporedna POST-a z istim ključem → unique constraint.
    // 409 + jasen nagovor: ponovitev z ISTIM ključem bo zadela fast-path replay (200).
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Podvojen zapis odpada (sočasen dostop) — ponovite zahtevek z istim idempotencyKey' },
        { status: 409 },
      )
    }
    return structuredErrorResponse(error, 'POST /api/waste', 'Napaka pri zabeležbi odpada')
  }
}

function parseDateParam(raw: string | null): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}
