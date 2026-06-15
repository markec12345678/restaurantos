'use client'
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShoppingBag, TrendingUp, Wallet, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { authFetch } from '@/components/pos/PinLogin'
import { PeriodType } from './constants'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import dynamic from 'next/dynamic'

// Lazy-loaded podkomponente
const TipsEmployeeTable = dynamic(
  () => import('./TipsSubComponents').then(m => ({ default: m.TipsEmployeeTable })),
  { ssr: false },
)
const TipsPaymentMethods = dynamic(
  () => import('./TipsSubComponents').then(m => ({ default: m.TipsPaymentMethods })),
  { ssr: false },
)

// ============================================
// NAPITNINE — Razčlenitev napitnin po zaposlenih
// ============================================
export function TipsReport() {
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
    queryKey: ['financial-report-tips', period, refDate],
    queryFn: async () => {
      const res = await authFetch(`/api/reports/financial?period=${period}&date=${refDate}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })
  const fmt = (n: number) => `€${n.toFixed(2)}`
  const fmtPct = (n: number) => `${n.toFixed(1)}%`
  if (isLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  if (!fin) return <p className="text-center py-12 text-muted-foreground">Ni podatkov</p>
  const tipsByEmp = fin.tipsByEmployee || []
  const totalTips = fin.totalTips || 0
  const avgTipPerOrder = fin.avgTipPerOrder || 0
  const tipPercentage = fin.tipPercentage || 0
  const periodLabel = fin.periodLabel || ''
  return (
    <div className="space-y-6">
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
      <div className="flex gap-2 justify-center">
        {(['daily', 'weekly', 'monthly', 'yearly'] as PeriodType[]).map(p => (
          <Button key={p} variant={period === p ? 'default' : 'outline'} size="sm" onClick={() => setPeriod(p)}>
            {{ daily: 'Dnevno', weekly: 'Tedensko', monthly: 'Mesečno', yearly: 'Letno' }[p]}
          </Button>
        ))}
      </div>
      {/* Kazalci napitnin */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border">
          <Wallet className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
          <p className="text-xs text-muted-foreground mb-1">Skupne napitnine</p>
          <p className="text-2xl font-bold text-emerald-600">{fmt(totalTips)}</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border">
          <ShoppingBag className="h-5 w-5 mx-auto text-blue-600 mb-1" />
          <p className="text-xs text-muted-foreground mb-1">Povp. na naročilo</p>
          <p className="text-2xl font-bold text-blue-600">{fmt(avgTipPerOrder)}</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border">
          <TrendingUp className="h-5 w-5 mx-auto text-purple-600 mb-1" />
          <p className="text-xs text-muted-foreground mb-1">% napitnine</p>
          <p className="text-2xl font-bold text-purple-600">{fmtPct(tipPercentage)}</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border">
          <Users className="h-5 w-5 mx-auto text-amber-600 mb-1" />
          <p className="text-xs text-muted-foreground mb-1">Zaposleni z napitninami</p>
          <p className="text-2xl font-bold text-amber-600">{tipsByEmp.length}</p>
        </div>
      </div>
      {/* Grafikon napitnin po zaposlenih */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-4 w-4" />
              Napitnine po zaposlenih
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tipsByEmp.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tipsByEmp} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                    <YAxis type="category" dataKey="employeeName" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Napitnine']} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                    <Bar dataKey="tips" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center py-12 text-muted-foreground">Ni napitnin v tem obdobju</p>
            )}
          </CardContent>
        </Card>
        <TipsEmployeeTable tipsByEmp={tipsByEmp} fmt={fmt} />
      </div>
      <TipsPaymentMethods paymentMethods={fin.paymentMethods || []} fmt={fmt} />
    </div>
  )
}
