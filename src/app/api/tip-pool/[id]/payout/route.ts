// ============================================
// R145-b (epic #115 #32) — POST /api/tip-pool/[id]/payout
// Izplačilo distribuiranih napitnin (zapre izplačilni ciklus — prej sta
// TipDistribution.status='paid'/paidAt in TipPool.status='paid' ostala
// nedosegljiva; audit R145-a Q3-4).
//
// Kanon: rate limit bucket 'tip-pool' (skupen modul) PRED auth (R112 vzorec),
// requireAuth manage_employees (pariteta ostalih tip-pool handlerjev),
// Next 16 { params: Promise } + await params, handler v _helpers/payout-handler.ts
// (put-handler precedens), Serializable tx + hash-chain-safe recreate + in-tx
// audit TIP_POOL_PAID (counters/amounts samo — PII kanon).
// ============================================

import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handlePayoutTipPool } from '../../_helpers'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // R145-b: rate limit (isti 'tip-pool' bucket kot GET/POST/PUT)
    const rl = await checkRateLimitAsync('tip-pool', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const { id } = await params
    return await handlePayoutTipPool(req, authResult, id)
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/tip-pool/[id]/payout', 'Napaka pri izplačilu napitnin')
  }
}
