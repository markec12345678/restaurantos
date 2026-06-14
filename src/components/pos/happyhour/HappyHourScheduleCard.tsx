'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Trash2 } from 'lucide-react'
import { type HappyHourSchedule, DAY_LABELS } from './types'

// ============================================
// KARTICA URNIKA HAPPY HOUR
// Prikazuje en urnik z dejanji
// ============================================

interface HappyHourScheduleCardProps {
  schedule: HappyHourSchedule
  currentlyActive: boolean
  onToggleActive: (_id: string, _isActive: boolean) => void
  onDelete: (_id: string) => void
}

export const HappyHourScheduleCard = memo(function HappyHourScheduleCard({
  schedule,
  currentlyActive,
  onToggleActive,
  onDelete,
}: HappyHourScheduleCardProps) {
  const s = schedule
  return (
    <Card className={`${!s.isActive ? 'opacity-60' : ''} ${currentlyActive && s.isActive ? 'border-amber-300 shadow-amber-100' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{s.name}</h3>
              <Badge variant={s.isActive ? 'default' : 'secondary'} className={s.isActive ? 'bg-green-600' : ''}>
                {s.isActive ? 'Aktiven' : 'Neaktiven'}
              </Badge>
            </div>
            {s.description && <p className="text-sm text-muted-foreground mt-0.5">{s.description}</p>}
            <div className="flex items-center gap-3 mt-2 text-sm">
              <Badge variant="outline">{s.startTime} - {s.endTime}</Badge>
              {s.discountType !== 'none' && (
                <Badge variant="default">
                  {s.discountType === 'percentage' ? `-${s.discountAmount}%` : `-€${s.discountAmount.toFixed(2)}`}
                </Badge>
              )}
              {s.priceGroup && <Badge variant="secondary">{s.priceGroup.name}</Badge>}
            </div>
            <div className="flex gap-1 mt-2">
              {(() => {
                try {
                  const days: number[] = JSON.parse(s.daysOfWeek || '[]')
                  return days.map(d => (
                    <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-medium">{DAY_LABELS[d] || d}</span>
                  ))
                } catch { return null }
              })()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={s.isActive} onCheckedChange={v => onToggleActive(s.id, v)} />
            <Button variant="ghost" size="icon" aria-label="Izbriši" className="h-7 w-7 text-destructive" onClick={() => onDelete(s.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
