'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

// ============================================
// DAY ROW — Vrstica za urejanje enega dneva
// ============================================

interface OpeningHour {
  id?: string
  dayOfWeek: number
  openTime: string
  closeTime: string
  breakStart: string
  breakEnd: string
  isClosed: boolean
}

interface DayRowProps {
  dayShort: string
  hour: OpeningHour
  onUpdate: (_field: keyof OpeningHour, _value: string | boolean) => void
}

export const DayRow = memo(function DayRow({ dayShort, hour, onUpdate }: DayRowProps) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${hour.isClosed ? 'bg-gray-50/50 opacity-70' : 'bg-background'}`}>
      <span className="w-12 font-semibold text-sm">{dayShort}</span>
      <Switch checked={!hour.isClosed} onCheckedChange={v => onUpdate('isClosed', !v)} />
      {!hour.isClosed ? (
        <>
          <Input type="time" value={hour.openTime} onChange={e => onUpdate('openTime', e.target.value)} className="w-32" />
          <span className="text-muted-foreground">—</span>
          <Input type="time" value={hour.closeTime} onChange={e => onUpdate('closeTime', e.target.value)} className="w-32" />
          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs text-muted-foreground">Odmor:</span>
            <Input type="time" value={hour.breakStart} onChange={e => onUpdate('breakStart', e.target.value)} className="w-28" placeholder="Od" aria-label="Od" />
            <Input type="time" value={hour.breakEnd} onChange={e => onUpdate('breakEnd', e.target.value)} className="w-28" placeholder="Do" aria-label="Do" />
          </div>
        </>
      ) : (
        <span className="text-sm text-red-500 font-medium">Zaprto</span>
      )}
    </div>
  )
})
