import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'

// ============================================
// GET /api/integrations/[id]/logs — Dnevnik integracije
// ============================================

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)

    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')
    const action = searchParams.get('action')

    const where: Record<string, unknown> = { integrationId: id }
    if (status) where.status = status
    if (action) where.action = action

    const logs = await db.integrationLog.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    })

    const total = await db.integrationLog.count({ where })

    return NextResponse.json({ logs, total, limit, offset })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/integrations/[id]/logs', 'Napaka pri pridobivanju dnevnikov')
  }
}
