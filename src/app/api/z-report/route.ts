import { logger } from "@/lib/logger"
// ============================================
// Z-REPORT API — Dnevni zaključek (End of Day)
// Toast POS + Square standard
// Avtomatsko generiranje Z-poročila iz podatkov
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { sendZReportEmail, isEmailEnabled, getReportRecipients } from '@/lib/email'
import { fetchReportData, generateReportPdf } from '@/app/api/reports/export/_helpers'
import { round2, deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationId, tenantScopeToWhere } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, handleRouteError, validateRequest } from '@/lib/api-utils'
import { ljubljanaDayBounds } from '@/lib/timezone-sl'
import { calculateReportStats, buildReportData, upsertZReportForDay } from './_helpers'
// OPOMBA runda 9: jedro (preverjanje + izračun + upsert) je sedaj v
// ./_helpers/upsert-z-report.ts, da ga ponovno uporabi tudi avtomatski
// osnutek ob zaprtju blagajniške izmene (cash-register/[id]).
void calculateReportStats
void buildReportData


import { formatEUR } from '@/lib/safe-format'
const generateZReportSchema = z.object({
  date: z.string().min(1, 'Datum je obvezen').max(30, 'Neveljaven format datuma'),
  locationId: z.string().max(100, 'ID lokacije je predolg').optional(),
  actualCash: z.number().min(0, 'Znesek ne more biti negativen').max(9999999, 'Znesek je previsok').default(0),
  notes: z.string().max(1000, 'Opombe ne smejo preseči 1000 znakov').default(''),
  finalize: z.boolean().default(false),
})

// GET — Pridobi Z-poročila
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // FIX Bug #3 (HIGH): IDOR — natakar ne sme videti Z-reportov
    // Prej: view_reports (ki ga ima natakar) — sedaj: manage_cash
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const status = searchParams.get('status')

    // FIX P0-C2: Centralni tenant scope resolver — fail-closed, no ?locationId bypass
    const scope = resolveTenantLocationId(authResult.session, searchParams, {
      endpoint: 'GET /api/z-report',
    })
    if (!scope.ok) return scope.error

    const where: Record<string, unknown> = {
      ...tenantScopeToWhere(scope),
    }
    if (date) {
      // P2-UX FIX (timezone): meje ljubljanskega dne — prej strežniški TZ (UTC deploy = zamaknjeno 1–2 h)
      const { start, end } = ljubljanaDayBounds(date)
      where.reportDate = { gte: start, lt: end }
    }
    if (status) where.status = status

    const reports = await db.zReport.findMany({
      where,
      orderBy: { reportDate: 'desc' },
      take: 30,
    })

    return NextResponse.json(deepToNumbers(reports))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/z-report', 'Napaka pri pridobivanju Z-poročil')
  }
}

// POST — Generiraj Z-poročilo za dan
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const { data, error: validationError } = await validateRequest(req, generateZReportSchema)
    if (validationError) return validationError

    const { date, locationId: bodyLocationId, actualCash, notes, finalize } = data

    // FIX P0-C2: Body locationId je dovoljen samo za admin/super_admin.
    // Regular user: ignoriraj body locationId, uporabi session.locationId (avtoritativen).
    // Admin brez session.locationId (super admin): lahko uporabi body locationId.
    // Admin z session.locationId: uporabi session.locationId (admin restricted to location).
    const sessionLocationId = authResult.session?.locationId ?? null
    const isAdmin = authResult.session?.role === 'admin' || authResult.session?.role === 'super_admin'
    const effectiveLocationId = sessionLocationId ?? (isAdmin ? bodyLocationId : null)
    // Fail-closed: regular user brez session.locationId = data integrity issue
    if (!sessionLocationId && !isAdmin) {
      return NextResponse.json(
        { error: 'Vaš račun nima dodeljene lokacije. Kontaktirajte administratorja.' },
        { status: 403 },
      )
    }
    const locationId = effectiveLocationId ?? undefined

    // RUNDA 9 REFAKTOR: celotno jedro (preverjanje finalized, open-shifts check,
    // pridobivanje orderjev, statistike, upsert transakcija) je v upsertZReportForDay.
    const { report, stats, paidOrdersCount } = await upsertZReportForDay({
      date,
      locationId,
      actualCash,
      notes,
      finalize,
      employeeId: authResult.session?.employeeId ?? null,
    })

    // Audit log
    // P2-UX FIX (timezone): datum je string 'YYYY-MM-DD' (ljubljanski dan) —
    // prikaz v audit logu brez new Date() konverzije (prej spremenljivka d)
    await createAuditLog({
      action: finalize ? 'z_report_finalized' : 'z_report_generated',
      entityType: 'z_report',
      details: { date, totalSales: stats.totalSales, message: `Z-poročilo za ${date}: ${formatEUR(round2(stats.totalSales))}` },
      userId: authResult.session?.employeeId,
    })

    // FIX F5-6: Avtomatsko pošlji Z-report email ob finalize (če je email omogočen)
    if (finalize) {
      try {
        const emailEnabled = await isEmailEnabled()
        if (emailEnabled) {
          // FIX P0-C3B: Pridobi prejemnike za PRAVO lokacijo (ne global)
          const recipients = await getReportRecipients(locationId || null)
          if (recipients.length > 0) {
            // P2-UX FIX (timezone): meje ljubljanskega dne (ne UTC polnoč)
            const { start: emailDayStart, end: emailDayEnd } = ljubljanaDayBounds(date)
            const dateFilter = { gte: emailDayStart, lte: emailDayEnd }
            const reportData = await fetchReportData(dateFilter)
            const pdfBuffer = await generateReportPdf(reportData)
            await sendZReportEmail(recipients, date, pdfBuffer, {
              totalSales: round2(stats.totalSales),
              totalTax: round2(stats.totalTax),
              totalOrders: paidOrdersCount,
            })
          }
        }
      } catch (emailErr) {
        logger.error("CONSOLE", '[Z-Report] Email pošiljanje spodletelo:', emailErr)
      }
    }

    return NextResponse.json(deepToNumbers(report), { status: report.createdAt ? 200 : 201 })
  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/z-report', [
      { match: 'Z_REPORT_FINALIZED', message: 'Z-poročilo za ta dan je že zaključeno', status: 400 },
      // QA runda 36: admin brez dodeljene lokacije + brez lokacij v DB
      { match: 'Z_REPORT_NO_LOCATION', message: 'Ni mogoče določiti lokacije za Z-poročilo. Dodelite lokacijo zaposlenemu ali ustvarite lokacijo v nastavitvah.', status: 400 },
      // RUNDA 9: open-shifts check se sedaj zgodi v upsertZReportForDay
      // (matchBusinessError: 'message' je statični string; število odprtih izmen
      //  gre v extra.openShifts — klijent ga lahko prikaže posebej)
      { match: 'OPEN_SHIFTS', message: 'Obstajajo odprte blagajniške izmene. Zaprite vse izmene preden finalizirate Z-poročilo.', status: 400, extra: (parts) => ({ openShifts: parseInt(parts[1]) || 0 }) },
    ], 'Napaka pri generiranju Z-poročila')
  }
}
