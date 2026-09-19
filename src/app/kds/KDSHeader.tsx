'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { slCount, NAROCILO_FORMS } from '@/lib/sl-plural'
import { ChefHat, Minimize, Maximize, RefreshCw, Wifi, WifiOff, Grid3X3, List, Volume2, VolumeX, RotateCcw, BellRing } from 'lucide-react'

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
  dangerCount: number
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
  dangerCount,
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
        {/* RUNDA 57: prava sklanjatev — 1 naročilo · 2 naročili (DVOJINA) ·
            3 naročila · 5 naročil (prej ternarek 1→naročilo : naročil);
            tabular-nums, da števec ne poskakuje ob live posodobitvah */}
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded font-medium tabular-nums">
          {slCount(activeOrderCount, NAROCILO_FORMS)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {/* Postaje */}
        <div className="flex gap-1">
          {stations.map(s => (
            <button key={s} onClick={() => onStationFilterChange(s)}
              aria-pressed={stationFilter === s}
              aria-label={`Postaja ${s === 'all' ? 'vse' : s}`}
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
          aria-label={viewMode === 'grid' ? 'Preklopi na seznam' : 'Preklopi na mrežo'}
          title={viewMode === 'grid' ? 'Seznamski pogled' : 'Mrežni pogled'}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 touch-manipulation min-h-[36px]">
          {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
        </button>
        {/* Zvok — R63: stanjsko barvanje (emerald = vklopljen) + aria-pressed +
            persistenca (utišanje preživi reload — nasvet v tooltipu) */}
        <button onClick={onToggleSound}
          aria-pressed={isSoundEnabled()}
          aria-label={isSoundEnabled() ? 'Zvok vklopljen — klik za izklop' : 'Zvok izklopljen — klik za vklop'}
          title={isSoundEnabled() ? 'Zvok vklopljen (nove naročile = trojni ping) — klik za utišanje' : 'Zvok utišan — klik za vklop (ostane tudi po osvežitvi)'}
          className={cn(
            'w-9 h-9 flex items-center justify-center rounded-lg touch-manipulation min-h-[36px] transition-colors',
            isSoundEnabled()
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
              : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
          )}>
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
        {/* R64: nevarna cona — rdeče utripajoči čip (vizualna dvojica zvočnega
            opomnika; animate-pulse samodejno ugasne ob prefers-reduced-motion
            prek globalnega WCAG 2.3.3 bloka) */}
        {dangerCount > 0 && (
          <span
            role="status"
            aria-label={`${slCount(dangerCount, NAROCILO_FORMS)} v nevarni coni (čakajo več kot 25 minut)`}
            title="Naročila v nevarni coni (≥ 25 min) — zvočni opomnik vsakih 60 s (če je zvok vklopljen)"
            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg font-bold tabular-nums bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 animate-pulse"
          >
            <BellRing className="w-3 h-3" aria-hidden="true" />
            {dangerCount}
          </span>
        )}
        {/* Osveži */}
        <button onClick={onRefresh}
          aria-label="Osveži naročila"
          title="Osveži naročila"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 touch-manipulation min-h-[36px]">
          <RefreshCw className="w-4 h-4" />
        </button>
        {/* WS status */}
        <div className={cn('flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg font-medium', wsConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800')}>
          {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {wsConnected ? 'Live' : 'Offline'}
        </div>
        {/* Celozaslonski */}
        <button onClick={onToggleFullscreen}
          aria-pressed={isFullscreen}
          aria-label={isFullscreen ? 'Izklopi celozaslonski način' : 'Vklopi celozaslonski način'}
          title={isFullscreen ? 'Zapusti celozaslonski način' : 'Celozaslonski način'}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 touch-manipulation min-h-[36px]">
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
})
