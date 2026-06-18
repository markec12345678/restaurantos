'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { CalendarDays, Plus } from 'lucide-react'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { ShiftDialogProps } from './constants'

// ============================================
// DIJALOG ZA USTVARJANJE/UREJANJE IZMENE
// ============================================

export const ShiftDialog = memo(function ShiftDialog({
  open,
  onOpenChange,
  editingShift,
  shiftForm,
  onShiftFormChange,
  employeesList,
  jobs,
  onSubmit,
  createPending,
  updatePending,
}: ShiftDialogProps) {
  const isPending = createPending || updatePending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {editingShift ? 'Uredi izmeno' : 'Dodaj izmeno'}
          </DialogTitle>
          <DialogDescription>
            {editingShift ? 'Posodobite podatke o izmeni.' : 'Ustvarite novo izmeno za zaposlenega.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Zaposleni */}
          <div className="space-y-1.5">
            <Label htmlFor="shift-employee" className="text-sm font-semibold">Zaposleni *</Label>
            <Select value={shiftForm.employeeId} onValueChange={v => onShiftFormChange({ ...shiftForm, employeeId: v })}>
              <SelectTrigger id="shift-employee" autoFocus><SelectValue placeholder="Izberi zaposlenega" /></SelectTrigger>
              <SelectContent>
                {employeesList.filter(e => e.status === 'active').map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Funkcija */}
          <div className="space-y-1.5">
            <Label htmlFor="shift-job" className="text-sm font-semibold">Funkcija</Label>
            <Select value={shiftForm.jobId} onValueChange={v => onShiftFormChange({ ...shiftForm, jobId: v })}>
              <SelectTrigger id="shift-job"><SelectValue placeholder="Izberi funkcijo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Brez</SelectItem>
                {jobs?.map(j => (
                  <SelectItem key={j.id} value={j.id}>{j.name} (€{safeToFixed(j.basePayRate, 2)}/h)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Datum, začetek, konec */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="shift-date" className="text-sm font-semibold">Datum</Label>
              <Input id="shift-date" type="date" value={shiftForm.date} onChange={e => onShiftFormChange({ ...shiftForm, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shift-start" className="text-sm font-semibold">Začetek</Label>
              <Input id="shift-start" type="time" value={shiftForm.startTime} onChange={e => onShiftFormChange({ ...shiftForm, startTime: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shift-end" className="text-sm font-semibold">Konec</Label>
              <Input id="shift-end" type="time" value={shiftForm.endTime} onChange={e => onShiftFormChange({ ...shiftForm, endTime: e.target.value })} />
            </div>
          </div>

          {/* Odmor */}
          <div className="space-y-1.5">
            <Label htmlFor="shift-break" className="text-sm font-semibold">Odmor (min)</Label>
            <Input id="shift-break" type="number" min="0" value={shiftForm.breakMinutes} onChange={e => onShiftFormChange({ ...shiftForm, breakMinutes: e.target.value })} />
          </div>

          {/* Opombe */}
          <div className="space-y-1.5">
            <Label htmlFor="shift-notes" className="text-sm font-semibold">Opombe</Label>
            <Textarea id="shift-notes" value={shiftForm.notes} onChange={e => onShiftFormChange({ ...shiftForm, notes: e.target.value })} rows={2} placeholder="Opombe k izmeni..." aria-label="Opombe k izmeni" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending ? (
              <><span className="animate-spin mr-2">⏳</span>Shranjujem...</>
            ) : editingShift ? 'Posodobi' : <><Plus className="h-4 w-4 mr-1.5" />Ustvari</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
