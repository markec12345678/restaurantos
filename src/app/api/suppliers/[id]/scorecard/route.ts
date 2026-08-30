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

    // Kakovost: koliko postavk je bilo prejetih brez delnih prejemov
    const totalItems = purchaseOrders.reduce((sum, po) => sum + (Array.isArray(po.items) ? po.items.length : 0), 0)
    const fullyReceivedItems = purchaseOrders.reduce((sum, po) => {
      return sum + (Array.isArray(po.items) ? po.items.filter(i => toNum(i.quantityReceived) >= toNum(i.quantityOrdered) && toNum(i.quantityOrdered) > 0).length : 0)
    }, 0)
    const quality = totalItems > 0 ? Math.round((fullyReceivedItems / totalItems) * 100) : 0

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
      },
      stats: {
        totalPOs,
        receivedPOs,
        partialPOs,
        cancelledPOs,
        totalValue: Math.round(totalValue * 100) / 100,
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/suppliers/[id]/scorecard', 'Napaka pri pridobivanju ocen')
  }
}
