'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { LogIn, LogOut } from 'lucide-react'
import { TimeTabProps, entryTypeConfig, formatDateTimeSI, minutesToHours } from './constants'

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

// ============================================
// TABELA AKTIVNIH PRIJAV
// ============================================

interface ActiveEntriesTableProps {
  activeEntries: { id: string; employee: { id: string; name: string }; job: { id: string; name: string } | null; clockIn: string }[]
  handleClockOut: (_entryId: string) => void
}

const ActiveEntriesTable = memo(function ActiveEntriesTable({
  activeEntries,
  handleClockOut,
}: ActiveEntriesTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-4 pt-3 pb-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"><span className="sr-only">Aktivno</span></div>
            Trenutno prijavljeni ({activeEntries.length})
          </h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zaposleni</TableHead>
              <TableHead>Funkcija</TableHead>
              <TableHead>Prijava</TableHead>
              <TableHead>Trajanje</TableHead>
              <TableHead className="text-right">Dejanja</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeEntries.map(entry => {
              const elapsed = Math.floor((Date.now() - new Date(entry.clockIn).getTime()) / 60000)
              return (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium text-sm">{entry.employee?.name || 'Neznan'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{entry.job?.name || '—'}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{formatDateTimeSI(entry.clockIn)}</TableCell>
                  <TableCell className="text-sm font-mono">{minutesToHours(elapsed)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleClockOut(entry.id)}>
                      <LogOut className="h-3 w-3 mr-1" />Odjava
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
})

// ============================================
// TABELA ZAKLJUČENIH VNOSOV
// ============================================

interface CompletedEntriesTableProps {
  completedEntries: { id: string; employee: { id: string; name: string }; job: { id: string; name: string } | null; clockIn: string; clockOut: string | null; totalMinutes: number; type: string; totalPay: number }[]
  entriesLoading: boolean
}

const CompletedEntriesTable = memo(function CompletedEntriesTable({
  completedEntries,
  entriesLoading,
}: CompletedEntriesTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-4 pt-3 pb-2">
          <h3 className="text-sm font-semibold">Zadnji vnosi ur</h3>
        </div>
        {entriesLoading ? (
          <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : completedEntries.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Ni vnosov ur</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zaposleni</TableHead>
                <TableHead>Funkcija</TableHead>
                <TableHead>Prijava</TableHead>
                <TableHead>Odjava</TableHead>
                <TableHead>Skupaj</TableHead>
                <TableHead>Vrsta</TableHead>
                <TableHead className="text-right">Plača</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedEntries.slice(0, 20).map(entry => {
                const typeCfg = entryTypeConfig[entry.type] || entryTypeConfig.regular
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium text-sm">{entry.employee?.name || 'Neznan'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{entry.job?.name || '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDateTimeSI(entry.clockIn)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{entry.clockOut ? formatDateTimeSI(entry.clockOut) : '—'}</TableCell>
                    <TableCell className="text-sm font-mono">{minutesToHours(entry.totalMinutes)}</TableCell>
                    <TableCell><Badge className={`text-[10px] ${typeCfg.bgColor}`}>{typeCfg.label}</Badge></TableCell>
                    <TableCell className="text-right text-sm font-medium">€{entry.totalPay.toFixed(2)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
})
