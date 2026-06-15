'use client'

import { memo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { type EmployeeType, type ShiftType, type JobType } from './constants'
import { ShiftFormFields } from './ShiftFormFields'
import { ShiftTimeFields } from './ShiftTimeFields'

// ─── Props ─────────────────────────────────────────────────────
export interface ShiftDialogProps {
  open: boolean
  onClose: () => void
  shift: ShiftType | null
  employees: EmployeeType[]
  jobs: JobType[]
  weekDates: Date[]
  onSave: (_data: Record<string, unknown>) => void
}

// ─── Komponenta ────────────────────────────────────────────────
export const ShiftDialog = memo(function ShiftDialog({
  open,
  onClose,
  shift,
  employees,
  jobs,
  weekDates,
  onSave,
}: ShiftDialogProps) {
  const isEditing = !!shift
  const [employeeId, setEmployeeId] = useState('')
  const [jobId, setJobId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [breakMinutes, setBreakMinutes] = useState(30)
  const [status, setStatus] = useState('scheduled')
  const [notes, setNotes] = useState('')

  // Napolni ob urejanju
  const resetForm = () => {
    if (shift) {
      setEmployeeId(shift.employeeId)
      setJobId(shift.jobId || '')
      setDate(new Date(shift.date).toISOString().split('T')[0])
      setStartTime(shift.startTime)
      setEndTime(shift.endTime)
      setBreakMinutes(shift.breakMinutes)
      setStatus(shift.status)
      setNotes(shift.notes)
    } else {
      setEmployeeId(employees[0]?.id || '')
      setJobId('')
      setDate(weekDates[0] ? new Date(weekDates[0]).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
      setStartTime('09:00')
      setEndTime('17:00')
      setBreakMinutes(30)
      setStatus('scheduled')
      setNotes('')
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) resetForm()
    else onClose()
  }

  const handleSave = () => {
    if (!employeeId || !date) {
      toast.error('Zaposleni in datum sta obvezna')
      return
    }
    onSave({ employeeId, jobId: jobId || null, date, startTime, endTime, breakMinutes, status, notes })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {isEditing ? 'Uredi izmeno' : 'Nova izmena'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <ShiftFormFields employeeId={employeeId} setEmployeeId={setEmployeeId} jobId={jobId} setJobId={setJobId} employees={employees} jobs={jobs} />
          <ShiftTimeFields date={date} setDate={setDate} startTime={startTime} setStartTime={setStartTime} endTime={endTime} setEndTime={setEndTime} breakMinutes={breakMinutes} setBreakMinutes={setBreakMinutes} />
          {/* Status in opombe */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="shift-status" className="text-xs font-medium">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="shift-status" className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Načrtovana</SelectItem>
                    <SelectItem value="in_progress">V teku</SelectItem>
                    <SelectItem value="completed">Zaključena</SelectItem>
                    <SelectItem value="absent">Odsoten</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="shift-notes" className="text-xs font-medium">Opombe</label>
                <Input id="shift-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Napredek, nadomestilo..." className="h-9 text-sm" aria-label="Napredek, nadomestilo" />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Prekliči</Button>
          <Button onClick={handleSave}>
            {isEditing ? 'Shrani spremembe' : 'Ustvari izmeno'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
