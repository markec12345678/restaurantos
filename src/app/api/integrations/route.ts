import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

// ============================================
// GET /api/integrations — Seznam integracij
// ============================================

export async function GET(req: Request) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const isActive = searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    if (type) where.type = type
    if (isActive !== null) where.isActive = isActive === 'true'

    const integrations = await db.integration.findMany({
      where,
      include: {
        _count: { select: { logs: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Odstrani občutljive podatke iz seznama
    const sanitized = integrations.map(int => ({
      ...int,
      apiKey: int.apiKey ? '••••••••' : '',
      apiSecret: int.apiSecret ? '••••••••' : '',
    }))

    return NextResponse.json(sanitized)
  } catch (error) {
    console.error('Failed to fetch integrations:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju integracij' }, { status: 500 })
  }
}

// ============================================
// POST /api/integrations — Ustvari integracijo
// ============================================

const createIntegrationSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200),
  type: z.enum(['eracuni', 'accounting', 'delivery', 'crm', 'ecommerce', 'analytics', 'custom']),
  provider: z.string().min(1).max(100),
  baseUrl: z.string().default(''),
  apiKey: z.string().max(500).default(''),
  apiSecret: z.string().max(500).default(''),
  config: z.string().max(5000).default('{}'),
  syncEnabled: z.boolean().default(true),
  syncInterval: z.number().int().min(60).max(86400).default(300),
  events: z.string().max(2000).default('[]'),
  isActive: z.boolean().default(true),
})

export async function POST(req: Request) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const body = await req.json()

    const parsed = createIntegrationSchema.safeParse(body)
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

    const integration = await db.integration.create({
      data: {
        name: data.name,
        type: data.type,
        provider: data.provider,
        baseUrl: data.baseUrl,
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        config: data.config,
        syncEnabled: data.syncEnabled,
        syncInterval: data.syncInterval,
        events: data.events,
        isActive: data.isActive,
      },
    })

    return NextResponse.json(integration, { status: 201 })
  } catch (error) {
    console.error('Failed to create integration:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju integracije' }, { status: 500 })
  }
}
