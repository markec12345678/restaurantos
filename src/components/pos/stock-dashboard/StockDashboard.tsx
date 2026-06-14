'use client'

// ============================================
// REAL-TIME STOCK DASHBOARD
// Komponenta za prikaz stanja zaloge na POS zaslonu
// Osvežuje se vsakih 30s + WebSocket LOW_STOCK obvestila
// ============================================

import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Package, RefreshCw } from 'lucide-react'
import { useMemo, useState, memo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { StockStatsCards } from './StockStatsCards'
import { StockItemRow } from './StockItemRow'
import type { StockItem } from './types'

// Re-izvoz za združljivost
export type { StockItem } from './types'

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

  // ─── MENU STOCK MAP ───
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

  const formatCurrency = (n: number) => `€${n.toFixed(2)}`

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
      <StockStatsCards stats={stats} filter={filter} setFilter={setFilter} />

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
              .map(item => (
                <StockItemRow key={item.id} item={item} />
              ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
})
