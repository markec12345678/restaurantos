'use client'
import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileText, Printer, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { PeriodType } from './constants'
import type { FinancialData } from './booking-extract/types'
import { RevenueTable } from './booking-extract/RevenueTable'
import { CostsTable } from './booking-extract/CostsTable'
import { BookingEntryTable } from './booking-extract/BookingEntryTable'
import { BreakdownTables } from './booking-extract/BreakdownTables'

// ============================================
// IZPISKI ZA KNJIŽENJE — Booking extract report
// ============================================
export function BookingExtractReport() {
  const [period, setPeriod] = useState<PeriodType>('daily')
  const [refDate, setRefDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const navigateDate = useCallback((dir: number) => {
    setRefDate(prev => {
      const d = new Date(prev)
      switch (period) {
        case 'daily': d.setDate(d.getDate() + dir); break
        case 'weekly': d.setDate(d.getDate() + dir * 7); break
        case 'monthly': d.setMonth(d.getMonth() + dir); break
        case 'yearly': d.setFullYear(d.getFullYear() + dir); break
      }
      return format(d, 'yyyy-MM-dd')
    })
  }, [period])
  const { data: fin, isLoading: finLoading } = useQuery<FinancialData>({
    queryKey: queryKeys.reports.financial({ period: period, refDate: refDate }),
    queryFn: async () => {
      const res = await authFetch(`/api/reports/financial?period=${period}&date=${refDate}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })
  const periodLabel = useMemo(() => {
    if (!fin) return ''
    return fin.periodLabel || ''
  }, [fin])
  const fmt = (n: number) => `€${n.toFixed(2)}`
  const fmtPct = (n: number) => `${n.toFixed(1)}%`

  if (finLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  if (!fin) return <p className="text-center py-12 text-muted-foreground">Ni podatkov</p>

  return (
    <div className="space-y-6">
      {/* Navigacija po datumih */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" aria-label="Nazaj" onClick={() => navigateDate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center min-w-48">
          <Input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} className="text-center w-40 mx-auto" aria-label="Datum poročila" />
          <p className="text-sm text-muted-foreground mt-1">{periodLabel}</p>
        </div>
        <Button variant="outline" size="icon" aria-label="Naprej" onClick={() => navigateDate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {/* Izbira obdobja za izpiske */}
      <div className="flex gap-2 justify-center">
        {(['daily', 'weekly', 'monthly', 'yearly'] as PeriodType[]).map(p => (
          <Button key={p} variant={period === p ? 'default' : 'outline'} size="sm" onClick={() => setPeriod(p)}>
            {{ daily: 'Dnevno', weekly: 'Tedensko', monthly: 'Mesečno', yearly: 'Letno' }[p]}
          </Button>
        ))}
      </div>
      {/* Izpisek prometa */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Izpisek prometa — {periodLabel}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5 mr-1" /> Natisni
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Povzetek prometa */}
          <RevenueTable fin={fin} fmt={fmt} />
          {/* Stroški */}
          <CostsTable costs={fin.costs} fmt={fmt} fmtPct={fmtPct} />
          {/* Knjižbeni zapis */}
          <BookingEntryTable be={fin.bookingEntry} fmt={fmt} />
          {/* Kategorije, artikli, statistika */}
          <BreakdownTables fin={fin} fmt={fmt} fmtPct={fmtPct} />
        </CardContent>
      </Card>
    </div>
  )
}
