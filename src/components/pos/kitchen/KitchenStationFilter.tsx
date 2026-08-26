'use client'

import { memo } from 'react'

type StationValue = 'all' | 'kuhinja' | 'sank'

interface KitchenStationFilterProps {
  stationFilter: StationValue
  onStationFilterChange: (_value: StationValue) => void
}

export const KitchenStationFilter = memo(function KitchenStationFilter({
  stationFilter,
  onStationFilterChange,
}: KitchenStationFilterProps) {
  return (
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
  )
})
