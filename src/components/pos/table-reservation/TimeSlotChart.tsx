'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Clock } from 'lucide-react'
import type { TimeSlotChartProps } from './constants'

// ============================================
// ČASOVNA RAZDELITEV — ZASEDENOST PO URAH
// STIL R43: gradient polnjenje barve, "zdaj" poudarek s PULSE piko + obrobo
// (prej primerjava niza 'slot.time === toLocaleTimeString' — sl-SI format uporablja
// piko in je zadela samo ob X:X0, zdaj pokritost celotnega 30-min slotu),
// nasvetna vrstica s procentom zasedenosti, aria-valueNow vsak slot.
// ============================================

/** 'HH:mm' → minute od polnoči */
function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Trenutne minute od polnoči v ljubljanskem času */
function nowMinutesLJ(): number {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Ljubljana', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date())
  return minutesOf(time)
}

export const TimeSlotChart = memo(function TimeSlotChart({
  timeSlots,
}: TimeSlotChartProps) {
  const nowMin = nowMinutesLJ()
  const peak = timeSlots.reduce((max, s) => Math.max(max, s.total > 0 ? (s.total - s.available) / s.total : 0), 0)
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" /> Zasedenost po urah
          {peak >= 0.8 && (
            <span className="ml-auto text-[10px] font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-2 py-0.5">
              Vrhunec zasedenosti
            </span>
          )}
        </CardTitle>
        <CardDescription className="text-xs">Vsak stolpec pokriva 30 minut — rezervacije štejejo z trajanjem</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1 overflow-auto pb-2">
          {timeSlots.map(slot => {
            const busy = slot.total > 0 ? slot.total - slot.available : 0
            const percent = slot.total > 0 ? (busy / slot.total) * 100 : 0
            const slotStart = minutesOf(slot.time)
            // 'zdaj' = trenutni 30-min slot (pokritost celotnega intervala)
            const isNow = nowMin >= slotStart && nowMin < slotStart + 30
            return (
              <div
                key={slot.time}
                className={`flex flex-col items-center min-w-[40px] p-1 rounded transition-colors ${isNow ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-accent/40'}`}
                title={`${slot.time} — ${busy}/${slot.total} zasedenih (${Math.round(percent)} %)`}
              >
                <span className={`text-[10px] ${isNow ? 'font-bold text-primary' : 'text-muted-foreground'}`}>{slot.time}</span>
                <div className="h-12 w-6 bg-muted rounded-sm relative overflow-hidden my-1" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-valuetext={percent >= 80 ? 'Skoraj zasedeno' : percent >= 50 ? 'Delno zasedeno' : 'Pretežno prosto'}>
                  <div
                    className={`absolute bottom-0 w-full rounded-sm transition-all ${
                      percent >= 80
                        ? 'bg-gradient-to-t from-red-600 to-red-400'
                        : percent >= 50
                          ? 'bg-gradient-to-t from-amber-600 to-amber-400'
                          : 'bg-gradient-to-t from-green-600 to-green-400'
                    }`}
                    style={{ height: `${percent}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium tabular-nums">{slot.available}/{slot.total}</span>
                {isNow && <span className="h-1 w-1 rounded-full bg-primary animate-pulse mt-0.5" aria-hidden="true" />}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
})
