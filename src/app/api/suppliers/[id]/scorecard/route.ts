// GET /api/suppliers/[id]/scorecard — Ocene dobavitelja
// Vrne oceno dobavitelja (točnost dostave, kakovost, cena) na podlagi
// nabavnih naročil in prejemov blaga.
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { toNum } from '@/lib/decimal'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { id } = await params

    const supplier = await db.supplier.findUnique({
      where: { id },
      select: { id: true, name: true, rating: true },
    })
    if (!supplier) return NextResponse.json({ error: 'Dobavitelj ni najden' }, { status: 404 })

    // Pridobi vsa PO za tega dobavitelja
    const purchaseOrders = await db.purchaseOrder.findMany({
      where: { supplierId: id },
      include: {
        items: { select: { quantityOrdered: true, quantityReceived: true, status: true } },
      },
      orderBy: { orderDate: 'desc' },
      take: 50,
    })

    const totalPOs = purchaseOrders.length
    if (totalPOs === 0) {
      return NextResponse.json({
        supplierId: id,
        supplierName: supplier.name,
        totalScore: 0,
        metrics: {
          onTimeDelivery: 0,
          quality: 0,
          price: 0,
        },
        stats: {
          totalPOs: 0,
          receivedPOs: 0,
          partialPOs: 0,
          cancelledPOs: 0,
          totalValue: 0,
        },
      })
    }

    // Izračunaj metrike
    const receivedPOs = purchaseOrders.filter(po => po.status === 'received').length
    const partialPOs = purchaseOrders.filter(po => po.status === 'partial').length
    const cancelledPOs = purchaseOrders.filter(po => po.status === 'cancelled').length
    const totalValue = purchaseOrders.reduce((sum, po) => sum + toNum(po.totalAmount), 0)

    // Točnost dostave: koliko PO-jev je bilo popolnoma prejetih
    const onTimeDelivery = totalPOs > 0 ? Math.round((receivedPOs / totalPOs) * 100) : 0

    // FIX Bug #3 (Critical): Quality se je povečevala kljub delnemu prejemu.
    //
    // PRAVI VZROK (prej zamudjen): Draft PO-ji (z 0 prejetih postavk) so
    // zniževali totalReceivedQty/totalOrderedQty ratio. Ko je uporabnik
    // ustvaril nov PO in ga delno prejel (0→7 od 10), se je totalReceivedQty
    // povečal — kar je povečalo fillRate in s tem quality.
    //
    // POPRAVEK: Izključi draft PO-je iz quality kalkulacije.
    // Samo PO-ji ki so bili oddani (submitted/approved/partial/received)
    // se upoštevajo pri quality oceni. Draft PO-ji še niso poslani
    // dobavitelju — ne morejo vplivati na quality.
    const activePOs = purchaseOrders.filter(po =>
      po.status === 'submitted' || po.status === 'approved' ||
      po.status === 'partial' || po.status === 'received'
    )

    // Quality: fill rate + completeness (samo za aktivne PO-je, ne draft)
    let totalReceivedQty = 0
    let totalOrderedQty = 0
    let fullyReceivedItems = 0
    let totalItems = 0
    for (const po of activePOs) {
      if (!Array.isArray(po.items)) continue
      for (const item of po.items) {
        const ordered = toNum(item.quantityOrdered)
        const received = toNum(item.quantityReceived)
        if (ordered > 0) {
          totalOrderedQty += ordered
          totalReceivedQty += Math.min(received, ordered) // Ne preseži naročenega
          totalItems++
          if (received >= ordered) {
            fullyReceivedItems++
          }
        }
      }
    }
    // Fill rate: koliko % naročene količine je bilo prejete (shortage zmanjša)
    const fillRate = totalOrderedQty > 0 ? Math.round((totalReceivedQty / totalOrderedQty) * 100) : 0
    // Popolnost: koliko % postavk je bilo popolnoma prejetih (brez shortage)
    const completeness = totalItems > 0 ? Math.round((fullyReceivedItems / totalItems) * 100) : 0
    // Quality = povprečje fill rate in completeness (obe kaznujeta shortage)
    const quality = Math.round((fillRate + completeness) / 2)

    // Cena: placeholder (potrebuje benchmark podatke)
    const price = 75 // Default ocena brez benchmark podatkov

    // Skupna ocena (uteženo povprečje)
    const totalScore = Math.round(onTimeDelivery * 0.4 + quality * 0.35 + price * 0.25)

    return NextResponse.json({
      supplierId: id,
      supplierName: supplier.name,
      totalScore,
      metrics: {
        onTimeDelivery,
        quality,
        price,
        fillRate,
        completeness,
      },
      stats: {
        totalPOs,
        receivedPOs,
        partialPOs,
        cancelledPOs,
        draftPOs: purchaseOrders.filter(po => po.status === 'draft').length,
        totalValue: Math.round(totalValue * 100) / 100,
        totalOrderedQty: Math.round(totalOrderedQty * 100) / 100,
        totalReceivedQty: Math.round(totalReceivedQty * 100) / 100,
        activeItemsCount: totalItems,
        fullyReceivedItems,
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/suppliers/[id]/scorecard', 'Napaka pri pridobivanju ocen')
  }
}
