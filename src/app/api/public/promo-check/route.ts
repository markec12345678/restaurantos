import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'

// =====================================================================
// PUBLIC PROMO CHECK — Preveri promo kodo za online naročilo
// GET /api/public/promo-check?code=WELCOME10&subtotal=25.00
// =====================================================================

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')?.trim().toUpperCase()
    const subtotalStr = url.searchParams.get('subtotal') || '0'
    const subtotal = parseFloat(subtotalStr)

    if (!code) {
      return NextResponse.json({ error: 'Koda je obvezna' }, { status: 400 })
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
      discountAmount = subtotal * (discount.amount / 100)
    } else if (discount.type === 'fixed_amount') {
      discountAmount = discount.amount
    }

    // Popust ne more biti večji od subtotla
    discountAmount = Math.min(discountAmount, subtotal)

    return NextResponse.json({
      valid: true,
      discount: {
        id: discount.id,
        name: discount.name,
        type: discount.type,
        amount: discount.amount,
        discountAmount: Math.round(discountAmount * 100) / 100,
        description: discount.type === 'percentage'
          ? `${discount.amount}% popust`
          : `€${discount.amount.toFixed(2)} popust`,
      },
    })
  } catch (error) {
    console.error('Promo check error:', error)
    return NextResponse.json({ error: 'Napaka pri preverjanju kode' }, { status: 500 })
  }
}
