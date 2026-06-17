
// =====================================================================
// PUBLIC PROMO CHECK — Preveri promo kodo za online naročilo
// GET /api/public/promo-check?code=WELCOME10&subtotal=25.00
// FIX CRITICAL: Rate limiting za preprečitev brute-force iskanja kod
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { checkRateLimit, getClientIp, PROMO_CHECK_LIMIT } from '@/lib/rate-limit'
import { toNum, calcDiscount } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // FIX CRITICAL: Rate limiting
  const clientIp = getClientIp(req)
  const rateCheck = checkRateLimit('promo-check', clientIp, PROMO_CHECK_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Preveč zahtevkov. Poskusite znova čez nekaj sekund.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)) } }
    )
  }

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')?.trim().toUpperCase()
    const subtotalStr = url.searchParams.get('subtotal') || '0'
    const subtotal = Number(subtotalStr)

    if (!code) {
      return NextResponse.json({ error: 'Koda je obvezna' }, { status: 400 })
    }

    // Prepreči preveč dolge kode (potential abuse)
    if (code.length > 50) {
      return NextResponse.json({ valid: false, message: 'Neveljavna koda' })
    }

    // Poišči aktivni popust s to promo kodo
    const discount = await db.discount.findFirst({
      where: {
        promoCode: code,
        isActive: true,
        triggerType: 'promo_code',
      },
    })

    if (!discount) {
      return NextResponse.json({ valid: false, message: 'Neveljavna koda' })
    }

    // Preveri omejitve
    const now = new Date()
    if (discount.validFrom && discount.validFrom > now) {
      return NextResponse.json({ valid: false, message: 'Koda še ni veljavna' })
    }
    if (discount.validTo && discount.validTo < now) {
      return NextResponse.json({ valid: false, message: 'Koda je potekla' })
    }
    if (discount.maxUses !== null && discount.currentUses >= discount.maxUses) {
      return NextResponse.json({ valid: false, message: 'Koda je že bila uporabljena maksimalno krat' })
    }

    // Izračunaj popust
    let discountAmount = 0
    if (discount.type === 'percentage') {
      discountAmount = calcDiscount(subtotal, discount.amount, 'percentage')
    } else if (discount.type === 'fixed_amount') {
      discountAmount = toNum(discount.amount)
    }

    // Popust ne more biti večji od subtotla
    discountAmount = Math.min(discountAmount, subtotal)

    return NextResponse.json({
      valid: true,
      discount: {
        // FIX MEDIUM: Ne izpostavljaj internega discount.id nepooblaščenim uporabnikom
        // Uporabimo ločen publicCode za reference v online-order namesto notranjega ID-ja
        publicCode: discount.id.substring(0, 8), // Prvih 8 znakov ID-ja za reference
        name: discount.name,
        type: discount.type,
        amount: toNum(discount.amount),
        discountAmount: Math.round(discountAmount * 100) / 100,
        description: discount.type === 'percentage'
          ? `${toNum(discount.amount)}% popust`
          : `€${toNum(discount.amount).toFixed(2)} popust`,
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/public/promo-check', 'Napaka pri preverjanju kode')
  }
}
