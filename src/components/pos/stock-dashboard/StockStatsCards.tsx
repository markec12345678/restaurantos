'use client'

import { memo } from 'react'
import { XCircle, AlertTriangle, Package, BarChart3 } from 'lucide-react'

// ============================================
// STATISTIČNE KARTICE ZA STANJE ZALOGE
// ============================================

interface StockStatsCardsProps {
  stats: {
    total: number
    outOfStock: number
    critical: number
    low: number
    ok: number
  }
  filter: 'all' | 'critical' | 'low' | 'ok'
  setFilter: (_filter: 'all' | 'critical' | 'low' | 'ok') => void
}

export const StockStatsCards = memo(function StockStatsCards({ stats, filter, setFilter }: StockStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <button
        onClick={() => setFilter('critical')}
        className={`text-left p-3 rounded-lg border-2 transition-all ${
          filter === 'critical' ? 'border-red-500 shadow-md' : 'border-transparent'
        } ${stats.outOfStock + stats.critical > 0 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-muted/50'}`}
      >
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-red-600" />
          <span className="text-xs text-muted-foreground">Kritično</span>
        </div>
        <p className="text-xl font-bold text-red-600">{stats.outOfStock + stats.critical}</p>
      </button>
      <button
        onClick={() => setFilter('low')}
        className={`text-left p-3 rounded-lg border-2 transition-all ${
          filter === 'low' ? 'border-amber-500 shadow-md' : 'border-transparent'
        } ${stats.low > 0 ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-muted/50'}`}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="text-xs text-muted-foreground">Nizka zal.</span>
        </div>
        <p className="text-xl font-bold text-amber-600">{stats.low}</p>
      </button>
      <button
        onClick={() => setFilter('ok')}
        className={`text-left p-3 rounded-lg border-2 transition-all ${
          filter === 'ok' ? 'border-emerald-500 shadow-md' : 'border-transparent'
        } bg-emerald-50 dark:bg-emerald-950/20`}
      >
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-emerald-600" />
          <span className="text-xs text-muted-foreground">V redu</span>
        </div>
        <p className="text-xl font-bold text-emerald-600">{stats.ok}</p>
      </button>
      <button
        onClick={() => setFilter('all')}
        className={`text-left p-3 rounded-lg border-2 transition-all ${
          filter === 'all' ? 'border-primary shadow-md' : 'border-transparent'
        } bg-muted/50`}
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Skupaj</span>
        </div>
        <p className="text-xl font-bold">{stats.total}</p>
      </button>
    </div>
  )
})
