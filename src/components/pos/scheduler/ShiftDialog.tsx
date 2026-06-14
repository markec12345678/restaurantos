'use client'
// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Dialog za novo/uredi izmeno (Shift Dialog)
// Ustvarjanje in urejanje izmen zaposlenih
// ═══════════════════════════════════════════════════════════════
import { memo, useState } from 'react'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CalendarDays, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { type EmployeeType, type ShiftType, type JobType, TIME_SLOTS, calcHours } from './constants'

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
      setDate(format(new Date(shift.date), 'yyyy-MM-dd'))
      setStartTime(shift.startTime)
      setEndTime(shift.endTime)
      setBreakMinutes(shift.breakMinutes)
      setStatus(shift.status)
      setNotes(shift.notes)
    } else {
      setEmployeeId(employees[0]?.id || '')
      setJobId('')
      setDate(weekDates[0] ? format(weekDates[0], 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
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

  const hours = calcHours(startTime, endTime, breakMinutes)

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
          {/* Zaposleni */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Zaposleni</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="shift-employee" className="text-xs font-medium">Zaposleni *</label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger id="shift-employee" className="h-9 text-sm" autoFocus><SelectValue placeholder="Izberi zaposlenega" /></SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name} ({emp.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="shift-job" className="text-xs font-medium">Delovno mesto</label>
                <Select value={jobId || 'none'} onValueChange={v => setJobId(v === 'none' ? '' : v)}>
                  <SelectTrigger id="shift-job" className="h-9 text-sm"><SelectValue placeholder="Brez" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brez posebne vloge</SelectItem>
                    {jobs.map(job => (
                      <SelectItem key={job.id} value={job.id}>{job.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          {/* Čas */}
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
              Skupaj: {hours.toFixed(1)} ur {hours > 8 ? '(podaljšek!)' : hours >= 6 ? '(polna izmena)' : '(skrajšana izmena)'}
            </div>
          </div>
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
