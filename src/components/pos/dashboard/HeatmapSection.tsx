'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Flame } from 'lucide-react'
import { DAY_NAMES } from './constants'
import type { HeatmapSectionProps } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

/**
 * HeatmapSection — toplotna karta prometa (zadnje 4 tedne).
 * Temnejša barva = večji prihodek. Pomaga pri razporedu osebja za vršne ure.
 */
export const HeatmapSection = memo(function HeatmapSection({ heatmapData, heatmapMax }: HeatmapSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          Toplotna karta prometa (zadnje 4 tedne)
        </CardTitle>
        <p className="text-xs text-muted-foreground">Temnejša barva = večji prihodek. Pomaga pri razporedu osebja za vršne ure.</p>
      </CardHeader>
      <CardContent>
        {heatmapData.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              {/* Vrstica z urami — glava */}
              <div className="flex items-center mb-1">
                <div className="w-12 flex-shrink-0" />
                {Array.from({ length: 18 }, (_, h) => h + 6).map(hour => (
                  <div key={hour} className="flex-1 text-center text-[9px] text-muted-foreground font-mono">
                    {hour}
                  </div>
                ))}
              </div>
              {/* Podatkovne vrstice — dnevi */}
              {DAY_NAMES.map((dayName, dayIdx) => (
                <div key={dayIdx} className="flex items-center mb-0.5">
                  <div className="w-12 flex-shrink-0 text-[10px] font-medium text-muted-foreground pr-2">{dayName}</div>
                  {Array.from({ length: 18 }, (_, h) => h + 6).map(hour => {
                    const cell = heatmapData.find((c) => c.day === dayIdx && c.hour === hour)
                    const rev = cell?.revenue || 0
                    const intensity = Math.min(rev / heatmapMax, 1)
                    const bgColor = intensity === 0
                      ? 'bg-muted/30'
                      : intensity < 0.25
                        ? 'bg-orange-200 dark:bg-orange-900/30'
                        : intensity < 0.5
                          ? 'bg-orange-400 dark:bg-orange-800/50'
                          : intensity < 0.75
                            ? 'bg-orange-500 dark:bg-orange-700/60'
                            : 'bg-orange-700 dark:bg-orange-600/80'
                    return (
                      <div key={hour} className="flex-1 px-0.5">
                        <div
                          className={`h-6 rounded-sm ${bgColor} flex items-center justify-center text-[8px] font-bold ${intensity > 0.5 ? 'text-white' : 'text-foreground'}`}
                          title={`${dayName} ${hour}:00 — €${safeToFixed(rev, 2)} (${cell?.orders || 0} naročil)`}
                        >
                          {rev > 0 ? `€${Math.round(rev)}` : ''}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
              {/* Legenda */}
              <div className="flex items-center justify-end gap-2 mt-2 text-[9px] text-muted-foreground">
                <span>Nizko</span>
                <div className="flex gap-0.5">
                  <div className="w-4 h-3 rounded-sm bg-muted/30" />
                  <div className="w-4 h-3 rounded-sm bg-orange-200 dark:bg-orange-900/30" />
                  <div className="w-4 h-3 rounded-sm bg-orange-400 dark:bg-orange-800/50" />
                  <div className="w-4 h-3 rounded-sm bg-orange-500 dark:bg-orange-700/60" />
                  <div className="w-4 h-3 rounded-sm bg-orange-700 dark:bg-orange-600/80" />
                </div>
                <span>Visoko</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Za toplotno karto potrebujemo vsaj 1 teden podatkov
          </div>
        )}
      </CardContent>
    </Card>
  )
})
