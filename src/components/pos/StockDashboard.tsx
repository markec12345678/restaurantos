'use client'

// ============================================
// REAL-TIME STOCK DASHBOARD
// Komponenta za prikaz stanja zaloge na POS zaslonu
// Osvežuje se vsakih 30s + WebSocket LOW_STOCK obvestila
// ============================================

import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Package, AlertTriangle, XCircle, TrendingDown,
  ArrowDownCircle, ArrowUpCircle, RefreshCw, BarChart3,
} from 'lucide-react'
import { useMemo, useState, memo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'

// ============================================
// TIPI
// ============================================

interface StockItem {
  id: string
  name: string
  unit: string
  quantity: number
  minQuantity: number
  costPerUnit: number
  servingsPerUnit: number
  category: string
  supplier: string
  menuItem?: { id: string; name: string; price: number } | null
  _lastTransaction?: { createdAt: string; type: string } | null
}

interface _StockAlert {
  inventoryItemId: string
  name: string
  currentQty: number
  minQty: number
  severity: 'low_stock' | 'out_of_stock'
}

// ============================================
// KOMPONENTA
// ============================================

export const StockDashboard = memo(function StockDashboard() {
  const [filter, setFilter] = useState<'all' | 'critical' | 'low' | 'ok'>('all')

  // ─── PODATKI O ZALOGI ───
  const { data: items, isLoading, refetch } = useQuery<StockItem[]>({
    queryKey: [...queryKeys.inventory.all, 'stock-dashboard'],
    queryFn: async () => {
      const res = await authFetch('/api/inventory')
      if (!res.ok) return []
      return res.json()
    },
    refetchInterval: 30000,
    staleTime: 20000,
  })

  // ─── MENU STOCK MAP (za prikaz na gumbih) ───
  const { data: menuStockMap } = useQuery<Record<string, { status: string; available: number; unit: string }>>({
    queryKey: queryKeys.inventory.menuStock,
    queryFn: async () => {
      try {
        const res = await authFetch('/api/inventory/menu-stock')
        if (!res.ok) return {}
        return res.json()
      } catch {
        return {}
      }
    },
    refetchInterval: 30000,
    staleTime: 20000,
  })

  // ─── IZRAČUNI ───
  const stats = useMemo(() => {
    const list = items || []
    const total = list.length
    const outOfStock = list.filter(i => i.quantity <= 0).length
    const critical = list.filter(i => i.quantity > 0 && i.quantity <= i.minQuantity * 0.5).length
    const low = list.filter(i => i.quantity > i.minQuantity * 0.5 && i.quantity <= i.minQuantity).length
    const ok = total - outOfStock - critical - low
    const totalValue = list.reduce((sum, i) => sum + i.quantity * i.costPerUnit, 0)
    const menuItemsTracked = Object.keys(menuStockMap || {}).length
    return { total, outOfStock, critical, low, ok, totalValue, menuItemsTracked }
  }, [items, menuStockMap])

  const filteredItems = useMemo(() => {
    const list = items || []
    switch (filter) {
      case 'critical':
        return list.filter(i => i.quantity <= 0 || i.quantity <= i.minQuantity * 0.5)
      case 'low':
        return list.filter(i => i.quantity > i.minQuantity * 0.5 && i.quantity <= i.minQuantity)
      case 'ok':
        return list.filter(i => i.quantity > i.minQuantity)
      default:
        return list
    }
  }, [items, filter])

  // ─── POMOŽNE FUNKCIJE ───
  const stockLevelColor = (qty: number, minQty: number) => {
    if (qty <= 0) return 'text-red-600'
    if (qty <= minQty * 0.5) return 'text-orange-600'
    if (qty <= minQty) return 'text-amber-600'
    return 'text-emerald-600'
  }

  const stockLevelBg = (qty: number, minQty: number) => {
    if (qty <= 0) return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40'
    if (qty <= minQty * 0.5) return 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/40'
    if (qty <= minQty) return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40'
    return 'bg-card border-border'
  }

  const progressColor = (pct: number) => {
    if (pct <= 10) return 'bg-red-500'
    if (pct <= 30) return 'bg-orange-500'
    if (pct <= 60) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  const progressLabel = (pct: number) => {
    if (pct <= 10) return 'Kritično nizka zaloga'
    if (pct <= 30) return 'Nizka zaloga'
    if (pct <= 60) return 'Zmerna zaloga'
    return 'Zadostna zaloga'
  }

  const formatCurrency = (n: number) => `€${n.toFixed(2)}`

  // ─── RENDER ───
  return (
    <div className="space-y-4">
      {/* Glava */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Package className="h-5 w-5" />
            Stanje zaloge
          </h3>
          <p className="text-sm text-muted-foreground">
            Skupna vrednost zaloge: <span className="font-semibold">{formatCurrency(stats.totalValue)}</span>
            {stats.menuItemsTracked > 0 && ` · ${stats.menuItemsTracked} meni artiklov sledenih`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs gap-1">
          <RefreshCw className="h-3.5 w-3.5" />
          Osveži
        </Button>
      </div>

      {/* Statistika kartice */}
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

      {/* Seznam artiklov */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {filter === 'ok' ? 'Vsi artikli imajo nizko ali kritično zalogo!' : 'Ni artiklov v tej kategoriji'}
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-1.5 pr-2">
            {filteredItems
              .sort((a, b) => a.quantity / Math.max(a.minQuantity, 1) - b.quantity / Math.max(b.minQuantity, 1))
              .map(item => {
                const pct = item.minQuantity > 0
                  ? Math.min((item.quantity / (item.minQuantity * 2)) * 100, 100)
                  : 100
                const servings = Math.floor(item.quantity * item.servingsPerUnit)

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border ${stockLevelBg(item.quantity, item.minQuantity)}`}
                  >
                    {/* Status indikator */}
                    <div className="flex-shrink-0">
                      {item.quantity <= 0 ? (
                        <XCircle className="h-5 w-5 text-red-600" />
                      ) : item.quantity <= item.minQuantity * 0.5 ? (
                        <TrendingDown className="h-5 w-5 text-orange-600" />
                      ) : item.quantity <= item.minQuantity ? (
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                      ) : (
                        <Package className="h-5 w-5 text-emerald-600" />
                      )}
                    </div>

                    {/* Podatki */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{item.name}</span>
                        {item.menuItem && (
                          <Badge variant="outline" className="text-[8px] h-4 px-1 flex-shrink-0">
                            → {item.menuItem.name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-valuetext={progressLabel(pct)}>
                          <div
                            className={`h-full rounded-full transition-all ${progressColor(pct)}`}
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold flex-shrink-0 ${stockLevelColor(item.quantity, item.minQuantity)}`}>
                          {item.quantity} / {item.minQuantity} {item.unit}
                        </span>
                      </div>
                      {item.servingsPerUnit > 1 && (
                        <span className="text-[10px] text-muted-foreground">
                          ≈ {servings} servisov · {formatCurrency(item.costPerUnit)}/{item.unit}
                        </span>
                      )}
                    </div>

                    {/* Hitra dejanja */}
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Nabava"
                        className="h-7 w-7 text-green-600"
                        title="Nabava"
                        onClick={() => {
                          // Trigger stock restock dialog — parent component handles this
                          const event = new CustomEvent('stock-restock', { detail: { itemId: item.id } })
                          window.dispatchEvent(event)
                        }}
                      >
                        <ArrowDownCircle className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Razknjižba"
                        className="h-7 w-7 text-red-600"
                        title="Razknjižba"
                        onClick={() => {
                          const event = new CustomEvent('stock-writeoff', { detail: { itemId: item.id } })
                          window.dispatchEvent(event)
                        }}
                      >
                        <ArrowUpCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
          </div>
        </ScrollArea>
      )}
    </div>
  )
})
