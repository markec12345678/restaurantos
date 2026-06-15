'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { timeSlots } from './constants'
import type { TableType } from './constants'

// ============================================
// Date, time & table fields sub-component
// ============================================
interface DateTimeTableFieldsProps {
  date: string
  setDate: (_v: string) => void
  time: string
  setTime: (_v: string) => void
  partySize: number
  setPartySize: (_v: number) => void
  duration: number
  setDuration: (_v: number) => void
  tableId: string
  setTableId: (_v: string) => void
  suitableTables: TableType[]
}

export const DateTimeTableFields = memo(function DateTimeTableFields({
  date, setDate, time, setTime,
  partySize, setPartySize,
  duration, setDuration,
  tableId, setTableId,
  suitableTables,
}: DateTimeTableFieldsProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Čas in miza</p>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label htmlFor="res-date" className="text-xs font-medium">Datum</label>
          <Input id="res-date" type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-sm" />
        </div>
        <div>
          <label htmlFor="res-time" className="text-xs font-medium">Ura</label>
          <Select value={time} onValueChange={setTime}>
            <SelectTrigger id="res-time" className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {timeSlots.map(slot => (<SelectItem key={slot} value={slot}>{slot}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="res-party-size" className="text-xs font-medium">Oseb *</label>
          <Input id="res-party-size" type="number" min={1} max={20} value={partySize} onChange={e => setPartySize(parseInt(e.target.value) || 1)} className="h-9 text-sm" />
        </div>
        <div>
          <label htmlFor="res-duration" className="text-xs font-medium">Trajanje (min)</label>
          <Select value={String(duration)} onValueChange={v => setDuration(parseInt(v))}>
            <SelectTrigger id="res-duration" className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="60">1 ura</SelectItem>
              <SelectItem value="90">1.5 ure</SelectItem>
              <SelectItem value="120">2 uri</SelectItem>
              <SelectItem value="150">2.5 ure</SelectItem>
              <SelectItem value="180">3 ure</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label htmlFor="res-table" className="text-xs font-medium">Miza (primernih: {suitableTables.length})</label>
        <Select value={tableId || 'none'} onValueChange={(v) => setTableId(v === 'none' ? '' : v)}>
          <SelectTrigger id="res-table" className="h-9 text-sm"><SelectValue placeholder="Izberi mizo ali pusti prazno" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Brez mize</SelectItem>
            {suitableTables.map(t => (<SelectItem key={t.id} value={t.id}>Miza {t.number} ({t.capacity} mest) — {t.area}</SelectItem>))}
            {suitableTables.length === 0 && partySize > 0 && (<SelectItem value="no-tables" disabled>Ni primernih miz za {partySize} oseb</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
})
