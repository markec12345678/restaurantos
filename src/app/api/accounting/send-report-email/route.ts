// POST /api/accounting/send-report-email — Ročno pošlji Z-report email (za test/cron)
import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { sendZReportEmail, isEmailEnabled, getReportRecipients } from '@/lib/email'
import { fetchReportData, generateReportPdf } from '@/app/api/reports/export/_helpers'

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

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
    const reportData = await fetchReportData(dateFilter)

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
        body: `Dnevni Z-report: promet €${summary.totalSales.toFixed(2)}, DDV €${summary.totalTax.toFixed(2)}, naročil ${summary.totalOrders}`,
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
