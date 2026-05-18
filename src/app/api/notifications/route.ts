// ============================================
// NOTIFICATION SYSTEM API — Obvestila za stranke in osebje
// SMS/Email za rezervacije, naročila, dostave
// Toast POS + SevenRooms standard
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

// ============================================
// GET — Pridobi obvestila
// ============================================
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'all' // all, sms, email, push
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

    // Statistika
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayNotifications = await db.auditLog.findMany({
      where: {
        action: { in: ['NOTIFICATION_SENT', 'NOTIFICATION_FAILED'] },
        timestamp: { gte: today },
      },
    })

    const parseDetails = (d: unknown): Record<string, unknown> => {
      if (typeof d === 'string') {
        try { return JSON.parse(d) } catch { return {} }
      }
      return (d as Record<string, unknown>) || {}
    }

    const stats = {
      totalSent: todayNotifications.filter(n => n.action === 'NOTIFICATION_SENT').length,
      totalFailed: todayNotifications.filter(n => n.action === 'NOTIFICATION_FAILED').length,
      byType: {
        sms: todayNotifications.filter(n => parseDetails(n.details).channel === 'sms').length,
        email: todayNotifications.filter(n => parseDetails(n.details).channel === 'email').length,
        push: todayNotifications.filter(n => parseDetails(n.details).channel === 'push').length,
      },
    }

    return NextResponse.json({ notifications, stats })
  } catch (error) {
    console.error('[NOTIFICATIONS GET]', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju obvestil' }, { status: 500 })
  }
}

// ============================================
// POST — Pošlji obvestilo
// ============================================
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const body = await req.json()
    const { channel, recipient, subject, message, entityType, entityId } = body

    if (!channel || !recipient || !message) {
      return NextResponse.json({ error: 'Manjkajoči podatki: channel, recipient, message' }, { status: 400 })
    }

    // Simulacija pošiljanja (v produkciji bi uporabili Twilio/SendGrid)
    let success = true
    let providerId = ''

    try {
      if (channel === 'sms') {
        // Twilio simulacija
        providerId = `sms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        // V produkciji: await twilio.messages.create({ to: recipient, body: message })
      } else if (channel === 'email') {
        // SendGrid simulacija
        providerId = `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        // V produkciji: await sendGrid.send({ to: recipient, subject, html: message })
      } else if (channel === 'push') {
        // Push simulacija
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
        subject: subject || '',
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
  } catch (error) {
    console.error('[NOTIFICATIONS POST]', error)
    return NextResponse.json({ error: 'Napaka pri pošiljanju obvestila' }, { status: 500 })
  }
}

// ============================================
// POST /send-batch — Množično pošiljanje
// ============================================
export async function PUT(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json()
    const { notifications } = body as { notifications: Array<{ channel: string; recipient: string; subject?: string; message: string }> }

    if (!Array.isArray(notifications) || notifications.length === 0) {
      return NextResponse.json({ error: 'Seznam obvestil je prazen' }, { status: 400 })
    }

    if (notifications.length > 100) {
      return NextResponse.json({ error: 'Največ 100 obvestil naenkrat' }, { status: 400 })
    }

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
  } catch (error) {
    console.error('[NOTIFICATIONS PUT]', error)
    return NextResponse.json({ error: 'Napaka pri množičnem pošiljanju' }, { status: 500 })
  }
}
