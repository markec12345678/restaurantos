// ============================================
// POST /api/scheduled-emails/create — Ustvari scheduled email (kliče se ob EOD)
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { isEmailEnabled, getReportRecipients } from '@/lib/email'

export const dynamic = 'force-dynamic'

const createScheduledEmailSchema = z.object({
  reportType: z.enum(['z_report', 'daily_summary', 'weekly_summary', 'vat_report']).default('z_report'),
  reportDate: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error } = createScheduledEmailSchema.safeParse(bodyResult.data)
    if (error) {
      return NextResponse.json({ error: 'Neveljavni podatki', validationErrors: error.issues }, { status: 400 })
    }

    const emailEnabled = await isEmailEnabled()
    if (!emailEnabled) {
      return NextResponse.json(
        { error: 'Email ni konfiguriran. Omogoči emailEnabled + SMTP v nastavitvah.' },
        { status: 400 }
      )
    }

    const recipients = await getReportRecipients()
    if (recipients.length === 0) {
      return NextResponse.json(
        { error: 'Ni konfiguriranih prejemnikov. Dodaj emailReportRecipients v nastavitvah.' },
        { status: 400 }
      )
    }

    const reportDate = data.reportDate ? new Date(data.reportDate) : new Date()
    const dateStr = reportDate.toISOString().split('T')[0]

    // Preveri ali že obstaja pending/sent email za ta datum in tip
    const existing = await db.scheduledEmailLog.findFirst({
      where: {
        reportType: data.reportType,
        reportDate: {
          gte: new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate(), 0, 0, 0),
          lte: new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate(), 23, 59, 59),
        } as never,
        status: { in: ['pending', 'sent'] },
      },
    })

    if (existing) {
      return NextResponse.json(
        { message: `Email za ${data.reportType} ${dateStr} je že ${existing.status}`, existing: existing.id },
        { status: 409 }
      )
    }

    // Ustvari ScheduledEmailLog za vsakega prejemnika
    const created: unknown[] = []
    for (const recipient of recipients) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const log = await (db.scheduledEmailLog as any).create({
        data: {
          reportType: data.reportType,
          recipient,
          subject: `${data.reportType === 'z_report' ? 'Z-poročilo' : 'Poročilo'} — ${dateStr}`,
          body: `Avtomatsko generirano ${data.reportType} poročilo za ${dateStr}.`,
          attachmentName: `${data.reportType}_${dateStr}.pdf`,
          status: 'pending',
          reportDate,
        },
      })
      created.push(log as unknown)
    }

    logger.info('EMAIL', `Ustvarjenih ${created.length} scheduled emailov za ${dateStr} (${data.reportType})`)

    return NextResponse.json({
      success: true,
      message: `Ustvarjenih ${created.length} scheduled emailov`,
      created: created.length,
      recipients,
      reportDate: dateStr,
      reportType: data.reportType,
    }, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/scheduled-emails/create', 'Napaka pri ustvarjanju scheduled emaila')
  }
}
