'use client'
import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Flame } from 'lucide-react'

// ============================================
// HEATMAP GRID — Toplotna karta 24 ur
// ============================================
interface HeatmapGridProps {
  heatmap: Array<{ hour: number; revenue: number; orders: number; intensity: number; label: string }>
  fmt: (_n: number) => string
}

const getIntensityColor = (intensity: number) => {
  if (intensity === 0) return 'bg-gray-100 dark:bg-gray-800'
  if (intensity < 20) return 'bg-blue-200 dark:bg-blue-900/40'
  if (intensity < 40) return 'bg-green-200 dark:bg-green-900/40'
  if (intensity < 60) return 'bg-yellow-200 dark:bg-yellow-900/40'
  if (intensity < 80) return 'bg-orange-300 dark:bg-orange-900/40'
  return 'bg-red-400 dark:bg-red-900/50'
}

const getIntensityText = (intensity: number) => {
  if (intensity === 0) return 'text-gray-500'
  if (intensity < 40) return 'text-gray-700 dark:text-gray-300'
  if (intensity < 70) return 'text-gray-800 dark:text-gray-200'
  return 'text-white dark:text-white'
}

export const HeatmapGrid = memo(function HeatmapGrid({ heatmap, fmt }: HeatmapGridProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Flame className="h-4 w-4" />
          Urna toplotna karta prometa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
          {heatmap.map((h) => (
            <div
              key={h.hour}
              className={`relative p-2 rounded-lg text-center cursor-default transition-transform hover:scale-105 ${getIntensityColor(h.intensity)}`}
              title={`Ura ${h.hour}:00 — ${fmt(h.revenue)} | ${h.orders} naročil | ${h.label}`}
            >
              <p className={`text-xs font-bold ${getIntensityText(h.intensity)}`}>{String(h.hour).padStart(2, '0')}:00</p>
              <p className={`text-[10px] ${getIntensityText(h.intensity)}`}>{h.revenue > 0 ? fmt(h.revenue) : '—'}</p>
              <p className={`text-[9px] opacity-70 ${getIntensityText(h.intensity)}`}>{h.orders > 0 ? `${h.orders}×` : ''}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
          <span>Nizka</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 rounded bg-gray-100 dark:bg-gray-800" />
            <div className="w-4 h-4 rounded bg-blue-200 dark:bg-blue-900/40" />
            <div className="w-4 h-4 rounded bg-green-200 dark:bg-green-900/40" />
            <div className="w-4 h-4 rounded bg-yellow-200 dark:bg-yellow-900/40" />
            <div className="w-4 h-4 rounded bg-orange-300 dark:bg-orange-900/40" />
            <div className="w-4 h-4 rounded bg-red-400 dark:bg-red-900/50" />
          </div>
          <span>Visoka</span>
        </div>
      </CardContent>
    </Card>
  )
})

// ============================================
// PEAK HOURS CARD — Najboljše ure
// ============================================
interface PeakHoursCardProps {
  peakHours: Array<{ hour: number; revenue: number; orders: number; label: string }>
  fmt: (_n: number) => string
  timeSlotLabels: Record<string, string>
}

export const PeakHoursCard = memo(function PeakHoursCard({ peakHours, fmt, timeSlotLabels }: PeakHoursCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Najboljše ure (špice)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {peakHours.map((h, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-amber-500">#{idx + 1}</span>
                <div>
                  <p className="font-semibold">{String(h.hour).padStart(2, '0')}:00 — {String(h.hour + 1).padStart(2, '0')}:00</p>
                  <p className="text-xs text-muted-foreground">{timeSlotLabels[h.label] || h.label}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-emerald-600">{fmt(h.revenue)}</p>
                <p className="text-xs text-muted-foreground">{h.orders} naročil</p>
              </div>
            </div>
          ))}
          {peakHours.length === 0 && (
            <p className="text-center py-6 text-muted-foreground">Ni prometa v tem obdobju</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
})

// ============================================
// PERIOD COMPARISON CARD — Primerjava obdobij
// ============================================
interface PeriodComparisonCardProps {
  periodComparison: {
    current: { revenue: number; orders: number; avgOrderValue: number; tips: number }
    previous: { revenue: number; orders: number; avgOrderValue: number; tips: number }
    changes: { revenue: number; orders: number; avgOrderValue: number; tips: number }
  }
  fmt: (_n: number) => string
}

export const PeriodComparisonCard = memo(function PeriodComparisonCard({ periodComparison, fmt }: PeriodComparisonCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Primerjava s prejšnjim obdobjem
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Prihodek', current: periodComparison.current.revenue, previous: periodComparison.previous.revenue, change: periodComparison.changes.revenue },
            { label: 'Naročila', current: periodComparison.current.orders, previous: periodComparison.previous.orders, change: periodComparison.changes.orders },
            { label: 'Povp. naročilo', current: periodComparison.current.avgOrderValue, previous: periodComparison.previous.avgOrderValue, change: periodComparison.changes.avgOrderValue },
            { label: 'Napitnine', current: periodComparison.current.tips, previous: periodComparison.previous.tips, change: periodComparison.changes.tips },
          ].map((item, idx) => (
            <div key={idx} className="text-center p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className="text-lg font-bold">{typeof item.current === 'number' && item.label !== 'Naročila' ? fmt(item.current) : item.current}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="text-xs text-muted-foreground">prej: {typeof item.previous === 'number' && item.label !== 'Naročila' ? fmt(item.previous) : item.previous}</span>
                {item.change !== 0 && (
                  <Badge variant={item.change > 0 ? 'default' : 'destructive'} className="text-[10px] px-1">
                    {item.change > 0 ? '+' : ''}{item.change.toFixed(1)}%
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
})
