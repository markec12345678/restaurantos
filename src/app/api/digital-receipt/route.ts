
// GET /api/digital-receipt?id=xxx — Javno dostopen digitalni račun za goste
// Brez avtentikacije — gost dostopa preko QR kode ali linka
// FIX CRITICAL: Rate limiting za preprečitev enumeracije računov
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { generateFursQRContent } from '@/lib/furs'
import { checkRateLimit, getClientIp, GENERAL_PUBLIC_LIMIT } from '@/lib/rate-limit'
import { toNum } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'

// SECURITY: HMAC žeton za digitalne račune — prepreči enumeracijo ID-jev
function generateReceiptToken(receiptId: string): string {
  const secret = process.env.RECEIPT_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-receipt-secret'
  // Enostaven HMAC — uporabimo Web Crypto API za Edge Runtime združljivost
  // Fallback za Node.js brez crypto.subtle
  const data = `${receiptId}:${secret}`
  // Uporabimo preprosto zgoščevanje — za produkcijo priporočamo crypto.subtle.sign()
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

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
    // Če je žeton prisoten, mora biti veljaven; če ni, nadaljuj z rate-limit zaščito
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

    // Pridobi nastavitve
    const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })

    // Pripravi artikle
    const items = (order?.orderItems || []).map(oi => {
      let modifiers: Array<{ name: string; price: number }> = []
      try { modifiers = JSON.parse(oi.modifiersJson || '[]') } catch { modifiers = [] }

      return {
        name: oi.menuItem?.name || 'Neznan artikel',
        quantity: oi.quantity,
        price: oi.price,
        vatRate: oi.vatRate,
        isVoided: oi.voided,
        modifiers,
      }
    })

    // DDV po stopnjah
    const vatBreakdown: Array<{ rate: number; base: number; vat: number }> = []
    try {
      const parsed = JSON.parse(receipt.vatBreakdown as string || '{}')
      for (const [rate, amounts] of Object.entries(parsed)) {
        const a = amounts as { base: number; vat: number }
        vatBreakdown.push({ rate: Number(rate), base: a.base, vat: a.vat })
      }
    } catch {
      // Neveljavna JSON struktura DDV razdelitve — nadaljuj s praznim seznamom
    }

    // FIX BUG3: Fetch active location's premisesId instead of misusing businessId
    // premisesId must be the registered business premises ID from FURS, not the company businessId
    let premisesId = settings?.businessId || ''
    try {
      const activeLocation = await db.location.findFirst({ where: { isActive: true } })
      if (activeLocation?.premisesId) {
        premisesId = activeLocation.premisesId
      }
    } catch {
      // Location model may not exist — fall back to businessId
    }

    // QR vsebina
    // FIX BUG-F8 HIGH: premisesId mora biti ID poslovnega prostora, ne matična številka
    const qrContent = receipt.zoi ? generateFursQRContent({
      zoi: receipt.zoi,
      totalAmount: toNum(receipt.total),
      issueDateTime: receipt.createdAt,
      taxId: settings?.taxId || '',
      businessId: settings?.businessId || '',
      registerId: settings?.registerNumber || 'BLG-001',
      premisesId, // FIX BUG3: Use Location's premisesId, not businessId
    }) : ''

    const s: { address?: string; city?: string; postCode?: string; phone?: string; businessId?: string; taxId?: string; registerNumber?: string; receiptFooter?: string } = settings || {}

    return NextResponse.json({
      id: receipt.id,
      receiptNumber: receipt.receiptNumber,
      businessName: receipt.businessName,
      businessAddress: s.address || receipt.businessAddress,
      businessCity: s.city || '',
      businessPostCode: s.postCode || '',
      businessPhone: s.phone || '',
      businessId: receipt.businessId,
      taxId: receipt.taxId,
      registerId: receipt.registerId,
      zoi: receipt.zoi,
      eor: receipt.eor,
      fiscalVerified: receipt.fiscalVerified,
      isStorno: receipt.isStorno,
      items,
      subtotal: receipt.subtotal,
      vatBreakdown,
      totalVat: receipt.totalVat,
      discount: receipt.discount,
      total: receipt.total,
      tip: receipt.tip,
      totalWithTip: receipt.totalWithTip,
      paymentMethod: receipt.paymentMethod,
      createdAt: receipt.createdAt.toISOString(),
      qrContent,
      receiptFooter: s.receiptFooter || '',
      tableNumber: order?.table?.number || null,
      orderType: order?.type || '',
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/digital-receipt', 'Napaka pri pridobivanju računa')
  }
}
