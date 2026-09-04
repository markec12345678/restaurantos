// ============================================
// POST /api/scheduled-emails/process — Obdelaj čakajoča email poročila
// ============================================
// Ta API se pokliče iz cron job-a (npr. vsakih 15 minut).
// Preveri ScheduledEmailLog z status='pending' in jih pošlje.
//
// Za cron: v Linux dodaj crontab:
//   */15 * * * * curl -X POST https://tvoj-domena.com/api/scheduled-emails/process \
//     -H "Authorization: Bearer $WS_BROADCAST_SECRET"
//
// Za Vercel: uporabi Vercel Cron Jobs (vercel.json):
//   { "crons": [{ "path": "/api/scheduled-emails/process", "schedule": "*/15 * * * *" }] }
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api-utils'
import { isEmailEnabled, getReportRecipients, sendZReportEmail } from '@/lib/email'
import { fetchReportData, generateReportPdf } from '@/app/api/reports/export/_helpers'
import { round2 } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // FIX AUD-13: Vercel Cron pošlje Authorization: Bearer $CRON_SECRET
    // Poleg tega podpira tudi običajni Bearer token (za ročne klice)
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || process.env.WS_BROADCAST_SECRET || ''
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      // Vercel Cron avtentikacija — dovoli nadaljevanje
    } else {
      // Običajna avtentikacija
      const authResult = await requireAuth(req)
      if (authResult.error) return authResult.error
    }

    // Preveri ali je email omogočen
    const emailEnabled = await isEmailEnabled()
    if (!emailEnabled) {
      return NextResponse.json({ message: 'Email ni konfiguriran — preskakujem', processed: 0 })
    }

    const recipients = await getReportRecipients()
    if (recipients.length === 0) {
      return NextResponse.json({ message: 'Ni prejemnikov — preskakujem', processed: 0 })
    }

    // Pridobi vse pending email loge (starejše od 1 minute, da se izognemo race condition)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
    const pendingEmails = await db.scheduledEmailLog.findMany({
      where: {
        status: 'pending',
        createdAt: { lt: oneMinuteAgo },
      },
      orderBy: { createdAt: 'asc' },
      take: 20, // Največ 20 na klic (batch processing)
    })

    if (pendingEmails.length === 0) {
      return NextResponse.json({ message: 'Ni čakajočih emailov', processed: 0 })
    }

    let successCount = 0
    let failCount = 0

    for (const emailLog of pendingEmails) {
      try {
        // Generiraj PDF poročilo za ta datum
        const reportDate = emailLog.reportDate || new Date()
        const dateFilter: Record<string, Date> = {
          gte: new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate(), 0, 0, 0),
          lte: new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate(), 23, 59, 59),
        }

        const data = await fetchReportData(dateFilter)
        const pdfBuffer = await generateReportPdf(data)

        // Pošlji email — uporabi pravilen sendZReportEmail signature
        await sendZReportEmail(
          recipients,
          reportDate.toISOString().split('T')[0],
          pdfBuffer,
          {
            totalSales: round2(data.summary.totalRevenue),
            totalTax: round2(data.summary.totalTax),
            totalOrders: data.summary.totalOrders,
          }
        )

        // Označi kot poslano
        await db.scheduledEmailLog.update({
          where: { id: emailLog.id },
          data: {
            status: 'sent',
            sentAt: new Date(),
          },
        })

        successCount++
        logger.info('EMAIL', `Poslan scheduled email ${emailLog.id} (${emailLog.reportType}) na ${emailLog.recipient}`)
      } catch (err: unknown) {
        // Označi kot neuspešno
        await db.scheduledEmailLog.update({
          where: { id: emailLog.id },
          data: {
            status: 'failed',
            errorMessage: err instanceof Error ? err.message : 'Neznana napaka',
          },
        })

        failCount++
        logger.error('EMAIL', `Napaka pri pošiljanju scheduled email-a ${emailLog.id}:`, err)
      }
    }

    return NextResponse.json({
      processed: pendingEmails.length,
      success: successCount,
      failed: failCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/scheduled-emails/process', 'Napaka pri obdelavi scheduled emailov')
  }
}

// GET — preveri stanje scheduled emailov (za admin dashboard)
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const [pending, sentToday, failedToday] = await Promise.all([
      db.scheduledEmailLog.count({ where: { status: 'pending' } }),
      db.scheduledEmailLog.count({
        where: {
          status: 'sent',
          sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      db.scheduledEmailLog.count({
        where: {
          status: 'failed',
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ])

    const recentLogs = await db.scheduledEmailLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({
      stats: { pending, sentToday, failedToday },
      recent: recentLogs,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/scheduled-emails/process', 'Napaka pri pridobivanju stanja')
  }
}
