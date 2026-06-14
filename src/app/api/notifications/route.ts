// ============================================
// NOTIFICATION SYSTEM API — Obvestila za stranke in osebje
// SMS/Email za rezervacije, naročila, dostave
// Toast POS + SevenRooms standard
// ============================================
// Zod validacijska shema za pošiljanje obvestila
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'
const sendNotificationSchema = z.object({
  channel: z.enum(['sms', 'email', 'push'], { message: 'Kanal mora biti sms, email ali push' }),
  recipient: z.string().min(1, 'Prejemnik je obvezen').max(200, 'Prejemnik ne sme preseči 200 znakov'),
  subject: z.string().max(200, 'Zadeva ne sme preseči 200 znakov').default(''),
  message: z.string().min(1, 'Sporočilo je obvezno').max(5000, 'Sporočilo ne sme preseči 5000 znakov'),
  entityType: z.string().max(100, 'Tip entitete ne sme preseči 100 znakov').optional(),
  entityId: z.string().max(100, 'ID entitete ne sme preseči 100 znakov').optional(),
})
// Zod validacijska shema za množično pošiljanje
const batchNotificationItemSchema = z.object({
  channel: z.enum(['sms', 'email', 'push'], { message: 'Kanal mora biti sms, email ali push' }),
  recipient: z.string().min(1, 'Prejemnik je obvezen').max(200, 'Prejemnik ne sme preseči 200 znakov'),
  subject: z.string().max(200, 'Zadeva ne sme preseči 200 znakov').default(''),
  message: z.string().min(1, 'Sporočilo je obvezno').max(5000, 'Sporočilo ne sme preseči 5000 znakov'),
})
const sendBatchSchema = z.object({
  notifications: z.array(batchNotificationItemSchema).min(1, 'Seznam obvestil je prazen').max(100, 'Največ 100 obvestil naenkrat'),
})
// ============================================
// GET — Pridobi obvestila
// ============================================
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'all' // all, pending, sent, failed
    const rawLimit = parseInt(searchParams.get('limit') || '50')
    const limit = Math.min(Number.isNaN(rawLimit) ? 50 : rawLimit, 200)
    // Pridobi nedavne obvestila iz audit loga
    const where: Record<string, unknown> = {
      action: { in: ['NOTIFICATION_SENT', 'NOTIFICATION_FAILED', 'NOTIFICATION_QUEUED'] },
    }
    if (status !== 'all') {
      where.action = status === 'sent' ? 'NOTIFICATION_SENT' : status === 'failed' ? 'NOTIFICATION_FAILED' : 'NOTIFICATION_QUEUED'
    }
    const notifications = await db.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
    })
    // Statistika — OPTIMIZACIJA: groupBy namesto findMany + JS filter
    // Pridobi samo agrecirane podatke, ne nalagaj vseh zapisov v pomnilnik
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [sentCount, failedCount, byActionAndChannel] = await Promise.all([
      db.auditLog.count({
        where: {
          action: 'NOTIFICATION_SENT',
          timestamp: { gte: today },
        },
      }),
      db.auditLog.count({
        where: {
          action: 'NOTIFICATION_FAILED',
          timestamp: { gte: today },
        },
      }),
      // Ne moremo groupBy po details.channel (JSON polje) — uporabimo
      // findMany z select, da minimiziramo podatke, nato preštejemo v JS
      db.auditLog.findMany({
        where: {
          action: { in: ['NOTIFICATION_SENT', 'NOTIFICATION_FAILED'] },
          timestamp: { gte: today },
        },
        select: { details: true },
      }),
    ])

    const parseDetails = (d: unknown): Record<string, unknown> => {
      if (typeof d === 'string') {
        try { return JSON.parse(d) } catch { return {} }
      }
      return (d as Record<string, unknown>) || {}
    }

    // Preštej po kanalu iz details JSON — minimiziran nabor podatkov
    let smsCount = 0
    let emailCount = 0
    let pushCount = 0
    for (const n of byActionAndChannel) {
      const channel = parseDetails(n.details).channel
      if (channel === 'sms') smsCount++
      else if (channel === 'email') emailCount++
      else if (channel === 'push') pushCount++
    }

    const stats = {
      totalSent: sentCount,
      totalFailed: failedCount,
      byType: { sms: smsCount, email: emailCount, push: pushCount },
    }
    return NextResponse.json({ notifications, stats })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/notifications', 'Napaka pri pridobivanju obvestil')
  }
}
// ============================================
// POST — Pošlji obvestilo
// ============================================
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    const { data, error: validationError } = await validateRequest(req, sendNotificationSchema)
    if (validationError) return validationError
    const { channel, recipient, subject, entityType, entityId } = data
    // Simulacija pošiljanja (v produkciji bi uporabili Twilio/SendGrid)
    let success = true
    let providerId = ''
    try {
      if (channel === 'sms') {
        providerId = `sms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      } else if (channel === 'email') {
        providerId = `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      } else if (channel === 'push') {
        providerId = `push_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      }
    } catch {
      success = false
    }
    await createAuditLog({
      action: success ? 'NOTIFICATION_SENT' : 'NOTIFICATION_FAILED',
      entityType: entityType || 'Notification',
      entityId: entityId || undefined,
      details: {
        channel,
        recipient,
        subject,
        providerId,
        success,
      } as Record<string, unknown>,
      userId: authResult.session?.employeeId,
    })
    return NextResponse.json({
      success,
      providerId,
      channel,
      recipient,
      message: success ? 'Obvestilo uspešno poslano' : 'Pošiljanje obvestila ni uspelo',
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/notifications', 'Napaka pri pošiljanju obvestila')
  }
}
// ============================================
// PUT /send-batch — Množično pošiljanje
// ============================================
export async function PUT(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error
    const { data, error: validationError } = await validateRequest(req, sendBatchSchema)
    if (validationError) return validationError
    const { notifications } = data
    const results: Array<{ recipient: string; channel: string; success: boolean; providerId: string }> = []
    for (const notif of notifications) {
      let success = true
      const providerId = `${notif.channel}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      // Simulacija
      await createAuditLog({
        action: success ? 'NOTIFICATION_SENT' : 'NOTIFICATION_FAILED',
        entityType: 'Notification',
        details: {
          channel: notif.channel,
          recipient: notif.recipient,
          subject: notif.subject || '',
          providerId,
          success,
          batch: true,
        } as Record<string, unknown>,
        userId: authResult.session?.employeeId,
      })
      results.push({ recipient: notif.recipient, channel: notif.channel, success, providerId })
    }
    return NextResponse.json({
      total: results.length,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/notifications', 'Napaka pri množičnem pošiljanju')
  }
}
