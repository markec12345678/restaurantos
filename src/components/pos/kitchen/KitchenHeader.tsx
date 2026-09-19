'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ChefHat, AlertTriangle, Volume2, VolumeX, RefreshCw,
  Grid3X3, List, Maximize, Minimize, Undo2,
} from 'lucide-react'
import type { KDSData } from './types'
import { slCount, CAKAJOC_FORMS, PRIPRAVLJENO_FORMS, NUJNO_FORMS } from '@/lib/sl-plural'

const KitchenFilterTabs = dynamic(
  () => import('./KitchenFilterTabs').then(m => ({ default: m.KitchenFilterTabs })),
  { ssr: false }
)
const KitchenStationFilter = dynamic(
  () => import('./KitchenStationFilter').then(m => ({ default: m.KitchenStationFilter })),
  { ssr: false }
)

// --- Props ---

interface KitchenHeaderProps {
  stats: KDSData['stats'] | undefined
  stationFilter: 'all' | 'kuhinja' | 'sank'
  onStationFilterChange: (_value: 'all' | 'kuhinja' | 'sank') => void
  soundEnabled: boolean
  onToggleSound: () => void
  viewMode: 'cards' | 'list'
  onViewModeChange: (_mode: 'cards' | 'list') => void
  onRefresh: () => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
  filterStatus: 'all' | 'pending' | 'in-progress' | 'ready'
  onFilterStatusChange: (_status: 'all' | 'pending' | 'in-progress' | 'ready') => void
  filteredOrdersCount: number
  pendingOrdersCount: number
  inProgressOrdersCount: number
  /** R26-b: vidna (ne-bumpana) ready naročila */
  readyOrdersCount: number
  /** R26-b: št. bumpanih (skritih) ready naročil — Recall jih vrne */
  bumpedCount: number
  onRecallAll: () => void
}

// --- Komponenta ---

export const KitchenHeader = memo(function KitchenHeader({
  stats,
  stationFilter,
  onStationFilterChange,
  soundEnabled,
  onToggleSound,
  viewMode,
  onViewModeChange,
  onRefresh,
  isFullscreen,
  onToggleFullscreen,
  filterStatus,
  onFilterStatusChange,
  filteredOrdersCount,
  pendingOrdersCount,
  inProgressOrdersCount,
  readyOrdersCount,
  bumpedCount,
  onRecallAll,
}: KitchenHeaderProps) {
  return (
    <div className="flex-shrink-0 border-b bg-card">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">Kuhinjski zaslon</h1>
          </div>
          <KitchenStationFilter stationFilter={stationFilter} onStationFilterChange={onStationFilterChange} />
          {stats && (
            <div className="flex gap-2">
              {/* RUNDA 57: eliotska srednja oblika (naročilo izpuščeno, srednji
                  rod) — 2 čakajoči · 3 čakajoča · 5 čakajočih (prej trdo
                  "čakajočih"); tabular-nums za stabilne števce */}
              <Badge variant="outline" className="text-xs h-6 font-medium tabular-nums">
                <span className="h-2 w-2 rounded-full bg-yellow-400 mr-1.5" />
                {slCount(stats.pendingOrders, CAKAJOC_FORMS)}
              </Badge>
              <Badge variant="outline" className="text-xs h-6 font-medium tabular-nums">
                <span className="h-2 w-2 rounded-full bg-blue-400 mr-1.5" />
                {stats.inProgressOrders} v pripravi
              </Badge>
              {(stats.readyOrdersCount ?? 0) > 0 && (
                <Badge variant="outline" className="text-xs h-6 border-emerald-400 text-emerald-700 dark:text-emerald-400 font-medium tabular-nums">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                  {slCount(stats.readyOrdersCount ?? 0, PRIPRAVLJENO_FORMS)}
                </Badge>
              )}
              {stats.criticalOrders > 0 && (
                <Badge variant="destructive" className="text-xs h-6 font-medium tabular-nums">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {slCount(stats.criticalOrders, NUJNO_FORMS)}!
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Zvok" className="h-8 w-8 pointer-coarse:h-11 pointer-coarse:w-11" onClick={onToggleSound} title={soundEnabled ? 'Izklopi zvok' : 'Vklopi zvok'}>
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          </Button>
          <div className="flex border rounded-md">
            <Button variant={viewMode === 'cards' ? 'default' : 'ghost'} size="icon" aria-label="Kartični pogled" className="h-8 w-8 rounded-r-none pointer-coarse:h-11 pointer-coarse:w-11" onClick={() => onViewModeChange('cards')}>
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon" aria-label="Seznamni pogled" className="h-8 w-8 rounded-l-none pointer-coarse:h-11 pointer-coarse:w-11" onClick={() => onViewModeChange('list')}>
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Prikliči ${bumpedCount} bumpanih naročil`}
            className="h-8 w-8 pointer-coarse:h-11 pointer-coarse:w-11 relative"
            onClick={onRecallAll}
            disabled={bumpedCount === 0}
            title={bumpedCount > 0 ? `Recall — vrni ${bumpedCount} odstranjenih nazaj na zaslon` : 'Ni odstranjenih naročil'}
          >
            <Undo2 className="h-4 w-4" />
            {bumpedCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                {bumpedCount}
              </span>
            )}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Osveži" className="h-8 w-8 pointer-coarse:h-11 pointer-coarse:w-11" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant={isFullscreen ? 'default' : 'ghost'} size="icon" aria-label="Cel zaslon" className="h-8 w-8 pointer-coarse:h-11 pointer-coarse:w-11" onClick={onToggleFullscreen} title={isFullscreen ? 'Izhod iz cel. zaslona' : 'Celozaslonski način'}>
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <KitchenFilterTabs
        filterStatus={filterStatus}
        onFilterStatusChange={onFilterStatusChange}
        filteredOrdersCount={filteredOrdersCount}
        pendingOrdersCount={pendingOrdersCount}
        inProgressOrdersCount={inProgressOrdersCount}
        readyOrdersCount={readyOrdersCount}
      />
    </div>
  )
})
