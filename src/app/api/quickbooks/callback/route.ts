// ============================================
// /api/quickbooks/callback — OAuth callback
// ============================================
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { exchangeCodeForTokens } from '@/lib/quickbooks'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const realmId = searchParams.get('realmId')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(new URL('/?qbo_error=' + encodeURIComponent(error), req.url))
    }

    if (!code || !realmId) {
      return NextResponse.json({ error: 'Manjka code ali realmId' }, { status: 400 })
    }

    const result = await exchangeCodeForTokens(code, realmId)

    if (!result.success) {
      return NextResponse.redirect(new URL('/?qbo_error=' + encodeURIComponent(result.error || 'unknown'), req.url))
    }

    // Redirect nazaj na admin UI
    return NextResponse.redirect(new URL('/?qbo_connected=1', req.url))
  } catch (err) {
    return handleApiError(err, 'quickbooks/callback')
  }
}
