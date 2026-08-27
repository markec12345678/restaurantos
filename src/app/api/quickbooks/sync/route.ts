// ============================================
// /api/quickbooks/sync — Run sync
// ============================================
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { runFullSync, disconnectQBO, getSyncStatus } from '@/lib/quickbooks'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET — sync status
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const sync = await db.quickBooksSync.findFirst({
      where: { isActive: true },
    })

    if (!sync) {
      return NextResponse.json({ connected: false })
    }

    const status = await getSyncStatus(sync.id)

    // Pridobi zadnje sync log-e
    const recentLogs = await db.quickBooksSyncLog.findMany({
      where: { syncId: sync.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        entityType: true,
        entityId: true,
        qbEntityId: true,
        status: true,
        action: true,
        errorMessage: true,
        syncedAt: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      connected: true,
      status,
      recentLogs,
    })
  } catch (err) {
    return handleApiError(err, 'quickbooks/sync GET')
  }
}

// POST — run sync ali disconnect
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json().catch(() => ({}))
    const action = body.action || 'sync'

    const sync = await db.quickBooksSync.findFirst({
      where: { isActive: true },
    })

    if (!sync) {
      return NextResponse.json({ error: 'QBO ni povezan' }, { status: 400 })
    }

    if (action === 'disconnect') {
      await disconnectQBO(sync.id)
      return NextResponse.json({ success: true, message: 'QBO odklopljen' })
    }

    if (action === 'sync') {
      const result = await runFullSync(sync.id)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Neznana akcija' }, { status: 400 })
  } catch (err) {
    return handleApiError(err, 'quickbooks/sync POST')
  }
}
