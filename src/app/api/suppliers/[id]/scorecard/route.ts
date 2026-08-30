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
    // Prej: quality = (popolnoma prejete postavke / vse postavke) * 100
    //   — to se je lahko povečalo kadar je nova postavka prejela nekaj (0→4 od 5),
    //   ker so druge postavke bile prej 0 in sedaj niso več "0 prejeto".
    //   Ampak 4/5 ni "popolnoma prejeto" — to je SHORTAGE.
    //
    // Sedaj: quality = (skupna prejeta količina / skupna naročena količina) * 100
    //   — to je "fill rate" ki pravilno KAZNUJE shortage.
    //   Primer: 4/5 prejeto = 80% quality (ne 0% kot prej, ampak tudi ne 100%).
    //   Če je shortage (4 namesto 5), quality pade z 100% na 80%.
    let totalReceivedQty = 0
    let totalOrderedQty = 0
    let fullyReceivedItems = 0
    let totalItems = 0
    for (const po of purchaseOrders) {
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
        // Dodatne metrike za transparentnost
        fillRate,
        completeness,
      },
      stats: {
        totalPOs,
        receivedPOs,
        partialPOs,
        cancelledPOs,
        totalValue: Math.round(totalValue * 100) / 100,
        totalOrderedQty: Math.round(totalOrderedQty * 100) / 100,
        totalReceivedQty: Math.round(totalReceivedQty * 100) / 100,
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/suppliers/[id]/scorecard', 'Napaka pri pridobivanju ocen')
  }
}
