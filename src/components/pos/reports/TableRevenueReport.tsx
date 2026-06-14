'use client'
import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DollarSign, ShoppingBag, Wallet, ChevronLeft, ChevronRight, UtensilsCrossed } from 'lucide-react'
import { format } from 'date-fns'
import { authFetch } from '@/components/pos/PinLogin'
import { PeriodType, PIE_COLORS } from './constants'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

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
      {/* Povzetek */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border">
          <UtensilsCrossed className="h-5 w-5 mx-auto text-blue-600 mb-1" />
          <p className="text-xs text-muted-foreground mb-1">Aktivne mize</p>
          <p className="text-2xl font-bold text-blue-600">{tables.length}</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border">
          <DollarSign className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
          <p className="text-xs text-muted-foreground mb-1">Prihodek mize</p>
          <p className="text-2xl font-bold text-emerald-600">{fmt(totalTableRevenue)}</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border">
          <ShoppingBag className="h-5 w-5 mx-auto text-purple-600 mb-1" />
          <p className="text-xs text-muted-foreground mb-1">Naročila</p>
          <p className="text-2xl font-bold text-purple-600">{totalTableOrders}</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border">
          <Wallet className="h-5 w-5 mx-auto text-amber-600 mb-1" />
          <p className="text-xs text-muted-foreground mb-1">Napitnine</p>
          <p className="text-2xl font-bold text-amber-600">{fmt(totalTableTips)}</p>
        </div>
      </div>
      {/* Grafikon po mizah */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4" />
              Prihodek po mizah
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tables.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tables.slice(0, 15)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="tableNumber" tick={{ fontSize: 11 }} label={{ value: 'Miza', position: 'insideBottom', offset: -5, fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                    <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Prihodek']} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center py-12 text-muted-foreground">Ni naročil za mizami v tem obdobju</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Prihodek po conah</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.values(areas).length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.values(areas)}
                      dataKey="revenue"
                      nameKey="area"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ area, percent }: { area: string; percent: number }) => `${areaLabels[area] || area} ${(percent * 100).toFixed(0)}%`}
                    >
                      {Object.values(areas).map((_entry: unknown, index: number) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Prihodek']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center py-12 text-muted-foreground">Ni podatkov po conah</p>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Tabela podrobnosti */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Podrobnosti po mizah</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50">
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Miza</th>
                  <th className="text-left p-3 font-medium">Cona</th>
                  <th className="text-right p-3 font-medium">Naročila</th>
                  <th className="text-right p-3 font-medium">Prihodek</th>
                  <th className="text-right p-3 font-medium">Povp.</th>
                  <th className="text-right p-3 font-medium">Napitnine</th>
                </tr>
              </thead>
              <tbody>
                {tables.map((t: { tableNumber: number; area: string; orderCount: number; revenue: number; avgOrder: number; tips: number }, idx: number) => (
                  <tr key={idx} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-bold">Miza {t.tableNumber}</td>
                    <td className="p-3">{areaLabels[t.area] || t.area}</td>
                    <td className="p-3 text-right">{t.orderCount}</td>
                    <td className="p-3 text-right font-semibold text-emerald-600">{fmt(t.revenue)}</td>
                    <td className="p-3 text-right">{fmt(t.avgOrder)}</td>
                    <td className="p-3 text-right text-amber-600">{fmt(t.tips)}</td>
                  </tr>
                ))}
                {tables.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Ni naročil za mizami</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
