import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'

// ============================================
// GET /api/integrations — Seznam integracij
// ============================================

export const dynamic = 'force-dynamic'

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

    return NextResponse.json(deepToNumbers(sanitized))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/integrations', 'Napaka pri pridobivanju integracij')
  }
}

// ============================================
// POST /api/integrations — Ustvari integracijo
// ============================================

const createIntegrationSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200, 'Ime ne sme preseči 200 znakov'),
  type: z.enum(['eracuni', 'accounting', 'delivery', 'crm', 'ecommerce', 'analytics', 'custom'], { message: 'Neveljaven tip integracije' }),
  provider: z.string().min(1, 'Ponudnik je obvezen').max(100, 'Ponudnik ne sme preseči 100 znakov'),
  baseUrl: z.string().max(500, 'URL ne sme preseči 500 znakov').default(''),
  apiKey: z.string().max(500, 'API ključ ne sme preseči 500 znakov').default(''),
  apiSecret: z.string().max(500, 'API skrivnost ne sme preseči 500 znakov').default(''),
  config: z.string().max(5000, 'Konfiguracija ne sme preseči 5000 znakov').default('{}'),
  syncEnabled: z.boolean().default(true),
  syncInterval: z.number().int().min(60, 'Interval sinhronizacije mora biti vsaj 60 sekund').max(86400, 'Interval sinhronizacije ne sme preseči 86400 sekund').default(300),
  events: z.string().max(2000, 'Dogodki ne smejo preseči 2000 znakov').default('[]'),
  isActive: z.boolean().default(true),
})

export async function POST(req: Request) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const { data, error: validationError } = await validateRequest(req, createIntegrationSchema)
    if (validationError) return validationError

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

    // FIX SECURITY: maskiraj apiKey + apiSecret v odgovoru (enako kot GET)
    // Prejšnja koda je vrnila plain secret ob kreiranju.
    return NextResponse.json({
      ...integration,
      apiKey: integration.apiKey ? '••••••••' : '',
      apiSecret: integration.apiSecret ? '••••••••' : '',
    }, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/integrations', 'Napaka pri ustvarjanju integracije')
  }
}
