'use client'

import { memo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type EmployeeType, type JobType } from './constants'

export const ShiftFormFields = memo(function ShiftFormFields({
  employeeId, setEmployeeId,
  jobId, setJobId,
  employees, jobs,
}: {
  employeeId: string
  setEmployeeId: (_v: string) => void
  jobId: string
  setJobId: (_v: string) => void
  employees: EmployeeType[]
  jobs: JobType[]
}) {
  return (
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
  )
})
