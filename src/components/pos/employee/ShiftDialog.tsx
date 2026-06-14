'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import type { ShiftDialogProps } from './constants'

// ============================================
// DIJALOG IZMENE — Razporedi izmeno za zaposlenega
// ============================================

export const ShiftDialog = memo(function ShiftDialog({
  open,
  onOpenChange,
  shiftForm,
  onShiftFormChange,
  employees,
  onSubmit,
}: ShiftDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Razporedi izmeno</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label htmlFor="shift-employee">Zaposleni</Label>
            <Select value={shiftForm.employeeId} onValueChange={(v) => onShiftFormChange({ ...shiftForm, employeeId: v })}>
              <SelectTrigger id="shift-employee" autoFocus><SelectValue placeholder="Izberi zaposlenega" /></SelectTrigger>
              <SelectContent>
                {employees.filter(e => String(e.status) === 'active').map(emp => (
                  <SelectItem key={String(emp.id)} value={String(emp.id)}>{String(emp.name)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label htmlFor="shift-date">Datum</Label><Input id="shift-date" type="date" value={shiftForm.date} onChange={(e) => onShiftFormChange({ ...shiftForm, date: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="shift-start">Zacetek</Label><Input id="shift-start" type="time" value={shiftForm.startTime} onChange={(e) => onShiftFormChange({ ...shiftForm, startTime: e.target.value })} /></div>
            <div><Label htmlFor="shift-end">Konec</Label><Input id="shift-end" type="time" value={shiftForm.endTime} onChange={(e) => onShiftFormChange({ ...shiftForm, endTime: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onSubmit} disabled={!shiftForm.employeeId || !shiftForm.date}>Razporedi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
