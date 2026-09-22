// ============================================
// POST /api/outbox/[id]/retry — ročno ponovno poskusi event
// ============================================
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow, notInScopeResponse } from '@/lib/tenant-scope'
import { handleApiError } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { retryOutboxEvent } from '@/lib/outbox'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // FIX R86-4 (MEDIUM): tenant scope — prej je bil retry po id BREZ scopa
    // (lokovani admin je lahko sprožil ponovno dostavo tujega eventa: FURS/SMS/
    // webhook replay čez tenantе). Lastniška preverba PRED retry-jem; legacy
    // NULL eventи so vidni samo super-adminu (fail-closed).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, null, {
      endpoint: 'POST /api/outbox/[id]/retry',
    })
    if ('error' in scope) return scope.error

    const { id } = await params

    const event = await db.outboxEvent.findFirst({
      where: {
        id,
        // R86-4: pogojni spread — NIKOLI { locationId: null }
        ...(scope.locationId ? { locationId: scope.locationId } : {}),
      },
      select: { id: true },
    })
    if (!event) return notInScopeResponse('Outbox event')

    // R108 (OR-6, CAS state machine): retry je dovoljen SAMO iz
    // 'failed' | 'dead_letter' (prej NEPOGOJEN reset na pending →
    // sent/processing event ponovno dostavljen = dupli FURS/SMS/webhook).
    // count 0 → event je v nedovoljenem stanju → 409 (klient osveži pogled).
    const retried = await retryOutboxEvent(id)
    if (!retried) {
      return NextResponse.json(
        { error: 'Event ni v stanju failed/dead_letter — ponovni poskus ni mogoč (osvežite pogled)' },
        { status: 409 },
      )
    }

    return NextResponse.json({ success: true, message: 'Event premaknjen nazaj v pending' })
  } catch (err) {
    return handleApiError(err, 'outbox retry')
  }
}
