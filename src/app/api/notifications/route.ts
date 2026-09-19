// ============================================
// NOTIFICATION SYSTEM API — Obvestila za stranke in osebje
// SMS/Email za rezervacije, naročila, dostave
// Toast POS + SevenRooms standard
// ============================================

import { db, createAuditLog, createAuditLogsBatch } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, parsePaginationParams, validateRequest } from '@/lib/api-utils'
import { sendNotificationSchema, sendBatchSchema, simulateSend, parseDetails, stripRecipientPii } from './_helpers'


// ============================================
// GET — Pridobi obvestila
// ============================================
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // FIX R80 (HIGH, tenant scope): prej permission 'take_orders' — AuditLog NIMA
    // locationId stolpca, zato ta ruta ne more biti varno tenant-scoped na staff
    // nivoju (vračala je details.recipient = telefon/email prejemnikov VSEH
    // tenantov). Zahteva admin; PII prejemnika se dodatno odstrani iz odgovora
    // (glej stripRecipientPii). Pravilna dolgoročna rešitev = AuditLog.locationId
    // stolpec (runda 81, shematska sprememba).
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'all'
    // P1-16: centralna pagination validacija (limit max, offset, search dolžina)
    const { limit, offset } = parsePaginationParams(searchParams, { defaultLimit: 50 })

    const where: Record<string, unknown> = {
      action: { in: ['NOTIFICATION_SENT', 'NOTIFICATION_FAILED', 'NOTIFICATION_QUEUED'] },
    }
    if (status !== 'all') {
      where.action = status === 'sent' ? 'NOTIFICATION_SENT' : status === 'failed' ? 'NOTIFICATION_FAILED' : 'NOTIFICATION_QUEUED'
    }

    // FIX: dodaj `total` za paginacijo + parallel count
    const [notifications, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.auditLog.count({ where }),
    ])

    // FIX R80 (HIGH, PII): details.recipient (telefon/email) se NE vrača —
    // AuditLog je trenutno globalen model, zato je prejemnik tuji tenant PII.
    // Kanal/zadeva/ostali metapodatki ostanejo (potrebni za UI obvestilnega centra).
    const maskedNotifications = notifications.map((n) => ({
      ...n,
      details: stripRecipientPii(n.details),
    }))

    // Statistika
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [sentCount, failedCount, byActionAndChannel] = await Promise.all([
      db.auditLog.count({ where: { action: 'NOTIFICATION_SENT', timestamp: { gte: today } } }),
      db.auditLog.count({ where: { action: 'NOTIFICATION_FAILED', timestamp: { gte: today } } }),
      db.auditLog.findMany({
        where: { action: { in: ['NOTIFICATION_SENT', 'NOTIFICATION_FAILED'] }, timestamp: { gte: today } },
        select: { details: true },
      }),
    ])

    let smsCount = 0
    let emailCount = 0
    let pushCount = 0
    for (const n of byActionAndChannel) {
      const channel = parseDetails(n.details).channel
      if (channel === 'sms') smsCount++
      else if (channel === 'email') emailCount++
      else if (channel === 'push') pushCount++
    }

    return NextResponse.json({ notifications: maskedNotifications, total, limit, offset, stats: { totalSent: sentCount, totalFailed: failedCount, byType: { sms: smsCount, email: emailCount, push: pushCount } } })
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
    const { success, providerId } = simulateSend(channel)

    await createAuditLog({
      action: success ? 'NOTIFICATION_SENT' : 'NOTIFICATION_FAILED',
      entityType: entityType || 'Notification',
      entityId: entityId || undefined,
      details: { channel, recipient, subject, providerId, success } as Record<string, unknown>,
      userId: authResult.session?.employeeId,
    })

    return NextResponse.json({ success, providerId, channel, recipient, message: success ? 'Obvestilo uspešno poslano' : 'Pošiljanje obvestila ni uspelo' })
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
    const auditEntries: Array<{ action: string; entityType: string; details: Record<string, unknown>; userId?: string }> = []

    // FIX PERFORMANCE: prejšnja koda je klicala createAuditLog v zanki — vsak
    // klic je ločena transakcija z read+write. Za N=100 obvestil = 100 transakcij.
    // Sedaj zbiramo vnose in jih zapišemo v eni transakciji z createAuditLogsBatch.
    for (const notif of notifications) {
      const { success, providerId } = simulateSend(notif.channel)
      results.push({ recipient: notif.recipient, channel: notif.channel, success, providerId })
      auditEntries.push({
        action: success ? 'NOTIFICATION_SENT' : 'NOTIFICATION_FAILED',
        entityType: 'Notification',
        details: { channel: notif.channel, recipient: notif.recipient, subject: notif.subject || '', providerId, success, batch: true },
        userId: authResult.session?.employeeId,
      })
    }

    // Zapiši vse audit vnose v eni transakciji
    await createAuditLogsBatch(auditEntries)

    return NextResponse.json({ total: results.length, sent: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results })
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/notifications', 'Napaka pri množičnem pošiljanju')
  }
}
