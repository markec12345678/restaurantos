'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LogOut } from 'lucide-react'
import { formatDateTimeSI, minutesToHours } from './constants'

// ============================================
// TABELA AKTIVNIH PRIJAV
// ============================================

interface ActiveEntriesTableProps {
  activeEntries: { id: string; employee: { id: string; name: string }; job: { id: string; name: string } | null; clockIn: string }[]
  handleClockOut: (_entryId: string) => void
}

export const ActiveEntriesTable = memo(function ActiveEntriesTable({
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
