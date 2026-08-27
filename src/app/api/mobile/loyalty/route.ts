// ============================================
// /api/mobile/loyalty — Mobile loyalty balance
// ============================================
// Za guest app — pregled točk in zgodovine.
// ============================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { handleApiError } from '@/lib/api-utils'
import { verifyApiKey } from '@/lib/api-security'
import { toNum } from '@/lib/decimal'

export const dynamic = 'force-dynamic'

// GET — loyalty stanje (po telefonu ali emailu)
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    const apiKeyResult = await verifyApiKey(authHeader)
    if (!apiKeyResult.valid) {
      return NextResponse.json({ error: apiKeyResult.error }, { status: 401 })
    }

    if (!apiKeyResult.apiKey?.scopes.includes('read:loyalty') && !apiKeyResult.apiKey?.scopes.includes('admin')) {
      return NextResponse.json({ error: 'Nimaš dovoljenja za loyalty' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const phone = searchParams.get('phone')
    const email = searchParams.get('email')

    if (!phone && !email) {
      return NextResponse.json({ error: 'phone ali email je obvezen' }, { status: 400 })
    }

    const account = await db.loyaltyAccount.findFirst({
      where: {
        OR: [
          ...(phone ? [{ customerPhone: phone }] : []),
          ...(email ? [{ customerEmail: email }] : []),
        ],
      },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        pointsBalance: true,
        lifetimePoints: true,
        tier: true,
        isActive: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            type: true,
            points: true,
            reason: true,
            createdAt: true,
          },
        },
      },
    })

    if (!account) {
      return NextResponse.json({ error: 'Loyalty račun ni najden' }, { status: 404 })
    }

    if (!account.isActive) {
      return NextResponse.json({ error: 'Račun je deaktiviran' }, { status: 403 })
    }

    // Pridobi reward-je za ta tier (uporabi LoyaltyTransaction kot proxy)
    // V produkciji bi imeli LoyaltyReward model
    const recentTransactions = await db.loyaltyTransaction.findMany({
      where: {
        loyaltyAccountId: account.id,
        type: 'redeem',
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        points: true,
        reason: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      account: {
        ...account,
        pointsBalance: account.pointsBalance,
        lifetimePoints: account.lifetimePoints,
      },
      rewards: [], // TODO: implement LoyaltyReward model
      recentRedemptions: recentTransactions,
      tierInfo: {
        current: account.tier,
        nextTier: getNextTier(account.tier),
        pointsToNext: getPointsToNextTier(account.tier, account.lifetimePoints),
      },
    })
  } catch (err) {
    return handleApiError(err, 'mobile/loyalty GET')
  }
}

// --- Helper za tier progression ---
function getNextTier(currentTier: string): string | null {
  const tiers = ['bronze', 'silver', 'gold', 'platinum']
  const idx = tiers.indexOf(currentTier)
  return idx >= 0 && idx < tiers.length - 1 ? tiers[idx + 1] : null
}

function getPointsToNextTier(currentTier: string, lifetimePoints: number): number {
  const thresholds: Record<string, number> = {
    bronze: 100,
    silver: 500,
    gold: 1500,
    platinum: 0, // max tier
  }
  const threshold = thresholds[currentTier] || 0
  return threshold > 0 ? Math.max(0, threshold - lifetimePoints) : 0
}
