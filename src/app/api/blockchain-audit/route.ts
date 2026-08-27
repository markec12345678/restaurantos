// ============================================
// /api/blockchain-audit — Audit chain management
// ============================================
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import {
  verifyChain,
  getChainStats,
  getChainSegment,
  exportChain,
} from '@/lib/blockchain-audit'

export const dynamic = 'force-dynamic'

// GET — chain status + verification
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'status'
    const fromBlock = parseInt(searchParams.get('fromBlock') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    if (action === 'status') {
      const [stats, verification] = await Promise.all([
        getChainStats(),
        verifyChain(),
      ])
      return NextResponse.json({ stats, verification })
    }

    if (action === 'segment') {
      const blocks = await getChainSegment(fromBlock, limit)
      return NextResponse.json({ blocks, count: blocks.length })
    }

    if (action === 'export') {
      const result = await exportChain(
        searchParams.get('fromBlock') ? parseInt(searchParams.get('fromBlock')!, 10) : undefined,
        searchParams.get('toBlock') ? parseInt(searchParams.get('toBlock')!, 10) : undefined,
      )
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Neznana akcija' }, { status: 400 })
  } catch (err) {
    return handleApiError(err, 'blockchain-audit GET')
  }
}

// POST — verify chain (ročno)
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const verification = await verifyChain()

    if (verification.valid) {
      return NextResponse.json({
        success: true,
        message: `✅ Veriga je veljavna (${verification.totalBlocks} blokov)`,
        verification,
      })
    }

    return NextResponse.json({
      success: false,
      message: `❌ Veriga je prekinjena pri bloku #${verification.brokenAt}`,
      verification,
    }, { status: 409 })
  } catch (err) {
    return handleApiError(err, 'blockchain-audit POST')
  }
}
