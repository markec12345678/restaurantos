'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Play, CheckCircle2, UserX, Pencil, Trash2, Coffee } from 'lucide-react'
import { ShiftItem, shiftStatusConfig, formatDateSI } from './constants'

interface ShiftsTableProps {
  shifts: ShiftItem[]
  openEditShift: (_shift: ShiftItem) => void
  startShift: (_shift: ShiftItem) => void
  completeShift: (_shift: ShiftItem) => void
  markAbsent: (_shift: ShiftItem) => void
  onDeleteShift: (_shift: ShiftItem) => void
}

export const ShiftsTable = memo(function ShiftsTable({
  shifts,
  openEditShift,
  startShift,
  completeShift,
  markAbsent,
  onDeleteShift,
}: ShiftsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Datum</TableHead>
          <TableHead>Zaposleni</TableHead>
          <TableHead>Funkcija</TableHead>
          <TableHead>Čas</TableHead>
          <TableHead>Odmor</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Dejanja</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...shifts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(shift => {
          const cfg = shiftStatusConfig[shift.status] || shiftStatusConfig.scheduled
          return (
            <TableRow key={shift.id}>
              <TableCell className="text-sm whitespace-nowrap">{formatDateSI(shift.date)}</TableCell>
              <TableCell className="font-medium text-sm">{shift.employee?.name || 'Neznan'}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{shift.job?.name || '—'}</TableCell>
              <TableCell className="text-sm font-mono">{shift.startTime} - {shift.endTime}</TableCell>
              <TableCell className="text-sm">
                <div className="flex items-center gap-1">
                  <Coffee className="h-3 w-3 text-muted-foreground" />
                  {shift.breakMinutes} min
                </div>
              </TableCell>
              <TableCell><Badge className={`text-xs ${cfg.bgColor}`}>{cfg.label}</Badge></TableCell>
              <TableCell className="text-right">
                <ShiftActions
                  shift={shift}
                  openEditShift={openEditShift}
                  startShift={startShift}
                  completeShift={completeShift}
                  markAbsent={markAbsent}
                  onDeleteShift={onDeleteShift}
                />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
})

interface ShiftActionsProps {
  shift: ShiftItem
  openEditShift: (_shift: ShiftItem) => void
  startShift: (_shift: ShiftItem) => void
  completeShift: (_shift: ShiftItem) => void
  markAbsent: (_shift: ShiftItem) => void
  onDeleteShift: (_shift: ShiftItem) => void
}

const ShiftActions = memo(function ShiftActions({
  shift,
  openEditShift,
  startShift,
  completeShift,
  markAbsent,
  onDeleteShift,
}: ShiftActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      {shift.status === 'scheduled' && (
        <>
          <Button variant="ghost" size="icon" aria-label="Predvajaj" className="h-7 w-7 text-amber-600" title="Začni" onClick={() => startShift(shift)}><Play className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" aria-label="Odsoten" className="h-7 w-7 text-red-600" title="Odsoten" onClick={() => markAbsent(shift)}><UserX className="h-3.5 w-3.5" /></Button>
        </>
      )}
      {shift.status === 'in_progress' && (
        <Button variant="ghost" size="icon" aria-label="Potrdi" className="h-7 w-7 text-emerald-600" title="Zaključi" onClick={() => completeShift(shift)}><CheckCircle2 className="h-3.5 w-3.5" /></Button>
      )}
      <Button variant="ghost" size="icon" aria-label="Uredi" className="h-7 w-7" title="Uredi" onClick={() => openEditShift(shift)}><Pencil className="h-3.5 w-3.5" /></Button>
      <Button variant="ghost" size="icon" aria-label="Izbriši" className="h-7 w-7 text-destructive" title="Izbriši" onClick={() => onDeleteShift(shift)}><Trash2 className="h-3.5 w-3.5" /></Button>
    </div>
  )
})
