'use client'
import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Receipt } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { VatSummaryCards } from './SubComponents/VatReport/VatSummaryCards'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { VatBreakdownTable } from './SubComponents/VatReport/VatBreakdownTable'
import { VatPieChart } from './SubComponents/VatReport/VatPieChart'
import { FursFormatTable } from './SubComponents/VatReport/FursFormatTable'
import { VatTimeDistribution } from './SubComponents/VatReport/VatTimeDistribution'

// ============================================
// DDV POROČILO — Posebna komponenta za davčno razčlenitev
// ============================================
export function VatReport({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [vatPeriod, setVatPeriod] = useState('monthly')
  const [vatStart, setVatStart] = useState(startDate)
  const [vatEnd, setVatEnd] = useState(endDate)
  const { data: vatData, isLoading: vatLoading } = useQuery({
    queryKey: queryKeys.reports.vat({ vatPeriod: vatPeriod, vatStart: vatStart, vatEnd: vatEnd }),
    queryFn: async () => {
      const res = await authFetch(`/api/reports/vat?period=${vatPeriod}&startDate=${vatStart}&endDate=${vatEnd}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })
  const fmt = (n: number) => `€${safeToFixed(n, 2)}`
  if (vatLoading) {
    return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  }
  if (!vatData) return <p className="text-center py-12 text-muted-foreground">Ni podatkov</p>
  const vatColors: Record<string, string> = {
    '22': '#ef4444',
    '9.5': '#f59e0b',
    '0': '#10b981',
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          DDV razčlenitev
        </h3>
        <div className="flex items-center gap-3">
          <Input type="date" value={vatStart} onChange={e => setVatStart(e.target.value)} className="w-36" aria-label="Datum začetka" />
          <span className="text-muted-foreground">—</span>
          <Input type="date" value={vatEnd} onChange={e => setVatEnd(e.target.value)} className="w-36" aria-label="Datum konca" />
          <div className="flex gap-1">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(p => (
              <Button key={p} variant={vatPeriod === p ? 'default' : 'outline'} size="sm" onClick={() => setVatPeriod(p)}>
                {{ daily: 'Dnevno', weekly: 'Tedensko', monthly: 'Mesečno', yearly: 'Letno' }[p]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <VatSummaryCards summary={vatData.summary} fmt={fmt} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <VatBreakdownTable vatBreakdown={vatData.vatBreakdown} vatColors={vatColors} fmt={fmt} summary={vatData.summary} />
        <VatPieChart vatBreakdown={vatData.vatBreakdown} vatColors={vatColors} />
      </div>

      {vatData.timeDistribution && vatData.timeDistribution.length > 0 && (
        <VatTimeDistribution data={vatData.timeDistribution} />
      )}

      <FursFormatTable fursFormat={vatData.fursFormat} fmt={fmt} />
    </div>
  )
}
