import { SupplierRow, PurchaseOrderRow } from '@/lib/types'
import type { SupplierScore } from './constants'

// ============================================
// Scoring logika za dobavitelje
// ============================================

export function computeSupplierScores(
  supData: SupplierRow[],
  poData: PurchaseOrderRow[],
): SupplierScore[] {
  return (supData || []).map((sup: SupplierRow) => {
    const supplierOrders = (poData || []).filter((po: PurchaseOrderRow) => po.supplierId === sup.id)

    // Izračunaj metrike
    const onTimeOrders = supplierOrders.filter((po: PurchaseOrderRow) => {
      if (!po.expectedDate || !po.receivedDate) return true
      return new Date(po.receivedDate) <= new Date(po.expectedDate)
    })
    const onTimeDelivery = supplierOrders.length > 0
      ? Math.round((onTimeOrders.length / supplierOrders.length) * 100)
      : 80 // Privzeto

    const totalSpent = supplierOrders.reduce((s: number, po: PurchaseOrderRow) => s + (po.total || 0), 0)
    const totalOrders = supplierOrders.length

    const avgDeliveryDays = supplierOrders.length > 0
      ? supplierOrders.reduce((s: number, po: PurchaseOrderRow) => {
          if (po.orderDate && po.receivedDate) {
            return s + (new Date(po.receivedDate).getTime() - new Date(po.orderDate).getTime()) / (1000 * 60 * 60 * 24)
          }
          return s + 3
        }, 0) / supplierOrders.length
      : 3

    // FIX HIGH: Deterministične metrike iz zgodovinskih podatkov (ne random!)
    const qualityRating = Math.min(100, Math.round(onTimeDelivery * 0.8 + (totalOrders > 0 ? 20 : 0)))
    const priceCompetitiveness = Math.min(100, Math.round(50 + (totalOrders > 5 ? 25 : totalOrders * 5) + (totalSpent > 1000 ? 25 : 0)))
    const responsiveness = Math.min(100, Math.round(Math.max(30, 100 - (avgDeliveryDays - 1) * 15)))

    // FIX: Pridobi težave PRED uporabo v orderAccuracy
    const recentIssues: string[] = []
    if (onTimeDelivery < 70) recentIssues.push('Pozna dobava')
    if (qualityRating < 70) recentIssues.push('Slaba kakovost')
    if (responsiveness < 65) recentIssues.push('Počasen odziv')

    const orderAccuracy = Math.min(100, Math.round(75 + (totalOrders > 3 ? 15 : totalOrders * 5) + (recentIssues.length === 0 ? 10 : 0)))
    if (orderAccuracy < 75) recentIssues.push('Netočna naročila')

    const overallScore = Math.round(
      onTimeDelivery * 0.25 +
      qualityRating * 0.25 +
      priceCompetitiveness * 0.20 +
      responsiveness * 0.15 +
      orderAccuracy * 0.15
    )

    const trend: 'up' | 'down' | 'stable' = overallScore >= 85 ? 'up' : overallScore >= 65 ? 'stable' : 'down'

    let tier: 'preferred' | 'standard' | 'probation' = 'standard'
    if (overallScore >= 85) tier = 'preferred'
    else if (overallScore < 60) tier = 'probation'

    return {
      id: sup.id,
      name: sup.name || 'Neznan dobavitelj',
      contactPerson: sup.contactPerson || (typeof sup.contact === 'string' ? sup.contact : null),
      phone: sup.phone || null,
      email: sup.email || null,
      category: typeof sup.category === 'string' && sup.category ? sup.category : 'Splošno',
      overallScore,
      metrics: {
        onTimeDelivery,
        qualityRating,
        priceCompetitiveness,
        responsiveness,
        orderAccuracy,
      },
      totalOrders,
      totalSpent,
      avgDeliveryDays: Math.round(avgDeliveryDays * 10) / 10,
      lastOrderDate: supplierOrders.length > 0
        ? supplierOrders.sort((a: PurchaseOrderRow, b: PurchaseOrderRow) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt
        : null,
      trend,
      recentIssues,
      tier,
    }
  })
}
