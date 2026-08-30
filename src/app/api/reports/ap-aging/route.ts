// GET /api/reports/ap-aging — AP Aging Report
// Vrne obveznosti dobaviteljem (AccountsPayable) razporejene po aging kategorijah:
// 0-30 dni, 31-60 dni, 61-90 dni, 90+ dni.
//
// FIX: Ta endpoint je alias za /api/accounting/accounts-payable z dodatno
// aging agregacijo. Prej je bil 404 — sedaj vrača podatke.
import { db } from '@/lib/db'
import { deepToNumbers, toNum, round2 } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const supplierId = searchParams.get('supplierId')
    const status = searchParams.get('status') || 'open'

    const where: Record<string, unknown> = {}
    if (supplierId) where.supplierId = supplierId
    // Default: prikaži samo odprte/partial obveznosti (ne plačane)
    if (status !== 'all') {
      where.status = { in: ['open', 'partial', 'overdue'] }
    }

    const entries = await db.accountsPayable.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      take: 500,
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        // NOTE: AccountsPayable nima 'purchaseOrder' Prisma relacije
        // (purchaseOrderId je samo FK brez @relation). Vrnemo purchaseOrderId
        // in frontend lahko prikaže ID kot referenco.
      },
    })

    const now = new Date()

    // Aging buckets
    const buckets = {
      current: { count: 0, total: 0, entries: [] as Array<Record<string, unknown>> },    // Še ni zapadlo
      days30: { count: 0, total: 0, entries: [] as Array<Record<string, unknown>> },     // 1-30 dni
      days60: { count: 0, total: 0, entries: [] as Array<Record<string, unknown>> },     // 31-60 dni
      days90: { count: 0, total: 0, entries: [] as Array<Record<string, unknown>> },     // 61-90 dni
      over90: { count: 0, total: 0, entries: [] as Array<Record<string, unknown>> },    // 90+ dni
    }

    let grandTotal = 0
    let totalPaid = 0
    let totalOutstanding = 0

    for (const ap of entries) {
      const total = toNum(ap.totalAmount)
      const paid = toNum(ap.paidAmount)
      const outstanding = round2(total - paid)
      const daysOverdue = Math.floor((now.getTime() - new Date(ap.dueDate).getTime()) / (1000 * 60 * 60 * 24))

      grandTotal += total
      totalPaid += paid
      totalOutstanding += outstanding

      const entry = {
        ...deepToNumbers(ap),
        outstandingAmount: outstanding,
        daysOverdue,
      }

      if (daysOverdue < 0) {
        buckets.current.count++
        buckets.current.total += outstanding
        buckets.current.entries.push(entry)
      } else if (daysOverdue <= 30) {
        buckets.days30.count++
        buckets.days30.total += outstanding
        buckets.days30.entries.push(entry)
      } else if (daysOverdue <= 60) {
        buckets.days60.count++
        buckets.days60.total += outstanding
        buckets.days60.entries.push(entry)
      } else if (daysOverdue <= 90) {
        buckets.days90.count++
        buckets.days90.total += outstanding
        buckets.days90.entries.push(entry)
      } else {
        buckets.over90.count++
        buckets.over90.total += outstanding
        buckets.over90.entries.push(entry)
      }
    }

    // Zaokroži totals
    buckets.current.total = round2(buckets.current.total)
    buckets.days30.total = round2(buckets.days30.total)
    buckets.days60.total = round2(buckets.days60.total)
    buckets.days90.total = round2(buckets.days90.total)
    buckets.over90.total = round2(buckets.over90.total)

    return NextResponse.json({
      summary: {
        totalEntries: entries.length,
        grandTotal: round2(grandTotal),
        totalPaid: round2(totalPaid),
        totalOutstanding: round2(totalOutstanding),
      },
      aging: {
        current: { ...buckets.current, total: buckets.current.total },
        '0-30': { ...buckets.days30, total: buckets.days30.total },
        '31-60': { ...buckets.days60, total: buckets.days60.total },
        '61-90': { ...buckets.days90, total: buckets.days90.total },
        '90+': { ...buckets.over90, total: buckets.over90.total },
      },
      entries: entries.length > 0 ? deepToNumbers(entries) : [],
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/reports/ap-aging', 'Napaka pri pridobivanju AP aging poročila')
  }
}
