'use client'
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TrendingUp, BarChart3, Clock, Flame, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { authFetch } from '@/components/pos/PinLogin'
import { PeriodType } from './constants'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

// ============================================
// TOPLOTNA KARTA — Urna analiza prometa
// ============================================
export function HeatmapReport() {
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
  const fmt = (n: number) => `€${n.toFixed(2)}`
  if (isLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  if (!fin) return <p className="text-center py-12 text-muted-foreground">Ni podatkov</p>
  const heatmap = fin.hourlyHeatmap || []
  const _maxRevenue = Math.max(...heatmap.map((h: { revenue: number }) => h.revenue), 1)
  // Barvna skala za intenziteto
  const getIntensityColor = (intensity: number) => {
    if (intensity === 0) return 'bg-gray-100 dark:bg-gray-800'
    if (intensity < 20) return 'bg-blue-200 dark:bg-blue-900/40'
    if (intensity < 40) return 'bg-green-200 dark:bg-green-900/40'
    if (intensity < 60) return 'bg-yellow-200 dark:bg-yellow-900/40'
    if (intensity < 80) return 'bg-orange-300 dark:bg-orange-900/40'
    return 'bg-red-400 dark:bg-red-900/50'
  }
  const getIntensityText = (intensity: number) => {
    if (intensity === 0) return 'text-gray-500'
    if (intensity < 40) return 'text-gray-700 dark:text-gray-300'
    if (intensity < 70) return 'text-gray-800 dark:text-gray-200'
    return 'text-white dark:text-white'
  }
  // Identificiraj špice
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
      {/* Toplotna karta — 24 ur */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Flame className="h-4 w-4" />
            Urna toplotna karta prometa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
            {heatmap.map((h: { hour: number; revenue: number; orders: number; intensity: number; label: string }) => (
              <div
                key={h.hour}
                className={`relative p-2 rounded-lg text-center cursor-default transition-transform hover:scale-105 ${getIntensityColor(h.intensity)}`}
                title={`Ura ${h.hour}:00 — ${fmt(h.revenue)} | ${h.orders} naročil | ${h.label}`}
              >
                <p className={`text-xs font-bold ${getIntensityText(h.intensity)}`}>{String(h.hour).padStart(2, '0')}:00</p>
                <p className={`text-[10px] ${getIntensityText(h.intensity)}`}>{h.revenue > 0 ? fmt(h.revenue) : '—'}</p>
                <p className={`text-[9px] opacity-70 ${getIntensityText(h.intensity)}`}>{h.orders > 0 ? `${h.orders}×` : ''}</p>
              </div>
            ))}
          </div>
          {/* Legenda */}
          <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
            <span>Nizka</span>
            <div className="flex gap-1">
              <div className="w-4 h-4 rounded bg-gray-100 dark:bg-gray-800" />
              <div className="w-4 h-4 rounded bg-blue-200 dark:bg-blue-900/40" />
              <div className="w-4 h-4 rounded bg-green-200 dark:bg-green-900/40" />
              <div className="w-4 h-4 rounded bg-yellow-200 dark:bg-yellow-900/40" />
              <div className="w-4 h-4 rounded bg-orange-300 dark:bg-orange-900/40" />
              <div className="w-4 h-4 rounded bg-red-400 dark:bg-red-900/50" />
            </div>
            <span>Visoka</span>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Časovni razdelki */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Promet po delih dneva
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={heatmap}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}h`} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                  <Tooltip formatter={(value: number, name: string) => [name === 'revenue' ? `€${value.toFixed(2)}` : value, name === 'revenue' ? 'Prihodek' : 'Naročila']} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                  <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        {/* Špice */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Najboljše ure (špice)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {peakHours.map((h: { hour: number; revenue: number; orders: number; label: string }, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-amber-500">#{idx + 1}</span>
                    <div>
                      <p className="font-semibold">{String(h.hour).padStart(2, '0')}:00 — {String(h.hour + 1).padStart(2, '0')}:00</p>
                      <p className="text-xs text-muted-foreground">{timeSlotLabels[h.label] || h.label}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">{fmt(h.revenue)}</p>
                    <p className="text-xs text-muted-foreground">{h.orders} naročil</p>
                  </div>
                </div>
              ))}
              {peakHours.length === 0 && (
                <p className="text-center py-6 text-muted-foreground">Ni prometa v tem obdobju</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Primerjava s prejšnjim obdobjem */}
      {fin.periodComparison && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Primerjava s prejšnjim obdobjem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Prihodek', current: fin.periodComparison.current.revenue, previous: fin.periodComparison.previous.revenue, change: fin.periodComparison.changes.revenue },
                { label: 'Naročila', current: fin.periodComparison.current.orders, previous: fin.periodComparison.previous.orders, change: fin.periodComparison.changes.orders },
                { label: 'Povp. naročilo', current: fin.periodComparison.current.avgOrderValue, previous: fin.periodComparison.previous.avgOrderValue, change: fin.periodComparison.changes.avgOrderValue },
                { label: 'Napitnine', current: fin.periodComparison.current.tips, previous: fin.periodComparison.previous.tips, change: fin.periodComparison.changes.tips },
              ].map((item, idx) => (
                <div key={idx} className="text-center p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-lg font-bold">{typeof item.current === 'number' && item.label !== 'Naročila' ? fmt(item.current) : item.current}</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <span className="text-xs text-muted-foreground">prej: {typeof item.previous === 'number' && item.label !== 'Naročila' ? fmt(item.previous) : item.previous}</span>
                    {item.change !== 0 && (
                      <Badge variant={item.change > 0 ? 'default' : 'destructive'} className="text-[10px] px-1">
                        {item.change > 0 ? '+' : ''}{item.change.toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
