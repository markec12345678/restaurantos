'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { ChefHat, Minimize, Maximize, RefreshCw, Wifi, WifiOff, Grid3X3, List, Volume2, VolumeX, RotateCcw } from 'lucide-react'

// ─── Glava KDS zaslona ─────────────────────────────────────────

interface KDSHeaderProps {
  employeeName: string
  activeOrderCount: number
  stations: string[]
  stationFilter: string
  onStationFilterChange: (_filter: string) => void
  viewMode: 'grid' | 'list'
  onViewModeToggle: () => void
  isSoundEnabled: () => boolean
  onToggleSound: () => void
  bumpedCount: number
  onRecall: () => void
  onRefresh: () => void
  wsConnected: boolean
  isFullscreen: boolean
  onToggleFullscreen: () => void
}

export const KDSHeader = memo(function KDSHeader({
  employeeName,
  activeOrderCount,
  stations,
  stationFilter,
  onStationFilterChange,
  viewMode,
  onViewModeToggle,
  isSoundEnabled,
  onToggleSound,
  bumpedCount,
  onRecall,
  onRefresh,
  wsConnected,
  isFullscreen,
  onToggleFullscreen,
}: KDSHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b bg-card shadow-sm">
      <div className="flex items-center gap-3">
        <ChefHat className="w-6 h-6 text-orange-500" />
        <h1 className="text-lg font-bold">KDS</h1>
        <span className="text-sm text-muted-foreground">{employeeName}</span>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
          {activeOrderCount} {activeOrderCount === 1 ? 'naročilo' : 'naročil'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {/* Postaje */}
        <div className="flex gap-1">
          {stations.map(s => (
            <button key={s} onClick={() => onStationFilterChange(s)}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors touch-manipulation min-h-[36px]',
                stationFilter === s
                  ? 'bg-orange-500 text-white'
                  : 'bg-secondary hover:bg-secondary/80'
              )}>
              {s === 'all' ? 'Vse' : s}
            </button>
          ))}
        </div>
        {/* Pogled */}
        <button onClick={onViewModeToggle}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 touch-manipulation min-h-[36px]">
          {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
        </button>
        {/* Zvok */}
        <button onClick={onToggleSound}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 touch-manipulation min-h-[36px]">
          {isSoundEnabled() ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
        {/* Recall */}
        {bumpedCount > 0 && (
          <button onClick={onRecall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 touch-manipulation min-h-[36px]">
            <RotateCcw className="w-3.5 h-3.5" />
            Prikljuki ({bumpedCount})
          </button>
        )}
        {/* Osveži */}
        <button onClick={onRefresh} className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 touch-manipulation min-h-[36px]">
          <RefreshCw className="w-4 h-4" />
        </button>
        {/* WS status */}
        <div className={cn('flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg font-medium', wsConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800')}>
          {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {wsConnected ? 'Live' : 'Offline'}
        </div>
        {/* Celozaslonski */}
        <button onClick={onToggleFullscreen} className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 touch-manipulation min-h-[36px]">
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
})
