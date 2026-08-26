// ============================================
// POST /api/sms/send — Pošlji SMS
// GET /api/sms/status — Preveri SMS konfiguracijo
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { isSmsConfigured, sendSms, type SmsMessage } from '@/lib/sms'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const sendSchema = z.object({
  to: z.string().min(6, 'Telefonska številka je obvezna'),
  body: z.string().min(1, 'Sporočilo je obvezno').max(1600, 'Sporočilo ne sme preseči 1600 znakov'),
  type: z.enum(['reservation', 'order_ready', 'loyalty', 'marketing', 'transactional']).default('transactional'),
})

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    return NextResponse.json({
      configured: isSmsConfigured(),
      provider: process.env.SMS_PROVIDER || null,
      from: process.env.SMS_FROM || null,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/sms', 'Napaka pri preverjanju SMS konfiguracije')
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error } = sendSchema.safeParse(bodyResult.data)
    if (error) {
      return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })
    }

    const message: SmsMessage = {
      to: data.to,
      body: data.body,
      type: data.type,
    }

    const result = await sendSms(message)

    if (result.success) {
      return NextResponse.json({ success: true, messageId: result.messageId })
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/sms', 'Napaka pri pošiljanju SMS')
  }
}
