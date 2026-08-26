'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock } from 'lucide-react'
import type { TimeSlotChartProps } from './constants'

// ============================================
// ČASOVNA RAZDELITEV — ZASEDENOST PO URah
// ============================================
export const TimeSlotChart = memo(function TimeSlotChart({
  timeSlots,
}: TimeSlotChartProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" /> Zasedenost po urah
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1 overflow-auto pb-2">
          {timeSlots.map(slot => {
            const percent = slot.total > 0 ? ((slot.total - slot.available) / slot.total) * 100 : 0
            const isNow = slot.time === new Date().toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
            return (
              <div key={slot.time} className={`flex flex-col items-center min-w-[40px] p-1 rounded ${isNow ? 'bg-primary/10 ring-1 ring-primary' : ''}`}>
                <span className="text-[10px] text-muted-foreground">{slot.time}</span>
                <div className="h-12 w-6 bg-muted rounded-sm relative overflow-hidden my-1" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-valuetext={percent >= 80 ? 'Skoraj zasedeno' : percent >= 50 ? 'Delno zasedeno' : 'Pretežno prosto'}>
                  <div
                    className={`absolute bottom-0 w-full rounded-sm transition-all ${
                      percent >= 80 ? 'bg-red-500' : percent >= 50 ? 'bg-amber-500' : 'bg-green-500'
                    }`}
                    style={{ height: `${percent}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium">{slot.available}/{slot.total}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
})
