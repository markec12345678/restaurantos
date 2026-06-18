'use client'
import { useState, useCallback, memo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { authFetch } from '@/components/pos/PinLogin'
import { PeriodType } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { HeatmapGrid } from './HeatmapSubComponents'
import { PeakHoursCard } from './PeakHoursCard'
import { PeriodComparisonCard } from './PeriodComparisonCard'
import { TimeSlotChart } from './HeatmapSubComponents/TimeSlotChart'

// ============================================
// TOPLOTNA KARTA — Urna analiza prometa
// ============================================
export const HeatmapReport = memo(function HeatmapReport() {
  const [period, _setPeriod] = useState<PeriodType>('daily')
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
    queryKey: ['financial-report-heatmap', period, refDate],
    queryFn: async () => {
      const res = await authFetch(`/api/reports/financial?period=${period}&date=${refDate}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })
  const fmt = (n: number) => `€${safeToFixed(n, 2)}`
  if (isLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  if (!fin) return <p className="text-center py-12 text-muted-foreground">Ni podatkov</p>
  const heatmap = fin.hourlyHeatmap || []
  const peakHours = heatmap
    .filter((h: { revenue: number }) => h.revenue > 0)
    .sort((a: { revenue: number }, b: { revenue: number }) => b.revenue - a.revenue)
    .slice(0, 5)
  const timeSlotLabels: Record<string, string> = {
    'Noč': '🌙 Noč (0-5h)',
    'Jutro': '☀️ Jutro (6-9h)',
    'Kosilo': '🍽️ Kosilo (10-13h)',
    'Popoldne': '☕ Popoldne (14-16h)',
    'Večerja': '🍷 Večerja (17-20h)',
    'Po večerji': '🌃 Po večerji (21-23h)',
  }
  return (
    <div className="space-y-6">
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

      <HeatmapGrid heatmap={heatmap} fmt={fmt} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TimeSlotChart heatmap={heatmap} />
        <PeakHoursCard peakHours={peakHours} fmt={fmt} timeSlotLabels={timeSlotLabels} />
      </div>

      {fin.periodComparison && (
        <PeriodComparisonCard periodComparison={fin.periodComparison} fmt={fmt} />
      )}
    </div>
  )
})
