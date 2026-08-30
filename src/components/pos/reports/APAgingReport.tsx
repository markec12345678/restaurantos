'use client'

// ============================================
// AP AGING REPORT — Obveznosti dobaviteljem po starosti
// ============================================

import { memo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { format } from 'date-fns'

interface AgingBucket {
  count: number
  total: number
  entries: Array<Record<string, unknown>>
}

interface AgingResponse {
  summary: {
    totalEntries: number
    grandTotal: number
    totalPaid: number
    totalOutstanding: number
  }
  aging: {
    current: AgingBucket
    '0-30': AgingBucket
    '31-60': AgingBucket
    '61-90': AgingBucket
    '90+': AgingBucket
  }
  entries: Array<Record<string, unknown>>
}

const BUCKET_CONFIG = [
  { key: 'current' as const, label: 'Nezapadlo', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/20', icon: CheckCircle2 },
  { key: '0-30' as const, label: '0-30 dni', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/20', icon: Clock },
  { key: '31-60' as const, label: '31-60 dni', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20', icon: Clock },
  { key: '61-90' as const, label: '61-90 dni', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/20', icon: AlertTriangle },
  { key: '90+' as const, label: '90+ dni', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20', icon: AlertTriangle },
]

export const APAgingReport = memo(function APAgingReport() {
  const [showAll, setShowAll] = useState(false)

  const { data, isLoading, refetch, isFetching } = useQuery<AgingResponse>({
    queryKey: ['ap-aging-report'],
    queryFn: async () => {
      const res = await authFetch(`/api/reports/ap-aging?status=${showAll ? 'all' : 'open'}`)
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!data) return null

  const { summary, aging } = data

  return (
    <div className="space-y-4">
      {/* Header z osveževanjem */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">AP Aging — Obveznosti dobaviteljem</h3>
          <p className="text-xs text-muted-foreground">
            Skupaj: {summary.totalEntries} obveznosti ·
            Odprto: €{safeToFixed(summary.totalOutstanding, 2)} ·
            Plačano: €{safeToFixed(summary.totalPaid, 2)} ·
            Skupna vrednost: €{safeToFixed(summary.grandTotal, 2)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Prikaži samo odprte' : 'Prikaži vse'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            Osveži
          </Button>
        </div>
      </div>

      {/* Aging bucket kartice */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {BUCKET_CONFIG.map(({ key, label, color, bg, icon: Icon }) => {
          const bucket = aging[key]
          return (
            <Card key={key} className={bg}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className={`text-xs font-semibold ${color}`}>{label}</span>
                </div>
                <p className="text-2xl font-bold">{bucket.count}</p>
                <p className="text-xs text-muted-foreground">€{safeToFixed(bucket.total, 2)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {bucket.count === 1 ? '1 obveznost' : `${bucket.count} obveznosti`}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Tabela obveznosti */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Vse obveznosti</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-semibold">AP številka</th>
                  <th className="text-left p-3 font-semibold">Dobavitelj</th>
                  <th className="text-left p-3 font-semibold">Račun</th>
                  <th className="text-left p-3 font-semibold">PO</th>
                  <th className="text-right p-3 font-semibold">Znesek</th>
                  <th className="text-right p-3 font-semibold">Plačano</th>
                  <th className="text-right p-3 font-semibold">Odprto</th>
                  <th className="text-left p-3 font-semibold">Datum računa</th>
                  <th className="text-left p-3 font-semibold">Zapadlost</th>
                  <th className="text-center p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(data.entries) && data.entries.length > 0 ? (
                  data.entries.map((ap: Record<string, unknown>, idx: number) => {
                    const total = Number(ap.totalAmount) || 0
                    const paid = Number(ap.paidAmount) || 0
                    const outstanding = total - paid
                    const dueDate = ap.dueDate ? new Date(ap.dueDate as string) : null
                    const invoiceDate = ap.invoiceDate ? new Date(ap.invoiceDate as string) : null
                    const daysOverdue = dueDate
                      ? Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                      : 0
                    const supplier = ap.supplier as { name?: string; code?: string } | undefined
                    const po = ap.purchaseOrder as { poNumber?: string } | null

                    let statusColor = 'bg-gray-100 text-gray-800'
                    let statusLabel = String(ap.status || 'open')
                    if (ap.status === 'open') statusColor = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                    else if (ap.status === 'partial') statusColor = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                    else if (ap.status === 'paid') statusColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                    else if (ap.status === 'overdue') statusColor = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'

                    return (
                      <tr key={String(ap.id || idx)} className="border-b hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs">{String(ap.apNumber || '—')}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{supplier?.name || 'Neznan'}</span>
                            {supplier?.code && <Badge variant="outline" className="text-[8px] h-3 px-1">{supplier.code}</Badge>}
                          </div>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{String(ap.invoiceNumber || '—')}</td>
                        <td className="p-3 text-xs font-mono">{po?.poNumber || '—'}</td>
                        <td className="p-3 text-right font-medium">€{safeToFixed(total, 2)}</td>
                        <td className="p-3 text-right text-emerald-600">€{safeToFixed(paid, 2)}</td>
                        <td className={`p-3 text-right font-bold ${outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          €{safeToFixed(outstanding, 2)}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {invoiceDate && !isNaN(invoiceDate.getTime()) ? format(invoiceDate, 'd. MMM yyyy') : '—'}
                        </td>
                        <td className="p-3 text-xs">
                          {dueDate && !isNaN(dueDate.getTime()) ? (
                            <span className={daysOverdue > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                              {format(dueDate, 'd. MMM yyyy')}
                              {daysOverdue > 0 && ` (${daysOverdue}d preteklo)`}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className={`text-[9px] h-5 px-1.5 ${statusColor}`}>
                            {statusLabel}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground">
                      Ni obveznosti dobaviteljem
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
