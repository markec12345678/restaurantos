'use client'
import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { authFetch } from '@/components/pos/PinLogin'
import { PeriodType } from './constants'
import { TableRevenueSummaryCards } from './table-revenue/TableRevenueSummaryCards'
import { TableRevenueCharts } from './table-revenue/TableRevenueCharts'
import { TableRevenueDetailsTable } from './table-revenue/TableRevenueDetailsTable'

// ============================================
// PRIHODEK PO MIZAH — Analiza zasedenosti in prometa
// ============================================
export function TableRevenueReport() {
  const [period, setPeriod] = useState<PeriodType>('daily')
  const [refDate, setRefDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const navigateDate = useCallback((dir: number) => {
    const d = new Date(refDate)
    switch (period) {
      case 'daily': d.setDate(d.getDate() + dir); break
      case 'weekly': d.setDate(d.getDate() + dir * 7); break
      case 'monthly': d.setMonth(d.getMonth() + dir); break
      case 'yearly': d.setFullYear(d.getFullYear() + dir); break
    }
    setRefDate(format(d, 'yyyy-MM-dd'))
  }, [refDate, period])
  const { data: fin, isLoading } = useQuery({
    queryKey: ['financial-report-tables', period, refDate],
    queryFn: async () => {
      const res = await authFetch(`/api/reports/financial?period=${period}&date=${refDate}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })
  const fmt = (n: number) => `€${n.toFixed(2)}`
  const tables = fin?.tableRevenue || []
  // Grupiraj po conah
  const areas = useMemo(() => {
    const result: Record<string, { area: string; tables: typeof tables; revenue: number }> = {}
    tables.forEach((t: { area: string; revenue: number }) => {
      if (!result[t.area]) result[t.area] = { area: t.area, tables: [], revenue: 0 }
      result[t.area].tables.push(t)
      result[t.area].revenue += t.revenue
    })
    return result
  }, [tables])
  if (isLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  if (!fin) return <p className="text-center py-12 text-muted-foreground">Ni podatkov</p>
  const totalTableRevenue = tables.reduce((s: number, t: { revenue: number }) => s + t.revenue, 0)
  const totalTableOrders = tables.reduce((s: number, t: { orderCount: number }) => s + t.orderCount, 0)
  const totalTableTips = tables.reduce((s: number, t: { tips: number }) => s + t.tips, 0)
  const areaLabels: Record<string, string> = {
    main: 'Glavna dvorana',
    terrace: 'Terasa',
    bar: 'Bar',
    vip: 'VIP',
    garden: 'Vrt',
    private: 'Zasebni prostor',
  }
  return (
    <div className="space-y-6">
      {/* Navigacija po datumih */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" aria-label="Nazaj" onClick={() => navigateDate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center min-w-48">
          <Input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} className="text-center w-40 mx-auto" aria-label="Datum poročila" />
          <p className="text-sm text-muted-foreground mt-1">{fin.periodLabel || ''}</p>
        </div>
        <Button variant="outline" size="icon" aria-label="Naprej" onClick={() => navigateDate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex gap-2 justify-center">
        {(['daily', 'weekly', 'monthly', 'yearly'] as PeriodType[]).map(p => (
          <Button key={p} variant={period === p ? 'default' : 'outline'} size="sm" onClick={() => setPeriod(p)}>
            {{ daily: 'Dnevno', weekly: 'Tedensko', monthly: 'Mesečno', yearly: 'Letno' }[p]}
          </Button>
        ))}
      </div>
      <TableRevenueSummaryCards
        activeTables={tables.length}
        totalRevenue={totalTableRevenue}
        totalOrders={totalTableOrders}
        totalTips={totalTableTips}
        fmt={fmt}
      />
      <TableRevenueCharts tables={tables} areas={areas} areaLabels={areaLabels} />
      <TableRevenueDetailsTable tables={tables} areaLabels={areaLabels} fmt={fmt} />
    </div>
  )
}
