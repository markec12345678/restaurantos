'use client'

import { useState, useEffect, memo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { SupplierRow, PurchaseOrderRow } from '@/lib/types'
import { toast } from 'sonner'
import { Factory, Phone, Mail, CheckCircle, AlertTriangle, XCircle, Truck, Package, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react'

interface SupplierScore {
  id: string
  name: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  category: string
  overallScore: number // 0-100
  metrics: {
    onTimeDelivery: number  // 0-100
    qualityRating: number   // 0-100
    priceCompetitiveness: number // 0-100
    responsiveness: number  // 0-100
    orderAccuracy: number   // 0-100
  }
  totalOrders: number
  totalSpent: number
  avgDeliveryDays: number
  lastOrderDate: string | null
  trend: 'up' | 'down' | 'stable'
  recentIssues: string[]
  tier: 'preferred' | 'standard' | 'probation'
}

export const VendorScorecard = memo(function VendorScorecard() {
  const [suppliers, setSuppliers] = useState<SupplierScore[]>([])
  const [_loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'score' | 'delivery' | 'quality' | 'price'>('score')

  useEffect(() => {
    loadSuppliers()
  }, [])

  const loadSuppliers = async () => {
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
  }

  const sortedSuppliers = [...suppliers].sort((a, b) => {
    switch (sortBy) {
      case 'score': return b.overallScore - a.overallScore
      case 'delivery': return b.metrics.onTimeDelivery - a.metrics.onTimeDelivery
      case 'quality': return b.metrics.qualityRating - a.metrics.qualityRating
      case 'price': return b.metrics.priceCompetitiveness - a.metrics.priceCompetitiveness
      default: return 0
    }
  })

  const avgScore = suppliers.length > 0
    ? Math.round(suppliers.reduce((s, sup) => s + sup.overallScore, 0) / suppliers.length)
    : 0
  const preferredCount = suppliers.filter(s => s.tier === 'preferred').length
  const probationCount = suppliers.filter(s => s.tier === 'probation').length

  const tierConfig = {
    preferred: { label: 'Prednostni', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
    standard: { label: 'Standardni', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: BarChart3 },
    probation: { label: 'Na preizkusu', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
  }

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600'
    if (score >= 70) return 'text-amber-600'
    return 'text-red-600'
  }

  const getScoreBg = (score: number) => {
    if (score >= 85) return 'bg-green-500'
    if (score >= 70) return 'bg-amber-500'
    return 'bg-red-500'
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(amount)
  }

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
        <Button size="sm" variant="outline" onClick={loadSuppliers}>
          <RefreshCw className="h-3 w-3 mr-1" /> Osveži
        </Button>
      </div>

      {/* Povzetek */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Factory className="h-5 w-5 text-violet-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{suppliers.length}</p>
            <p className="text-xs text-muted-foreground">Dobavitelji</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <BarChart3 className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{avgScore}/100</p>
            <p className="text-xs text-muted-foreground">Povprečna ocena</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{preferredCount}</p>
            <p className="text-xs text-muted-foreground">Prednostni</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{probationCount}</p>
            <p className="text-xs text-muted-foreground">Na preizkusu</p>
          </CardContent>
        </Card>
      </div>

      {/* Sortiranje */}
      <div className="flex gap-2">
        {[
          { key: 'score', label: 'Skupna ocena' },
          { key: 'delivery', label: 'Dobava' },
          { key: 'quality', label: 'Kakovost' },
          { key: 'price', label: 'Cena' },
        ].map(s => (
          <Button
            key={s.key}
            variant={sortBy === s.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy(s.key as typeof sortBy)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      {/* Seznam dobaviteljev */}
      <div className="space-y-3">
        {sortedSuppliers.map((supplier, idx) => {
          const tierConf = tierConfig[supplier.tier]
          const TierIcon = tierConf.icon
          const TrendIcon = supplier.trend === 'up' ? ArrowUpRight : supplier.trend === 'down' ? ArrowDownRight : BarChart3

          return (
            <Card key={supplier.id} className="transition-all hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Ranking */}
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-bold ${getScoreBg(supplier.overallScore)}`}>
                    #{idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-lg">{supplier.name}</span>
                      <Badge className={tierConf.color}>
                        <TierIcon className="h-3 w-3 mr-1" /> {tierConf.label}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{supplier.category}</Badge>
                      <div className={`flex items-center gap-1 text-sm ${supplier.trend === 'up' ? 'text-green-600' : supplier.trend === 'down' ? 'text-red-600' : 'text-gray-500'}`}>
                        <TrendIcon className="h-4 w-4" />
                      </div>
                    </div>

                    {/* Kontakt podatki */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      {supplier.phone && (
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {supplier.phone}</span>
                      )}
                      {supplier.email && (
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {supplier.email}</span>
                      )}
                      <span className="flex items-center gap-1"><Truck className="h-3 w-3" /> {supplier.avgDeliveryDays} dni</span>
                      <span className="flex items-center gap-1"><Package className="h-3 w-3" /> {supplier.totalOrders} naročil</span>
                      <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> {formatCurrency(supplier.totalSpent)}</span>
                    </div>

                    {/* Metrike */}
                    <div className="grid grid-cols-5 gap-3">
                      {[
                        { label: 'Točnost dobave', value: supplier.metrics.onTimeDelivery },
                        { label: 'Kakovost', value: supplier.metrics.qualityRating },
                        { label: 'Cenovna konkurenčnost', value: supplier.metrics.priceCompetitiveness },
                        { label: 'Odzivnost', value: supplier.metrics.responsiveness },
                        { label: 'Točnost naročil', value: supplier.metrics.orderAccuracy },
                      ].map(metric => (
                        <div key={metric.label}>
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span className="truncate">{metric.label}</span>
                            <span className={`font-medium ${getScoreColor(metric.value)}`}>{metric.value}</span>
                          </div>
                          <Progress
                            value={metric.value}
                            className={`h-1.5 [&>div]:${metric.value >= 85 ? 'bg-green-500' : metric.value >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                            aria-valuetext={metric.value >= 85 ? 'Odlična ocena' : metric.value >= 70 ? 'Zadostna ocena' : 'Slaba ocena'}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Skupna ocena */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Skupna ocena:</span>
                        <span className={`text-xl font-bold ${getScoreColor(supplier.overallScore)}`}>
                          {supplier.overallScore}/100
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {supplier.recentIssues.map((issue, i) => (
                          <Badge key={i} variant="destructive" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" /> {issue}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

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
