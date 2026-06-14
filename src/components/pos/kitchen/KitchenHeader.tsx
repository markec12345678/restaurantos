'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ChefHat, AlertTriangle, Volume2, VolumeX, RefreshCw,
  Grid3X3, List, Maximize, Minimize,
} from 'lucide-react'
import type { KDSData } from './types'

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
  filterStatus: 'all' | 'pending' | 'in-progress'
  onFilterStatusChange: (_status: 'all' | 'pending' | 'in-progress') => void
  filteredOrdersCount: number
  pendingOrdersCount: number
  inProgressOrdersCount: number
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
}: KitchenHeaderProps) {
  return (
    <div className="flex-shrink-0 border-b bg-card">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">Kuhinjski zaslon</h1>
          </div>
          {/* Station filter - Kuhinja/Šank/Vse */}
          <div className="flex border rounded-lg overflow-hidden ml-2">
            {[
              { value: 'all' as const, label: 'Vse', icon: '\uD83D\uDCCB' },
              { value: 'kuhinja' as const, label: 'Kuhinja', icon: '\uD83C\uDF73' },
              { value: 'sank' as const, label: 'Šank', icon: '\uD83C\uDF79' },
            ].map(station => (
              <button
                key={station.value}
                onClick={() => onStationFilterChange(station.value)}
                className={`px-3 py-1 text-xs font-semibold transition-colors touch-manipulation ${
                  stationFilter === station.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {station.icon} {station.label}
              </button>
            ))}
          </div>
          {stats && (
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs h-6">
                <span className="h-2 w-2 rounded-full bg-yellow-400 mr-1.5" />
                {stats.pendingOrders} čakajočih
              </Badge>
              <Badge variant="outline" className="text-xs h-6">
                <span className="h-2 w-2 rounded-full bg-blue-400 mr-1.5" />
                {stats.inProgressOrders} v pripravi
              </Badge>
              {stats.criticalOrders > 0 && (
                <Badge variant="destructive" className="text-xs h-6">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {stats.criticalOrders} nujnih!
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Sound toggle */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zvok"
            className="h-8 w-8"
            onClick={onToggleSound}
            title={soundEnabled ? 'Izklopi zvok' : 'Vklopi zvok'}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          </Button>

          {/* View mode */}
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="icon"
              aria-label="Kartični pogled"
              className="h-8 w-8 rounded-r-none"
              onClick={() => onViewModeChange('cards')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              aria-label="Seznamni pogled"
              className="h-8 w-8 rounded-l-none"
              onClick={() => onViewModeChange('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* Refresh */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Osveži"
            className="h-8 w-8"
            onClick={onRefresh}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          {/* Fullscreen */}
          <Button
            variant={isFullscreen ? 'default' : 'ghost'}
            size="icon"
            aria-label="Cel zaslon"
            className="h-8 w-8"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Izhod iz cel. zaslona' : 'Celozaslonski način'}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-4 pb-2 flex gap-1.5">
        {[
          { value: 'all', label: 'Vsa naročila', count: filteredOrdersCount },
          { value: 'pending', label: 'Čakajoča', count: pendingOrdersCount },
          { value: 'in-progress', label: 'V pripravi', count: inProgressOrdersCount },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => onFilterStatusChange(tab.value as 'all' | 'pending' | 'in-progress')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              filterStatus === tab.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>
    </div>
  )
})
