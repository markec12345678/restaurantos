// ============================================
// EXPENSE TRACKER API — Sledenje stroškov
// Toast POS + Restaurant365 standard
// ============================================

// FIX MEDIUM: Zod validacija za stroške — prepreči injection in negativne zneske
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { resolveWriteLocationId } from '@/lib/tenant-scope'
import { round2, toNum, type DecimalLike } from '@/lib/decimal'
import { z } from 'zod'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'

const createExpenseSchema = z.object({
  category: z.enum(['food', 'beverage', 'labor', 'rent', 'utilities', 'marketing', 'maintenance', 'supplies', 'insurance', 'other'], {
    message: 'Neveljavna kategorija stroška',
  }),
  description: z.string().min(1, 'Opis je obvezen').max(500),
  amount: z.number().positive('Znesek mora biti pozitiven').max(1000000, 'Znesek presega limit'),
  vendor: z.string().max(200).default(''),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'other']).default('cash'),
  locationId: z.string().max(100).optional(),
  recurring: z.boolean().default(false),
  receipt: z.string().max(2000).default(''),
})

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'month'
    const category = searchParams.get('category')

    const now = new Date()
    let startDate = new Date(now.getFullYear(), now.getMonth(), 1)

    if (period === 'today') {
      startDate = new Date(now)
      startDate.setHours(0, 0, 0, 0)
    } else if (period === 'week') {
      startDate = new Date(now)
      startDate.setDate(now.getDate() - 7)
      startDate.setHours(0, 0, 0, 0)
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1)
    }

    // FIX R85-FINAL (HIGH): Tenant scope — prej je GET agregiral stroške VSEH
    // lokacij (AuditLog.locationId obstaja od R81, sorodni /api/audit ga že
    // filtrira). Fail-closed; super-admin (null) = globalni pogled.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/expenses',
    })
    if ('error' in scope) return scope.error

    const expenses = await db.auditLog.findMany({
      where: {
        entityType: 'Expense',
        timestamp: { gte: startDate },
        ...(scope.locationId ? { locationId: scope.locationId } : {}),
        ...(category ? { action: `EXPENSE_${category.toUpperCase()}` } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: 200,
    })

    const parseDetails = (d: unknown): Record<string, unknown> => {
      if (typeof d === 'string') { try { return JSON.parse(d) } catch { return {} } }
      return (d as Record<string, unknown>) || {}
    }

    const formattedExpenses = expenses.map(e => {
      const details = parseDetails(e.details)
      return {
        id: e.id,
        category: (details.category as string) || 'other',
        description: (details.description as string) || '',
        amount: toNum(details.amount as DecimalLike),
        date: e.timestamp,
        vendor: (details.vendor as string) || '',
        paymentMethod: (details.paymentMethod as string) || 'cash',
        locationId: (details.locationId as string) || null,
        recurring: (details.recurring as boolean) || false,
        receipt: (details.receipt as string) || '',
      }
    })

    const byCategory: Record<string, { total: number; count: number }> = {}
    for (const exp of formattedExpenses) {
      if (!byCategory[exp.category]) byCategory[exp.category] = { total: 0, count: 0 }
      byCategory[exp.category].total = round2(byCategory[exp.category].total + exp.amount)
      byCategory[exp.category].count += 1
    }

    const totalExpenses = round2(formattedExpenses.reduce((sum, e) => sum + e.amount, 0))
    const recurringExpenses = round2(formattedExpenses.filter(e => e.recurring).reduce((sum, e) => sum + e.amount, 0))

    return NextResponse.json({
      expenses: formattedExpenses,
      stats: { totalExpenses, recurringExpenses, byCategory, count: formattedExpenses.length },
      period,
      startDate,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/expenses', 'Napaka pri pridobivanju stroškov')
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    // FIX R85-FINAL (HIGH): Tenant scope — body locationId je prej bil zapisan
    // le v details JSON (AuditLog.locationId stolpec je izpeljan iz zaposlenega)
    // in ničesar ni omejeval. Zdaj je lokacija stroška izpeljana iz seje
    // (MODEL A resolveWriteLocationId): lokacijski uporabnik ne more žigosati
    // tuje lokacije; super-admin MORA podati izrecen locationId (fail-closed 400).
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'POST /api/expenses',
    })
    if ('error' in scope) return scope.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX MEDIUM: Zod validacija z validateBody helperjem
    const { data, error: validationError } = validateBody(createExpenseSchema, bodyResult.data)
    if (validationError) return validationError
    const { category, description, amount, vendor, paymentMethod, locationId, recurring, receipt } = data

    const locRes = resolveWriteLocationId(scope.locationId, locationId)
    if (!locRes.ok) return locRes.response
    const expenseLocationId = locRes.locationId

    await createAuditLog({
      action: `EXPENSE_${category.toUpperCase()}`,
      entityType: 'Expense',
      details: {
        category, description, amount: round2(amount),
        vendor: vendor || '', paymentMethod: paymentMethod || 'cash',
        locationId: expenseLocationId, recurring: recurring || false, receipt: receipt || '',
      } as Record<string, unknown>,
      userId: authResult.session?.employeeId,
      // FIX R85-FINAL: stolpec locationId = žigosana lokacija (dobri podrob.
      // details.locationId) — omogoča tenant-scoped GET zgoraj
      locationId: expenseLocationId,
    })

    return NextResponse.json({ success: true, message: 'Strošek uspešno dodan' }, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/expenses', 'Napaka pri dodajanju stroška')
  }
}
