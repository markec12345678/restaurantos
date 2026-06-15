'use client'

import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Factory, RefreshCw } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { SupplierScore, SortBy } from './vendor/constants'
import { computeSupplierScores } from './vendor/computeSupplierScores'

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

      const scored = computeSupplierScores(supData, poData)
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
