// ============================================
// POST /api/time-off/[id]/approve — odobri prošnjo
// ============================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const { id } = await params

    const request = await db.timeOffRequest.update({
      where: { id },
      data: {
        status: 'approved',
        reviewedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, request })
  } catch (err) {
    return handleApiError(err, 'time-off approve')
  }
}
