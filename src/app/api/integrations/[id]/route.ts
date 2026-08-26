import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'

// ============================================
// GET /api/integrations/[id] — Podrobnosti integracije
// ============================================

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const { id } = await params

    const integration = await db.integration.findUnique({
      where: { id },
      include: {
        logs: {
          take: 50,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!integration) {
      return NextResponse.json({ error: 'Integracija ni najdena' }, { status: 404 })
    }

    // Prikaži API ključe samo z masko
    const sanitized = {
      ...integration,
      apiKey: integration.apiKey ? '••••••••' : '',
      apiSecret: integration.apiSecret ? '••••••••' : '',
    }

    return NextResponse.json(deepToNumbers(sanitized))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/integrations/[id]', 'Napaka pri pridobivanju integracije')
  }
}

// ============================================
// PUT /api/integrations/[id] — Posodobi integracijo
// ============================================

const updateIntegrationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['eracuni', 'accounting', 'delivery', 'crm', 'ecommerce', 'analytics', 'custom']).optional(),
  provider: z.string().max(100).optional(),
  baseUrl: z.string().optional(),
  apiKey: z.string().max(500).optional(),
  apiSecret: z.string().max(500).optional(),
  config: z.string().max(5000).optional(),
  syncEnabled: z.boolean().optional(),
  syncInterval: z.number().int().min(60).max(86400).optional(),
  events: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
})

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const { id } = await params
    const { data, error: validationError } = await validateRequest(req, updateIntegrationSchema)
    if (validationError) return validationError

    // Preveri, da integracija obstaja
    const existing = await db.integration.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Integracija ni najdena' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.type !== undefined) updateData.type = data.type
    if (data.provider !== undefined) updateData.provider = data.provider
    if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl
    // FIX CRITICAL: Ne shrani maskiranih API ključev v bazo
    if (data.apiKey !== undefined && data.apiKey !== '••••••••') updateData.apiKey = data.apiKey
    if (data.apiSecret !== undefined && data.apiSecret !== '••••••••') updateData.apiSecret = data.apiSecret
    if (data.config !== undefined) updateData.config = data.config
    if (data.syncEnabled !== undefined) updateData.syncEnabled = data.syncEnabled
    if (data.syncInterval !== undefined) updateData.syncInterval = data.syncInterval
    if (data.events !== undefined) updateData.events = data.events
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    const integration = await db.integration.update({
      where: { id },
      data: updateData,
    })

    // FIX SECURITY: maskiraj apiKey + apiSecret v PUT odgovoru (enako kot GET)
    return NextResponse.json(deepToNumbers({
      ...integration,
      apiKey: integration.apiKey ? '••••••••' : '',
      apiSecret: integration.apiSecret ? '••••••••' : '',
    }))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/integrations/[id]', 'Napaka pri posodobitvi integracije')
  }
}

// ============================================
// DELETE /api/integrations/[id] — Izbriši integracijo
// ============================================

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const { id } = await params

    // Preveri, da integracija obstaja
    const existing = await db.integration.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Integracija ni najdena' }, { status: 404 })
    }

    // FIX MEDIUM: Ovij v transakcijo — prepreči delne izbris (logi izbrisani, integracija ne)
    await db.$transaction(async (tx) => {
      await tx.integrationLog.deleteMany({ where: { integrationId: id } })
      await tx.integration.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/integrations/[id]', 'Napaka pri brisanju integracije')
  }
}
