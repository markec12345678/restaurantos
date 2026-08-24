
// GET /api/digital-receipt?id=xxx&t=yyy — Javno dostopen digitalni račun za goste
// Brez avtentikacije — gost dostopa preko QR kode ali linka
// SECURITY: Token `t` je obvezen — preprečuje enumeracijo računov po ID-ju
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { checkRateLimit, getClientIp, GENERAL_PUBLIC_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'
import { verifyReceiptToken, buildDigitalReceiptResponse } from './_helpers'


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

    // SECURITY: Token je obvezen — brez njega ne izdamo računa
    // Prejšnja koda je preverila token samo, če je bil poslan — kar pomeni, da
    // je vsak, ki je poznal CUID, lahko prebral polne fiskalne podatke kateregakoli računa.
    if (!token) {
      return NextResponse.json({ error: 'Manjka dostopni žeton' }, { status: 401 })
    }

    // SECURITY: Constant-time primerjava tokena (prepreči timing napade)
    let tokenValid = false
    try {
      tokenValid = verifyReceiptToken(receiptId, token)
    } catch {
      // Secret manjka — vrni 500 z jasnim navodilom
      return NextResponse.json(
        { error: 'Strežnik ni pravilno konfiguriran za izdajo digitalnih računov. Kontaktirajte podporo.' },
        { status: 500 }
      )
    }
    if (!tokenValid) {
      return NextResponse.json({ error: 'Račun ni najden' }, { status: 404 })
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
    return NextResponse.json(deepToNumbers(response))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/digital-receipt', 'Napaka pri pridobivanju računa')
  }
}
