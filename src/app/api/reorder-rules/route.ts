// ============================================
// /api/reorder-rules — CRUD za pravila naročanja
// ============================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  inventoryItemId: z.string().min(1).max(100),
  triggerType: z.enum(['min_qty', 'forecast_7d', 'forecast_14d', 'manual']).default('min_qty'),
  triggerThreshold: z.number().min(0).default(0),
  orderQuantity: z.number().min(0),
  orderUnit: z.string().max(20).default('pcs'),
  preferredSupplierId: z.string().max(100).optional(),
  leadTimeDays: z.number().int().min(0).max(60).default(2),
  isActive: z.boolean().default(true),
})

// GET — pridobi pravila
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const isActive = searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    if (isActive !== null) where.isActive = isActive === 'true'

    const rules = await db.reorderRule.findMany({
      where,
      include: {
        inventoryItem: {
          select: { id: true, name: true, quantity: true, unit: true, minQuantity: true, costPerUnit: true, supplier: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ rules, count: rules.length })
  } catch (err) {
    return handleApiError(err, 'reorder-rules GET')
  }
}

// POST — kreiraj/posodobi pravilo
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const body = await req.json().catch(() => ({}))
    const input = createSchema.parse(body)

    const rule = await db.reorderRule.upsert({
      where: { inventoryItemId: input.inventoryItemId },
      create: input,
      update: {
        triggerType: input.triggerType,
        triggerThreshold: input.triggerThreshold,
        orderQuantity: input.orderQuantity,
        orderUnit: input.orderUnit,
        preferredSupplierId: input.preferredSupplierId,
        leadTimeDays: input.leadTimeDays,
        isActive: input.isActive,
      },
      include: {
        inventoryItem: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ success: true, rule })
  } catch (err) {
    return handleApiError(err, 'reorder-rules POST')
  }
}

// DELETE — izbriši pravilo
export async function DELETE(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })

    await db.reorderRule.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    return handleApiError(err, 'reorder-rules DELETE')
  }
}
