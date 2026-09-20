// POST /api/accounting/send-report-email — Ročno pošlji Z-report email (za test/cron)
import { db } from '@/lib/db'
import { round2 } from '@/lib/decimal'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { handleApiError } from '@/lib/api-utils'
import { sendZReportEmail, isEmailEnabled, getReportRecipients } from '@/lib/email'
import { fetchReportData, generateReportPdf } from '@/app/api/reports/export/_helpers'


import { formatEUR } from '@/lib/safe-format'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // FIX R86-4 (LOW): tenant scope — prej je fetchReportData potegnil Z-report
    // podatke VSEH lokacij/tenantov in jih poslal v email. Lokovani admin =
    // samo svoja lokacija; super-admin = globalno (fetchReportData podpira
    // locationId od R84).
    const scope = resolveTenantLocationIdOrThrow(
      authResult.session,
      new URL(req.url).searchParams,
      { endpoint: 'POST /api/accounting/send-report-email' },
    )
    if ('error' in scope) return scope.error

    // Preveri ali je email omogočen
    const emailEnabled = await isEmailEnabled()
    if (!emailEnabled) {
      return NextResponse.json(
        { error: 'Email ni konfiguriran. V Nastavitvah omogoči emailEnabled + SMTP nastavitve.' },
        { status: 400 }
      )
    }

    const recipients = await getReportRecipients()
    if (recipients.length === 0) {
      return NextResponse.json(
        { error: 'Ni konfiguriranih prejemnikov. V Nastavitvah dodaj emailReportRecipients.' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(req.url)
    const reportDate = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // Pridobi Z-report podatke za ta dan
    const dateFilter: Record<string, Date> = {
      gte: new Date(reportDate + 'T00:00:00'),
      lte: new Date(reportDate + 'T23:59:59'),
    }
    const reportData = await fetchReportData(dateFilter, scope.locationId)

    // Generiraj PDF
    const pdfBuffer = await generateReportPdf(reportData)

    // Pošlji email
    const summary = {
      totalSales: round2(reportData.summary.totalRevenue),
      totalTax: round2(reportData.summary.totalTax),
      totalOrders: reportData.summary.totalOrders,
    }

    const result = await sendZReportEmail(recipients, reportDate, pdfBuffer, summary)

    // Zabeleži v ScheduledEmailLog
    const log = await db.scheduledEmailLog.create({
      data: {
        reportType: 'z_report',
        recipient: recipients.join(', '),
        subject: `Z-report ${reportDate} — RestaurantOS`,
        body: `Dnevni Z-report: promet ${formatEUR(summary.totalSales)}, DDV ${formatEUR(summary.totalTax)}, naročil ${summary.totalOrders}`,
        attachmentName: `Z-report_${reportDate}.pdf`,
        status: result.success ? 'sent' : 'failed',
        errorMessage: result.error || '',
        sentAt: result.success ? new Date() : null,
        reportDate: new Date(reportDate),
      },
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        logId: log.id,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Z-report poslan na ${recipients.length} prejemnikov`,
      recipients,
      logId: log.id,
      summary,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/accounting/send-report-email', 'Napaka pri pošiljanju Z-report emaila')
  }
}
