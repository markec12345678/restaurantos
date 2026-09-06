// ============================================
// GET /api/gdpr/export/[employeeId] — GDPR Right to Access (Article 15)
// ============================================
// Vrne VSE osebne podatke, ki jih imamo o zaposlenem:
//   - Osebni podatki (ime, email, telefon, PIN status)
//   - Zaposlitveni podatki (job, pay rate, hire date)
//   - Izmen in časovni vnosi
//   - Naročila, ki jih je ustvaril
//   - Plačila, ki jih je procesiral
//   - Napitnine (tip distributions)
//   - Audit log vnosi
//
// Pravica do vpogleda v podatke (GDPR čl. 15):
//   Uporabnik ima pravico dobiti potrdilo, ali se njegovi osebni
//   podatki obdelujejo, in če se, pravico do vpogleda v te podatke.
//
// Avtentikacija: Admin ali uporabnik sam (za svoje podatke)
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { toNum, deepToNumbers } from '@/lib/decimal'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX GDPR: Uporabnik lahko dostopa do svojih podatkov ALI admin do vseh
    const isSelf = authResult.session?.employeeId === employeeId
    const isAdmin = authResult.session?.role === 'admin'
    if (!isSelf && !isAdmin) {
      return NextResponse.json(
        { error: 'Nimate dovoljenja za dostop do teh podatkov' },
        { status: 403 }
      )
    }

    // ─── 1. Osebni podatki ─────────────────────────────────────
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        hireDate: true,
        locationId: true,
        createdAt: true,
        updatedAt: true,
        // PIN ne vračamo v plain textu — samo status (hashed ali empty)
        pin: false,
        // pinLookup ne vračamo (HMAC hash — lahko bi ga napadalec zlorabil)
        jobs: {
          include: {
            job: {
              select: { id: true, name: true, code: true, permissions: true }
            }
          }
        },
      },
    })

    if (!employee) {
      return NextResponse.json(
        { error: 'Zaposleni ni najden' },
        { status: 404 }
      )
    }

    // ─── 2. Izmen in časovni vnosi (zadnjih 12 mesecev) ───────
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const [shifts, timeEntries] = await Promise.all([
      db.shift.findMany({
        where: { employeeId, date: { gte: twelveMonthsAgo } },
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          status: true,
          breakMinutes: true,
          createdAt: true,
        },
        orderBy: { date: 'desc' },
        take: 365, // zadnje leto
      }),
      db.timeEntry.findMany({
        where: { employeeId, clockIn: { gte: twelveMonthsAgo } },
        select: {
          id: true,
          clockIn: true,
          clockOut: true,
          totalMinutes: true,
          createdAt: true,
        },
        orderBy: { clockIn: 'desc' },
        take: 365,
      }),
    ])

    // ─── 3. Naročila, ki jih je ustvaril (zadnjih 12 mesecev) ─
    const orders = await db.order.findMany({
      where: { employeeId, createdAt: { gte: twelveMonthsAgo } },
      select: {
        id: true,
        orderNumber: true,
        type: true,
        status: true,
        total: true,
        tip: true,
        paymentStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    })

    // ─── 4. Plačila, ki jih je procesiral ──────────────────────
    const payments = await db.payment.findMany({
      where: { employeeId, createdAt: { gte: twelveMonthsAgo } },
      select: {
        id: true,
        amount: true,
        tipAmount: true,
        type: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    })

    // ─── 5. Napitnine (tip distributions) ─────────────────────
    const tipDistributions = await db.tipDistribution.findMany({
      where: { employeeId },
      select: {
        id: true,
        amount: true,
        hoursWorked: true,
        points: true,
        status: true,
        paidAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    // ─── 6. Audit log vnosi (zadnjih 90 dni) ──────────────────
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const auditLogs = await db.auditLog.findMany({
      where: { userId: employeeId, timestamp: { gte: ninetyDaysAgo } },
      select: {
        action: true,
        entityType: true,
        entityId: true,
        timestamp: true,
        ipAddress: true,
        terminalId: true,
      },
      orderBy: { timestamp: 'desc' },
      take: 500,
    })

    // ─── 7. Seje (aktivne in zadnje) ──────────────────────────
    const sessions = await db.session.findMany({
      where: { employeeId },
      select: {
        createdAt: true,
        expiresAt: true,
        absoluteExpiry: true,
        ipAddress: true,
        userAgent: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    // ─── 8. Povzetek ──────────────────────────────────────────
    const summary = {
      employee: {
        ...employee,
        pinStatus: 'hashed' as const, // ne razkrivamo dejanskega PIN-a
      },
      dataPoints: {
        shifts: shifts.length,
        timeEntries: timeEntries.length,
        orders: orders.length,
        payments: payments.length,
        tipDistributions: tipDistributions.length,
        auditLogs: auditLogs.length,
        sessions: sessions.length,
      },
      totals: {
        totalOrdersValue: toNum(orders.reduce((sum, o) => sum + toNum(o.total), 0)),
        totalTipsEarned: toNum(tipDistributions.reduce((sum, t) => sum + toNum(t.amount), 0)),
        totalPaymentsProcessed: toNum(payments.reduce((sum, p) => sum + toNum(p.amount), 0)),
        totalMinutesWorked: toNum(timeEntries.reduce((sum, t) => sum + toNum(t.totalMinutes || 0), 0)),
      },
      recentActivity: {
        shifts,
        timeEntries,
        orders,
        payments,
        tipDistributions,
        auditLogs,
        sessions,
      },
    }

    // ─── 9. Log dostopa (GDPR zahteva sledenje dostopov) ─────
    // Audit log fail ne sme preprečiti data export
    try {
      await db.auditLog.create({
        data: {
          action: 'GDPR_DATA_EXPORT',
          entityType: 'Employee',
          entityId: employeeId,
          userId: authResult.session?.employeeId,
          details: JSON.stringify({
            requestedBy: authResult.session?.employeeId,
            isSelf,
            isAdmin,
            dataPoints: summary.dataPoints,
          }),
        },
      })
    } catch {
      // Audit log fail — ne blokiraj export-a
    }

    // Vrni kot JSON (lahko se pretvori v PDF/CSV v prihodnosti)
    return NextResponse.json({
      gdpr: 'Article 15 — Right of Access',
      exportedAt: new Date().toISOString(),
      data: deepToNumbers(summary),
    }, {
      headers: {
        'Content-Disposition': `attachment; filename="gdpr-export-${employeeId}-${Date.now()}.json"`,
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/gdpr/export/[employeeId]', 'Napaka pri GDPR izvozu podatkov')
  }
}
