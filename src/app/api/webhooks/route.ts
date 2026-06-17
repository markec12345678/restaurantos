import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'

// Validacijska shema za kreiranje webhooka
const createWebhookSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200, 'Ime ne sme preseči 200 znakov'),
  url: z.string().url('URL mora biti veljaven').max(500, 'URL ne sme preseči 500 znakov'),
  events: z.string().max(2000, 'Dogodki ne smejo preseči 2000 znakov').default('[]'),
  isActive: z.boolean().default(true),
  secret: z.string().max(200, 'Skrivnost ne sme preseči 200 znakov').default(''),
})

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // AVTENTIKACIJA: Webhooki so občutljivi - samo admin
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const isActive = searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    if (isActive !== null) where.isActive = isActive === 'true'

    const webhooks = await db.webhook.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(deepToNumbers(webhooks))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/webhooks', 'Napaka pri pridobivanju spletnih kljuk')
  }
}

export async function POST(req: Request) {
  // AVTENTIKACIJA: Ustvarjanje webhookov - samo admin
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const result = await validateRequest(req, createWebhookSchema)
    if (result.error) return result.error

    const data = result.data

    // Samodejno generiraj secret če ni podan (Web Crypto API - Edge Runtime kompatibilen)
    const randomBytes = new Uint8Array(32)
    crypto.getRandomValues(randomBytes)
    const hexSecret = Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('')
    const secret = data.secret || `whsec_${hexSecret}`

    const webhook = await db.webhook.create({
      data: {
        name: data.name,
        url: data.url,
        events: data.events,
        isActive: data.isActive,
        secret,
      },
    })

    return NextResponse.json(webhook, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/webhooks', 'Napaka pri ustvarjanju spletne kljuke')
  }
}
