'use client'
import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Flame } from 'lucide-react'

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
        <CardTitle className="text-lg flex items-center gap-2"><Flame className="h-4 w-4" />Urna toplotna karta prometa</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
          {heatmap.map((h) => (
            <div key={h.hour} className={`relative p-2 rounded-lg text-center cursor-default transition-transform hover:scale-105 ${getIntensityColor(h.intensity)}`} title={`Ura ${h.hour}:00 — ${fmt(h.revenue)} | ${h.orders} naročil | ${h.label}`}>
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
