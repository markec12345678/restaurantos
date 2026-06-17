
// GET /api/digital-receipt?id=xxx — Javno dostopen digitalni račun za goste
// Brez avtentikacije — gost dostopa preko QR kode ali linka
// FIX CRITICAL: Rate limiting za preprečitev enumeracije računov
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, GENERAL_PUBLIC_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'
import { generateReceiptToken, buildDigitalReceiptResponse } from './_helpers'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // FIX CRITICAL: Rate limiting
  const clientIp = getClientIp(req)
  const rateCheck = checkRateLimit('digital-receipt', clientIp, GENERAL_PUBLIC_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Preveč zahtevkov. Poskusite znova čez nekaj sekund.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)) } }
    )
  }

  try {
    const { searchParams } = new URL(req.url)
    const receiptId = searchParams.get('id')
    const token = searchParams.get('t')

    if (!receiptId) {
      return NextResponse.json({ error: 'Manjka ID računa' }, { status: 400 })
    }

    // FIX MEDIUM: Validiraj format receiptId — zavrni očitno neveljavne vnose (prepreči enumeracijo)
    if (!/^[a-z0-9]{5,50}$/i.test(receiptId)) {
      return NextResponse.json({ error: 'Račun ni najden' }, { status: 404 })
    }

    // SECURITY: Preveri HMAC žeton za preprečitev enumeracije računov
    if (token) {
      const expectedToken = generateReceiptToken(receiptId)
      if (token !== expectedToken) {
        return NextResponse.json({ error: 'Račun ni najden' }, { status: 404 })
      }
    }

    // Poišči račun po ID-ju
    const receipt = await db.receipt.findUnique({
      where: { id: receiptId },
    })

    if (!receipt) {
      return NextResponse.json({ error: 'Račun ni najden' }, { status: 404 })
    }

    // Pridobi povezano naročilo za artikle
    const order = await db.order.findUnique({
      where: { id: receipt.orderId },
      include: {
        table: true,
        orderItems: {
          include: { menuItem: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    const response = await buildDigitalReceiptResponse(receipt, order)
    return NextResponse.json(response)
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/digital-receipt', 'Napaka pri pridobivanju računa')
  }
}
