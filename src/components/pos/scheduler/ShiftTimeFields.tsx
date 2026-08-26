'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Clock } from 'lucide-react'
import { TIME_SLOTS, calcHours } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

export const ShiftTimeFields = memo(function ShiftTimeFields({
  date, setDate,
  startTime, setStartTime,
  endTime, setEndTime,
  breakMinutes, setBreakMinutes,
}: {
  date: string
  setDate: (_v: string) => void
  startTime: string
  setStartTime: (_v: string) => void
  endTime: string
  setEndTime: (_v: string) => void
  breakMinutes: number
  setBreakMinutes: (_v: number) => void
}) {
  const hours = calcHours(startTime, endTime, breakMinutes)

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Čas</p>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label htmlFor="shift-date" className="text-xs font-medium">Datum *</label>
          <Input id="shift-date" type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-sm" />
        </div>
        <div>
          <label htmlFor="shift-start-time" className="text-xs font-medium">Od</label>
          <Select value={startTime} onValueChange={setStartTime}>
            <SelectTrigger id="shift-start-time" className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              {TIME_SLOTS.map(t => <SelectItem key={`${t}-30`} value={`${t.slice(0, 3)}30`}>{`${t.slice(0, 3)}30`}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="shift-end-time" className="text-xs font-medium">Do</label>
          <Select value={endTime} onValueChange={setEndTime}>
            <SelectTrigger id="shift-end-time" className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              {TIME_SLOTS.map(t => <SelectItem key={`${t}-30`} value={`${t.slice(0, 3)}30`}>{`${t.slice(0, 3)}30`}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="shift-break" className="text-xs font-medium">Odmor (min)</label>
          <Select value={String(breakMinutes)} onValueChange={v => setBreakMinutes(parseInt(v))}>
            <SelectTrigger id="shift-break" className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Brez</SelectItem>
              <SelectItem value="15">15 min</SelectItem>
              <SelectItem value="30">30 min</SelectItem>
              <SelectItem value="45">45 min</SelectItem>
              <SelectItem value="60">60 min</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className={`text-sm font-medium p-2 rounded-lg ${hours > 8 ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
        <Clock className="h-3.5 w-3.5 inline mr-1" />
        Skupaj: {safeToFixed(hours, 1)} ur {hours > 8 ? '(podaljšek!)' : hours >= 6 ? '(polna izmena)' : '(skrajšana izmena)'}
      </div>
    </div>
  )
})
