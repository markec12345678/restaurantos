'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { entryTypeConfig, formatDateTimeSI, minutesToHours } from './constants'

// ============================================
// TABELA ZAKLJUČENIH VNOSOV
// ============================================

interface CompletedEntriesTableProps {
  completedEntries: { id: string; employee: { id: string; name: string }; job: { id: string; name: string } | null; clockIn: string; clockOut: string | null; totalMinutes: number; type: string; totalPay: number }[]
  entriesLoading: boolean
}

export const CompletedEntriesTable = memo(function CompletedEntriesTable({
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
