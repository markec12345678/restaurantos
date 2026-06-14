'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Store, CheckCircle2, Users, ShoppingBag } from 'lucide-react'
import type { LocationData } from './types'

// ============================================
// GLOBALNE STATISTIČNE KARTICE
// ============================================
export const GlobalStatsCards = memo(function GlobalStatsCards({ locations }: { locations: LocationData[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Store className="h-4 w-4 text-indigo-600" />
            <span className="text-xs text-muted-foreground">Skupaj lokacij</span>
          </div>
          <div className="text-2xl font-bold text-indigo-600">{locations.length}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-xs text-muted-foreground">Odprte</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{locations.filter(l => l.isOpen).length}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-purple-600" />
            <span className="text-xs text-muted-foreground">Skupaj zaposlenih</span>
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {locations.reduce((sum, l) => sum + (l._count?.employees || 0), 0)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag className="h-4 w-4 text-amber-600" />
            <span className="text-xs text-muted-foreground">Skupaj mize</span>
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {locations.reduce((sum, l) => sum + (l._count?.tables || 0), 0)}
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
