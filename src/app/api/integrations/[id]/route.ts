import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

// ============================================
// GET /api/integrations/[id] — Podrobnosti integracije
// ============================================

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

    return NextResponse.json(sanitized)
  } catch (error) {
    console.error('Failed to fetch integration:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju integracije' }, { status: 500 })
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
    const body = await req.json()

    const parsed = updateIntegrationSchema.safeParse(body)
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
    if (data.apiKey !== undefined) updateData.apiKey = data.apiKey
    if (data.apiSecret !== undefined) updateData.apiSecret = data.apiSecret
    if (data.config !== undefined) updateData.config = data.config
    if (data.syncEnabled !== undefined) updateData.syncEnabled = data.syncEnabled
    if (data.syncInterval !== undefined) updateData.syncInterval = data.syncInterval
    if (data.events !== undefined) updateData.events = data.events
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    const integration = await db.integration.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(integration)
  } catch (error) {
    console.error('Failed to update integration:', error)
    return NextResponse.json({ error: 'Napaka pri posodobitvi integracije' }, { status: 500 })
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

    // Izbriši povezane loge nato integracijo
    await db.integrationLog.deleteMany({ where: { integrationId: id } })
    await db.integration.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete integration:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju integracije' }, { status: 500 })
  }
}
