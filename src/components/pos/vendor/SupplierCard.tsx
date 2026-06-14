'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Phone, Mail, Truck, Package, DollarSign, ArrowUpRight, ArrowDownRight, BarChart3, XCircle } from 'lucide-react'
import { TIER_CONFIG, getScoreColor, getScoreBg, formatCurrency } from './constants'
import type { SupplierCardProps } from './constants'

// ============================================
// KARTICA DOBAVITELJA — Prikaz posameznega dobavitelja
// ============================================

export const SupplierCard = memo(function SupplierCard({ supplier, rank }: SupplierCardProps) {
  const tierConf = TIER_CONFIG[supplier.tier]
  const TierIcon = tierConf.icon
  const TrendIcon = supplier.trend === 'up' ? ArrowUpRight : supplier.trend === 'down' ? ArrowDownRight : BarChart3

  return (
    <Card className="transition-all hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Ranking */}
          <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-bold ${getScoreBg(supplier.overallScore)}`}>
            #{rank}
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
})
