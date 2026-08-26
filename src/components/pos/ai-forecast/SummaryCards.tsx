'use client'

// ============================================
// Povzetek — kartice z metrikami
// ============================================

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, Zap, ShoppingCart, Package, BarChart3 } from 'lucide-react'
import type { SummaryCardsProps } from './constants'

export const SummaryCards = memo(function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Card className="border-red-200 dark:border-red-900/50">
        <CardContent className="p-4 text-center">
          <AlertTriangle className="h-6 w-6 mx-auto text-red-500 mb-1" />
          <p className="text-3xl font-bold text-red-600">{summary?.criticalItems || 0}</p>
          <p className="text-xs text-muted-foreground">Kritično</p>
        </CardContent>
      </Card>
      <Card className="border-amber-200 dark:border-amber-900/50">
        <CardContent className="p-4 text-center">
          <Zap className="h-6 w-6 mx-auto text-amber-500 mb-1" />
          <p className="text-3xl font-bold text-amber-600">{summary?.highRiskItems || 0}</p>
          <p className="text-xs text-muted-foreground">Visoko tveganje</p>
        </CardContent>
      </Card>
      <Card className="border-blue-200 dark:border-blue-900/50">
        <CardContent className="p-4 text-center">
          <ShoppingCart className="h-6 w-6 mx-auto text-blue-500 mb-1" />
          <p className="text-3xl font-bold text-blue-600">{summary?.needsReorderCount || 0}</p>
          <p className="text-xs text-muted-foreground">Potrebuje naročilo</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <Package className="h-6 w-6 mx-auto text-primary mb-1" />
          <p className="text-3xl font-bold">{summary?.totalItems || 0}</p>
          <p className="text-xs text-muted-foreground">Skupaj artiklov</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <BarChart3 className="h-6 w-6 mx-auto text-primary mb-1" />
          <p className="text-3xl font-bold">{Math.round((summary?.avgConfidence || 0) * 100)}%</p>
          <p className="text-xs text-muted-foreground">Povp. zaupanje</p>
        </CardContent>
      </Card>
    </div>
  )
})
