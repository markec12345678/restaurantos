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
        metrics: { onTimeDelivery: 0, quality: 0, price: 0 },
        stats: { totalPOs: 0, receivedPOs: 0, partialPOs: 0, cancelledPOs: 0, totalValue: 0 },
      })
    }

    // Osnovne statistike
    const receivedPOs = purchaseOrders.filter(po => po.status === 'received').length
    const partialPOs = purchaseOrders.filter(po => po.status === 'partial').length
    const cancelledPOs = purchaseOrders.filter(po => po.status === 'cancelled').length
    const draftPOs = purchaseOrders.filter(po => po.status === 'draft').length
    const totalValue = purchaseOrders.reduce((sum, po) => sum + toNum(po.totalAmount), 0)

    // Točnost dostave: koliko % vseh PO-jev je bilo popolnoma prejetih
    const onTimeDelivery = totalPOs > 0 ? Math.round((receivedPOs / totalPOs) * 100) : 0

    // ─────────────────────────────────────────────────────────────
    // FIX Bug #3 (Critical): Quality se je povečevala kljub delnemu prejemu.
    //
    // PRAVI VZROK (končno): Prejšnja kalkulacija je uporabljala "overall
    // fillRate" = totalReceivedQty / totalOrderedQty. Ko je nov prejem
    // (npr. 27/30 = 90%) imel višji fill rate od dosedanjega povprečja
    // (32.8%), je dodajanje tega prejema POVEČALO overall fillRate —
    // kar je napačno povečalo quality.
    //
    // NOVA KALKULACIJA: Quality = odstotek PREJETIH PO-jev BREZ shortage.
    //
    // "Prejeti PO-ji" = PO-ji s statusom 'partial' ali 'received'
    //   (vsaj nekaj blaga je bilo dejansko prejetega).
    // "Brez shortage" = VSE postavke v PO-ju imajo
    //   quantityReceived >= quantityOrdered.
    //
    // Quality = (PO-ji brez shortage / vsi prejeti PO-ji) × 100
    //
    // Ta formula GARANTIRA da quality VEDNO pade ko je nov shortage:
    // - Nov shortage PO → števec brez shortage ostane enak,
    //   števec vseh prejetih +1 → ratio PADE. ✅
    // - Nov PO brez shortage → oba števca +1 → ratio OSTANE/RASTE. ✅
    // ─────────────────────────────────────────────────────────────

    // Samo PO-ji pri katerih je bil dejanssko izveden prejem (partial ali received)
    const receivedPOList = purchaseOrders.filter(po =>
      po.status === 'partial' || po.status === 'received'
    )

    const totalReceivedPOCount = receivedPOList.length

    // Preštej koliko od teh PO-jev je bilo prejetih BREZ shortage
    // (vse postavke popolnoma prejete)
    let posWithoutShortage = 0
    let posWithShortage = 0
    let totalShortageQty = 0

    for (const po of receivedPOList) {
      if (!Array.isArray(po.items) || po.items.length === 0) continue
      let hasShortage = false
      for (const item of po.items) {
        const ordered = toNum(item.quantityOrdered)
        const received = toNum(item.quantityReceived)
        if (ordered > 0 && received < ordered) {
          hasShortage = true
          totalShortageQty += (ordered - received)
        }
      }
      if (hasShortage) {
        posWithShortage++
      } else {
        posWithoutShortage++
      }
    }

    // Quality = odstotek prejetih PO-jev brez shortage
    const quality = totalReceivedPOCount > 0
      ? Math.round((posWithoutShortage / totalReceivedPOCount) * 100)
      : 0

    // Sekundarna metrika: fill rate (za referenco, ne vpliva na quality)
    let totalReceivedQty = 0
    let totalOrderedQty = 0
    for (const po of receivedPOList) {
      if (!Array.isArray(po.items)) continue
      for (const item of po.items) {
        const ordered = toNum(item.quantityOrdered)
        const received = toNum(item.quantityReceived)
        if (ordered > 0) {
          totalOrderedQty += ordered
          totalReceivedQty += Math.min(received, ordered)
        }
      }
    }
    const fillRate = totalOrderedQty > 0 ? Math.round((totalReceivedQty / totalOrderedQty) * 100) : 0

    // Cena: placeholder (potrebuje benchmark podatke)
    const price = 75

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
      },
      stats: {
        totalPOs,
        receivedPOs,
        partialPOs,
        cancelledPOs,
        draftPOs,
        totalValue: Math.round(totalValue * 100) / 100,
        // Debug podatki za quality kalkulacijo
        receivedPOCount: totalReceivedPOCount,
        posWithoutShortage,
        posWithShortage,
        totalShortageQty: Math.round(totalShortageQty * 100) / 100,
        totalOrderedQty: Math.round(totalOrderedQty * 100) / 100,
        totalReceivedQty: Math.round(totalReceivedQty * 100) / 100,
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/suppliers/[id]/scorecard', 'Napaka pri pridobivanju ocen')
  }
}
