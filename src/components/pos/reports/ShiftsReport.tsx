'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Clock } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { ShiftRow } from '@/lib/types'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'

// ============================================
// POROČILO IZMEN (BLAGAJNA)
// ============================================
export function ShiftsReport() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.reports.shifts({ startDate: startDate, endDate: endDate }),
    queryFn: async () => {
      const res = await authFetch(`/api/reports/shifts?startDate=${startDate}&endDate=${endDate}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })
  const fmt = (n: number) => `€${n.toFixed(2)}`
  const formatDuration = (min: number) => {
    const h = Math.floor(min / 60)
    const m = min % 60
    return `${h}h ${m}min`
  }
  if (isLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  if (!data) return <p className="text-center py-12 text-muted-foreground">Ni podatkov</p>
  const { shifts, summary } = data
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Poročilo izmen (blagajna)
        </h3>
        <div className="flex items-center gap-3">
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36" aria-label="Datum začetka" />
          <span className="text-muted-foreground">—</span>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36" aria-label="Datum konca" />
        </div>
      </div>
      {/* Povzetek */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Izmene skupaj</p><p className="text-xl font-bold">{summary.totalShifts}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Skupaj prodaja</p><p className="text-xl font-bold text-blue-600">{fmt(summary.totalSales)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Gotovina</p><p className="text-xl font-bold text-green-600">{fmt(summary.totalCashSales)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Kartice</p><p className="text-xl font-bold text-blue-600">{fmt(summary.totalCardSales)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Napitnine</p><p className="text-xl font-bold text-emerald-600">{fmt(summary.totalTips)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Povpr. trajanje</p><p className="text-xl font-bold">{formatDuration(summary.avgDurationMinutes)}</p></CardContent></Card>
      </div>
      {/* Seznam izmen */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Seznam izmen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left p-3 font-medium">Zaposleni</th>
                  <th className="text-left p-3 font-medium">Odprto</th>
                  <th className="text-left p-3 font-medium">Zaprto</th>
                  <th className="text-right p-3 font-medium">Trajanje</th>
                  <th className="text-right p-3 font-medium">Začetna</th>
                  <th className="text-right p-3 font-medium">Končna</th>
                  <th className="text-right p-3 font-medium">Gotovina</th>
                  <th className="text-right p-3 font-medium">Kartice</th>
                  <th className="text-right p-3 font-medium">Skupaj</th>
                  <th className="text-right p-3 font-medium">Napitnine</th>
                  <th className="text-right p-3 font-medium">Razlika</th>
                  <th className="text-center p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift: ShiftRow) => (
                  <tr key={shift.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium">{shift.employeeName || '—'}</td>
                    <td className="p-3 text-xs">{new Date(shift.openedAt ?? shift.startTime).toLocaleString('sl-SI')}</td>
                    <td className="p-3 text-xs">{shift.closedAt ? new Date(shift.closedAt).toLocaleString('sl-SI') : <Badge variant="outline" className="text-xs bg-green-50 text-green-700">Odprto</Badge>}</td>
                    <td className="p-3 text-right">{formatDuration(shift.durationMinutes ?? 0)}</td>
                    <td className="p-3 text-right">{fmt(shift.startingCash ?? 0)}</td>
                    <td className="p-3 text-right">{fmt(shift.closingCash ?? 0)}</td>
                    <td className="p-3 text-right text-green-600">{fmt(shift.cashSales ?? 0)}</td>
                    <td className="p-3 text-right text-blue-600">{fmt(shift.cardSales ?? 0)}</td>
                    <td className="p-3 text-right font-semibold">{fmt(shift.totalSales ?? 0)}</td>
                    <td className="p-3 text-right text-emerald-600">{fmt(shift.totalTips ?? 0)}</td>
                    <td className={`p-3 text-right font-semibold ${(shift.cashDifference ?? 0) < -0.01 ? 'text-red-600' : (shift.cashDifference ?? 0) > 0.01 ? 'text-green-600' : ''}`}>{fmt(shift.cashDifference ?? 0)}</td>
                    <td className="p-3 text-center"><Badge variant={shift.status === 'open' ? 'default' : 'secondary'}>{shift.status === 'open' ? 'Odprto' : 'Zaprto'}</Badge></td>
                  </tr>
                ))}
                {shifts.length === 0 && (
                  <tr><td colSpan={12} className="p-6 text-center text-muted-foreground">Ni izmen za izbrano obdobje</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
