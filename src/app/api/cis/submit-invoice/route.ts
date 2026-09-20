// ============================================
// POST /api/cis/submit-invoice — Oddaja RAČUNA na CIS (Hrvaška, runda 29)
// ============================================
// Produkcijska vezava: reálni Receipt (po št. računa ali orderja) →
// submitReceiptToCis (build ZKI + XML-dsig + SOAP POST + JIR → persist na
// Receipt). Zrcali FURS POST /api/furs (orderId-based oddaja), ampak NON-
// THROWING po POS pravilu: ok=false je VELJAVEN izid (pending → retry).
//
// Body (zod): { receiptId? , orderId? } — vsaj ena obvezen.
//   receiptId — direktno (retry iz UI, batch)
//   orderId   — najdi račun naročila (findFirst orderId + !isStorno)
//
// Odgovori:
//   200 { ok, skipped?, reason?, cisStatus?, jir?, zki?, serverErrorCode?,
//         errorMessage?, validation?, environment? }  — izid oddaje
//   400 { error } — neveljaven body / račun ni najden
//   401/429 — auth / rate limit (enako kot ostali CIS endpointi)
// ============================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { handleApiError } from '@/lib/api-utils'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { db } from '@/lib/db'
import { submitReceiptToCis } from '@/lib/cis'

export const dynamic = 'force-dynamic'

const submitInvoiceSchema = z
  .object({
    receiptId: z.string().min(1).optional(),
    orderId: z.string().min(1).optional(),
  })
  .refine((v) => v.receiptId || v.orderId, {
    message: 'Podaj receiptId ali orderId',
  })

export async function POST(req: Request) {
  try {
    const rl = await checkRateLimitAsync('cis-submit-invoice', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Preveč zahtevkov' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } }
      )
    }

    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // FIX R86-4 (MEDIUM): tenant scope — Receipt NIMA lastnega locationId stolpca,
    // scope prek order.locationId. Prej je lokacijski admin lahko oddal na CIS
    // (HR FINA) tuj račun po receiptId/orderId — fiskalna oddaja tujega prometa.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, null, {
      endpoint: 'POST /api/cis/submit-invoice',
    })
    if ('error' in scope) return scope.error

    const bodyResult = await parseBody(req)
    if (bodyResult.error) return bodyResult.error

    // R86-4: pogojni spread — NIKOLI { order: { locationId: null } };
    // legacy NULL-order receipti so dosegljivi samo super-adminu (fail-closed).
    const receiptScope = scope.locationId
      ? { order: { locationId: scope.locationId } }
      : {}

    // ── Resolvcija računa: receiptId direktno ALI orderId → !isStorno račun ──
    let receiptId = bodyResult.data.receiptId
    if (receiptId) {
      // R86-4: lastniška preverba tudi za direktni receiptId path — tuj/neznan
      // račun = ISTI 400 kot neobstoječ (brez existence oraklja).
      const owned = await db.receipt.findFirst({
        where: { id: receiptId, ...receiptScope },
        select: { id: true },
      })
      if (!owned) {
        return NextResponse.json({ error: 'Račun ni najden' }, { status: 400 })
      }
    } else {
      const receipt = await db.receipt.findFirst({
        where: { orderId: bodyResult.data.orderId!, isStorno: false, ...receiptScope },
        select: { id: true },
      })
      if (!receipt) {
        return NextResponse.json(
          { error: 'Račun ni najden — najprej ustvari račun (plačilo)' },
          { status: 400 }
        )
      }
      receiptId = receipt.id
    }

    // ── Oddaja (non-throwing — vsak izid je strukturiran) ──
    const outcome = await submitReceiptToCis(receiptId)
    if (outcome.reason === 'receipt-not-found') {
      return NextResponse.json({ error: 'Račun ni najden' }, { status: 400 })
    }

    logger.info(
      'CIS',
      `submit-invoice receipt=${receiptId} → ok=${outcome.ok}` +
        (outcome.skipped ? ` skip=${outcome.reason}` : '') +
        (outcome.jir ? ` JIR=${outcome.jir}` : '')
    )

    return NextResponse.json(outcome)
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/cis/submit-invoice', 'Napaka pri oddaji računa na CIS')
  }
}

async function parseBody(req: Request): Promise<
  { data: z.infer<typeof submitInvoiceSchema>; error?: undefined } | { error: Response; data?: undefined }
> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return { error: NextResponse.json({ error: 'Manjkajoče telo zahteve' }, { status: 400 }) }
  }
  const parsed = submitInvoiceSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      error: NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Neveljavno telo zahteve' },
        { status: 400 }
      ),
    }
  }
  return { data: parsed.data }
}
