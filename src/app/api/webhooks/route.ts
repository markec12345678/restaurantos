import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

// Validacijska shema za kreiranje webhooka
const createWebhookSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200),
  url: z.string().url('URL mora biti veljaven').max(500),
  events: z.string().max(2000).default('[]'),
  isActive: z.boolean().default(true),
  secret: z.string().max(200).default(''),
})

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

    return NextResponse.json(webhooks)
  } catch (error) {
    console.error('Failed to fetch webhooks:', error)
    return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  // AVTENTIKACIJA: Ustvarjanje webhookov - samo admin
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const body = await req.json()

    // VALIDACIJA: Preveri vnose
    const parsed = createWebhookSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        error: 'Neveljavni podatki',
        validationErrors: parsed.error.issues.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }, { status: 400 })
    }
    const data = parsed.data

    const webhook = await db.webhook.create({
      data: {
        name: data.name,
        url: data.url,
        events: data.events,
        isActive: data.isActive,
        secret: data.secret,
      },
    })

    return NextResponse.json(webhook, { status: 201 })
  } catch (error) {
    console.error('Failed to create webhook:', error)
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 })
  }
}
