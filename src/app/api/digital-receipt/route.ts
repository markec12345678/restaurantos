import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { generateFursQRContent } from '@/lib/furs'

// GET /api/digital-receipt?id=xxx — Javno dostopen digitalni račun za goste
// Brez avtentikacije — gost dostopa preko QR kode ali linka
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const receiptId = searchParams.get('id')

    if (!receiptId) {
      return NextResponse.json({ error: 'Manjka ID računa' }, { status: 400 })
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
      try { modifiers = JSON.parse(oi.modifiersJson || '[]') } catch {}

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
        vatBreakdown.push({ rate: parseFloat(rate), base: a.base, vat: a.vat })
      }
    } catch {}

    // QR vsebina
    const qrContent = receipt.zoi ? generateFursQRContent({
      zoi: receipt.zoi,
      totalAmount: receipt.total,
      issueDateTime: receipt.createdAt,
      taxId: settings?.taxId || '',
      businessId: settings?.businessId || '',
      registerId: settings?.registerNumber || 'BLG-001',
      premisesId: settings?.businessId || '',
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
  } catch (error) {
    console.error('Digital receipt error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju računa' }, { status: 500 })
  }
}
