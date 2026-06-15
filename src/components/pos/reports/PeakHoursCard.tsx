'use client'
import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'

interface PeakHoursCardProps {
  peakHours: Array<{ hour: number; revenue: number; orders: number; label: string }>
  fmt: (_n: number) => string
  timeSlotLabels: Record<string, string>
}

export const PeakHoursCard = memo(function PeakHoursCard({ peakHours, fmt, timeSlotLabels }: PeakHoursCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-4 w-4" />Najboljše ure (špice)</CardTitle>
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
          {peakHours.length === 0 && (<p className="text-center py-6 text-muted-foreground">Ni prometa v tem obdobju</p>)}
        </div>
      </CardContent>
    </Card>
  )
})
