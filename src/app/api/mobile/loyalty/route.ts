// ============================================
// /api/mobile/loyalty — Mobile loyalty balance
// ============================================
// Za guest app — pregled točk in zgodovine.
// ============================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { handleApiError } from '@/lib/api-utils'
import { verifyApiKey } from '@/lib/api-security'
// R93-c: rate-limit kanon (fiksni store key + fail-closed core). 429 helper
// direktno iz '/response' (ne barrel) — testni mocki so lastniki barrel-a.
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
// R143-b (epic #115 #30, kontrakt (e)): tier kanon — lokalni helper je imel
// DRIFTOVANE prage (bronze:100/silver:500/gold:1500) ≠ kanon lib/loyalty-tiers
// (500/2000/5000). Napredek se zdaj računa IZKLJUČNO prek kanonskega
// tierProgress() (ročno dodeljen višji nivo se šteje kot trenutni).
import { tierProgress } from '@/lib/loyalty-tiers'

export const dynamic = 'force-dynamic'

// GET — loyalty stanje (po telefonu ali emailu)
export async function GET(req: Request) {
  try {
    // R93-c (anonimni model, zrcali mobile/order + public/*): rate limit NA
    // VRHU try bloka, PRED verifyApiKey — vsak verifyApiKey klic naredi DB
    // lookup (ApiKey tabela), zato invalid-key brute-force dušimo PRED
    // avtentikacijo. Fiksni store key 'mobile-loyalty' (ne pathname-izpeljan)
    // preprečuje per-id fan-out iz enega IP-ja; fail-closed core.ts kanon.
    const rateCheck = await checkRateLimitAsync('mobile-loyalty', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rateCheck.allowed) {
      return rateLimitedResponse(rateCheck.retryAfterMs, 'Preveč zahtevkov')
    }

    const authHeader = req.headers.get('authorization')
    const apiKeyResult = await verifyApiKey(authHeader)
    if (!apiKeyResult.valid) {
      return NextResponse.json({ error: apiKeyResult.error }, { status: 401 })
    }

    if (!apiKeyResult.apiKey?.scopes.includes('read:loyalty') && !apiKeyResult.apiKey?.scopes.includes('admin')) {
      return NextResponse.json({ error: 'Nimaš dovoljenja za loyalty' }, { status: 403 })
    }

    // FIX R85-FINAL (HIGH): Tenant binding — verifyApiKey vrne subscriptionId
    // (P0-C5), ampak je bil tukaj nikoli uporabljen: kateri koli veljaven API
    // ključ z read:loyalty je po telefonu/emailu prebral loyalty račun KATERE
    // KOLI naročnine (ime, telefon, email, točke, tier, zadnjih 20 transakcij).
    // Fail-closed: ključ brez naročnine ne bere ničesar (R82-C mobile/order vzorec).
    const subId = apiKeyResult.subscriptionId ?? null
    if (!subId) {
      return NextResponse.json({ error: 'API ključ ni vezan na naročnino' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const phone = searchParams.get('phone')
    const email = searchParams.get('email')

    if (!phone && !email) {
      return NextResponse.json({ error: 'phone ali email je obvezen' }, { status: 400 })
    }

    const account = await db.loyaltyAccount.findFirst({
      where: {
        location: { subscriptionId: subId },
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

    // R143-b: kanonski tier napredek (enoten vir pragov). Oblika odgovora
    // (current/nextTier/pointsToNext) ostane IDENTIČNA mobilnim klientom —
    // spreminjajo se samo VREDNOSTI (prej driftane prage).
    const progress = tierProgress(account.lifetimePoints, account.tier)

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
        nextTier: progress.next,
        pointsToNext: progress.pointsToNext,
      },
    })
  } catch (err) {
    return handleApiError(err, 'mobile/loyalty GET')
  }
}
