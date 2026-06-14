'use client'

import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Factory, RefreshCw } from 'lucide-react'
import { SupplierRow, PurchaseOrderRow } from '@/lib/types'
import dynamic from 'next/dynamic'
import type { SupplierScore, SortBy } from './vendor/constants'

// Lazy-loaded pod-komponente
const VendorSummaryCards = dynamic(() => import('./vendor/VendorSummaryCards').then((m) => m.VendorSummaryCards), { ssr: false })
const VendorSortBar = dynamic(() => import('./vendor/VendorSortBar').then((m) => m.VendorSortBar), { ssr: false })
const SupplierCard = dynamic(() => import('./vendor/SupplierCard').then((m) => m.SupplierCard), { ssr: false })

export const VendorScorecard = memo(function VendorScorecard() {
  const [suppliers, setSuppliers] = useState<SupplierScore[]>([])
  const [_loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortBy>('score')

  const loadSuppliers = useCallback(async () => {
    try {
      const [supRes, poRes] = await Promise.all([
        authFetch('/api/suppliers'),
        authFetch('/api/purchase-orders'),
      ])

      if (!supRes.ok) throw new Error('Napaka pri nalaganju dobaviteljev')
      if (!poRes.ok) throw new Error('Napaka pri nalaganju naročil')

      const supData = await supRes.json()
      const poData = await poRes.json()

      const scored: SupplierScore[] = (supData || []).map((sup: SupplierRow) => {
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
        // Kvaliteta: 100% če vsa naročila pravočasno, sicer nižja
        const qualityRating = Math.min(100, Math.round(onTimeDelivery * 0.8 + (totalOrders > 0 ? 20 : 0)))
        // Cenovna konkurenčnost: osnova iz količine naročil (več naročil = verjetno boljša cena)
        const priceCompetitiveness = Math.min(100, Math.round(50 + (totalOrders > 5 ? 25 : totalOrders * 5) + (totalSpent > 1000 ? 25 : 0)))
        // Odzivnost: iz povprečnega časa dobave (krajši = boljši)
        const responsiveness = Math.min(100, Math.round(Math.max(30, 100 - (avgDeliveryDays - 1) * 15)))

        // FIX: Pridobi težave PRED uporabo v orderAccuracy
        const recentIssues: string[] = []
        if (onTimeDelivery < 70) recentIssues.push('Pozna dobava')
        if (qualityRating < 70) recentIssues.push('Slaba kakovost')
        if (responsiveness < 65) recentIssues.push('Počasen odziv')

        // Natančnost naročil: začne pri 80%, se povečuje s številom uspešnih naročil
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
          contactPerson: sup.contactPerson || sup.contact || null,
          phone: sup.phone || null,
          email: sup.email || null,
          category: sup.category || 'Splošno',
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

      setSuppliers(scored)
    } catch {
      toast.error('Napaka pri nalaganju ocen dobaviteljev')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  const sortedSuppliers = useMemo(() => [...suppliers].sort((a, b) => {
    switch (sortBy) {
      case 'score': return b.overallScore - a.overallScore
      case 'delivery': return b.metrics.onTimeDelivery - a.metrics.onTimeDelivery
      case 'quality': return b.metrics.qualityRating - a.metrics.qualityRating
      case 'price': return b.metrics.priceCompetitiveness - a.metrics.priceCompetitiveness
      default: return 0
    }
  }), [suppliers, sortBy])

  const avgScore = suppliers.length > 0
    ? Math.round(suppliers.reduce((s, sup) => s + sup.overallScore, 0) / suppliers.length)
    : 0
  const preferredCount = suppliers.filter(s => s.tier === 'preferred').length
  const probationCount = suppliers.filter(s => s.tier === 'probation').length

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
            <Factory className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Ocenjevanje dobaviteljev</h2>
            <p className="text-sm text-muted-foreground">KPI-ji in ocene za vsakega dobavitelja</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={loadSuppliers} aria-label="Osveži podatke">
          <RefreshCw className="h-3 w-3 mr-1" /> Osveži
        </Button>
      </div>

      {/* Povzetek */}
      <VendorSummaryCards
        supplierCount={suppliers.length}
        avgScore={avgScore}
        preferredCount={preferredCount}
        probationCount={probationCount}
      />

      {/* Sortiranje */}
      <VendorSortBar sortBy={sortBy} onSortChange={setSortBy} />

      {/* Seznam dobaviteljev */}
      <div className="space-y-3">
        {sortedSuppliers.map((supplier, idx) => (
          <SupplierCard key={supplier.id} supplier={supplier} rank={idx + 1} />
        ))}

        {sortedSuppliers.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Factory className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-lg font-medium">Ni dobaviteljev</p>
              <p className="text-sm text-muted-foreground">Dodajte dobavitelje v upravitelju dobaviteljev</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
})
