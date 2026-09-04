// ============================================
// /api/quickbooks/auth — OAuth initiation
// ============================================
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { getAuthUrl, getSyncStatus } from '@/lib/quickbooks'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET — začni OAuth flow ali preveri status
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // Preveri ali je že povezan
    const existing = await db.quickBooksSync.findFirst({
      where: { isActive: true },
    })

    if (existing) {
      const status = await getSyncStatus(existing.id)
      return NextResponse.json({
        connected: true,
        status,
      })
    }

    // Generiraj auth URL
    const state = crypto.randomUUID()
    const authUrl = getAuthUrl(state)

    if (!authUrl) {
      return NextResponse.json({
        connected: false,
        error: 'QBO konfiguracija manjka (QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI)',
      }, { status: 400 })
    }

    return NextResponse.json({
      connected: false,
      authUrl,
      state,
    })
  } catch (err) {
    return handleApiError(err, 'quickbooks/auth GET')
  }
}
