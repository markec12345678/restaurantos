'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import { ChefHat, Wifi } from 'lucide-react'
import { KitchenOrderCard } from './KitchenOrderCard'
import type { EnrichedOrder } from './types'

const KitchenCardsView = dynamic(() => import('./KitchenCardsView').then(m => ({ default: m.KitchenCardsView })), { ssr: false })

// --- Props ---

interface KitchenMainContentProps {
  isLoading: boolean
  viewMode: 'cards' | 'list'
  filteredOrders: EnrichedOrder[]
  urgentOrders: EnrichedOrder[]
  warningOrders: EnrichedOrder[]
  normalOrders: EnrichedOrder[]
  /** R26-b: ready naročila (pick-up shelf) — vidna v 'all' in 'ready' filtru */
  readyOrders: EnrichedOrder[]
  onItemStatusChange: (_itemId: string, _status: string) => void
  onOrderStatusChange: (_orderId: string, _status: string) => void
  /** R26-b: bump = odstrani gotovo naročilo z ekrana (display akcija) */
  onBumpOrder: (_orderId: string) => void
  stationFilter: 'all' | 'kuhinja' | 'sank'
  wsConnected: boolean
  filterStatus: 'all' | 'pending' | 'in-progress' | 'ready'
}

// --- Komponenta ---

export const KitchenMainContent = memo(function KitchenMainContent({
  isLoading,
  viewMode,
  filteredOrders,
  urgentOrders,
  warningOrders,
  normalOrders,
  readyOrders,
  onItemStatusChange,
  onOrderStatusChange,
  onBumpOrder,
  stationFilter,
  wsConnected,
  filterStatus,
}: KitchenMainContentProps) {
  if (isLoading) {
    return (
      <div className={viewMode === 'cards'
        ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
        : 'space-y-3 max-w-4xl mx-auto'
      }>
        {[...Array(6)].map((_, i) => <Skeleton key={i} className={viewMode === 'cards' ? 'h-64' : 'h-32'} />)}
      </div>
    )
  }

  // R114 (ref #111): prazen zaslon NE sme prikriti pick-up police. Prej je
  // 'Vsa naročila' z 0 aktivnimi + N pripravljenimi prikazala "Kuhinja je
  // prosta", čeprav so bila gotova naročila na police (readyOrders prop je že
  // bil podan naprej v cards pogled). Pogled seznama ohrani prazno stanje
  // (polica je cards-only, filtriraj prek zavihka 'Pripravljeno').
  if (filteredOrders.length === 0 && (viewMode === 'list' || readyOrders.length === 0)) {
    const emptyCopy = filterStatus === 'ready'
      ? { title: 'Ni pripravljenih naročil', subtitle: 'Naročila se bodo tu pojavila, ko so vsi artikli pripravljeni' }
      : { title: 'Kuhinja je prosta', subtitle: 'Ni aktivnih naročil za pripravo' }
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <ChefHat className="h-16 w-16 opacity-20" />
        <div className="text-center">
          <p className="text-lg font-medium">{emptyCopy.title}</p>
          <p className="text-sm">{emptyCopy.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {wsConnected ? (
            <>
              <Wifi className="h-3 w-3 text-emerald-500" />
              Real-time povezava
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"><span className="sr-only">Osveževanje</span></span>
              Samodejno osveževanje vsakih 5s
            </>
          )}
        </div>
      </div>
    )
  }

  if (viewMode === 'cards') {
    return (
      <KitchenCardsView
        urgentOrders={urgentOrders}
        warningOrders={warningOrders}
        normalOrders={normalOrders}
        readyOrders={readyOrders}
        onItemStatusChange={onItemStatusChange}
        onOrderStatusChange={onOrderStatusChange}
        onBumpOrder={onBumpOrder}
        stationFilter={stationFilter}
      />
    )
  }

  /* LIST VIEW - Compact */
  return (
    <div className="space-y-3 max-w-5xl mx-auto">
      {filteredOrders.map(order => (
        <KitchenOrderCard
          key={order.id}
          order={order}
          onItemStatusChange={onItemStatusChange}
          onOrderStatusChange={onOrderStatusChange}
          viewMode="list"
          stationFilter={stationFilter}
        />
      ))}
    </div>
  )
})
