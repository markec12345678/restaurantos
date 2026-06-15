'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LogIn } from 'lucide-react'
import { TimeTabProps } from './constants'
import { ActiveEntriesTable } from './ActiveEntriesTable'
import { CompletedEntriesTable } from './CompletedEntriesTable'

// ============================================
// ZAVIHEK: URE
// ============================================

export const TimeTab = memo(function TimeTab({
  employeesList,
  jobs,
  clockInEmployeeId,
  clockInJobId,
  setClockInEmployeeId,
  setClockInJobId,
  handleClockIn,
  handleClockOut,
  activeEntries,
  completedEntries,
  entriesLoading,
  clockInPending,
}: TimeTabProps) {
  return (
    <div className="space-y-4">
      {/* Prijava / Odjava */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <LogIn className="h-4 w-4 text-primary" />
            Prijava / Odjava
          </h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="clock-in-employee" className="text-xs">Zaposleni</Label>
              <Select value={clockInEmployeeId} onValueChange={setClockInEmployeeId}>
                <SelectTrigger id="clock-in-employee" className="w-48 h-9 text-sm"><SelectValue placeholder="Izberi..." /></SelectTrigger>
                <SelectContent>
                  {employeesList.filter(e => e.status === 'active').map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clock-in-job" className="text-xs">Funkcija</Label>
              <Select value={clockInJobId} onValueChange={setClockInJobId}>
                <SelectTrigger id="clock-in-job" className="w-44 h-9 text-sm"><SelectValue placeholder="Izberi..." /></SelectTrigger>
                <SelectContent>
                  {jobs?.map(j => (
                    <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleClockIn} disabled={!clockInEmployeeId || clockInPending}>
              <LogIn className="h-4 w-4 mr-1.5" />Prijava
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Aktivne prijave */}
      {activeEntries.length > 0 && <ActiveEntriesTable activeEntries={activeEntries} handleClockOut={handleClockOut} />}

      {/* Zgodovina */}
      <CompletedEntriesTable completedEntries={completedEntries} entriesLoading={entriesLoading} />
    </div>
  )
})
