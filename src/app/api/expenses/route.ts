// ============================================
// EXPENSE TRACKER API — Sledenje stroškov
// Toast POS + Restaurant365 standard
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

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

    const expenses = await db.auditLog.findMany({
      where: {
        entityType: 'Expense',
        timestamp: { gte: startDate },
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
        amount: (details.amount as number) || 0,
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
      byCategory[exp.category].total += exp.amount
      byCategory[exp.category].count += 1
    }

    const totalExpenses = formattedExpenses.reduce((sum, e) => sum + e.amount, 0)
    const recurringExpenses = formattedExpenses.filter(e => e.recurring).reduce((sum, e) => sum + e.amount, 0)

    return NextResponse.json({
      expenses: formattedExpenses,
      stats: { totalExpenses, recurringExpenses, byCategory, count: formattedExpenses.length },
      period,
      startDate,
    })
  } catch (error) {
    console.error('[EXPENSES GET]', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju stroškov' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const body = await req.json()
    const { category, description, amount, vendor, paymentMethod, locationId, recurring, receipt } = body

    if (!category || !description || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Manjkajoči podatki: category, description, amount' }, { status: 400 })
    }

    await createAuditLog({
      action: `EXPENSE_${category.toUpperCase()}`,
      entityType: 'Expense',
      details: {
        category, description, amount: parseFloat(amount),
        vendor: vendor || '', paymentMethod: paymentMethod || 'cash',
        locationId: locationId || null, recurring: recurring || false, receipt: receipt || '',
      } as Record<string, unknown>,
      userId: authResult.session?.employeeId,
    })

    return NextResponse.json({ success: true, message: 'Strošek uspešno dodan' }, { status: 201 })
  } catch (error) {
    console.error('[EXPENSES POST]', error)
    return NextResponse.json({ error: 'Napaka pri dodajanju stroška' }, { status: 500 })
  }
}
