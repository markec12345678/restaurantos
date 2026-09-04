// ============================================
// POST /api/outbox/[id]/retry — ročno ponovno poskusi event
// ============================================
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { retryOutboxEvent } from '@/lib/outbox'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params
    await retryOutboxEvent(id)

    return NextResponse.json({ success: true, message: 'Event premaknjen nazaj v pending' })
  } catch (err) {
    return handleApiError(err, 'outbox retry')
  }
}
