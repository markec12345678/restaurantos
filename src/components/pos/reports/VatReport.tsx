'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Receipt, Clock } from 'lucide-react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { PIE_COLORS } from './constants'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

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
  const fmt = (n: number) => `€${n.toFixed(2)}`
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
      {/* Povzetek */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border">
          <p className="text-xs text-muted-foreground mb-1">Skupna osnova</p>
          <p className="text-xl font-bold text-blue-600">{fmt(vatData.summary.totalBase)}</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border">
          <p className="text-xs text-muted-foreground mb-1">Skupni DDV</p>
          <p className="text-xl font-bold text-red-600">{fmt(vatData.summary.totalVat)}</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border">
          <p className="text-xs text-muted-foreground mb-1">Z DDV</p>
          <p className="text-xl font-bold text-green-600">{fmt(vatData.summary.totalWithVat)}</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border">
          <p className="text-xs text-muted-foreground mb-1">Naročila</p>
          <p className="text-xl font-bold text-purple-600">{vatData.summary.completedOrders}</p>
        </div>
      </div>
      {/* DDV po stopnjah */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">DDV po stopnjah</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left p-3 font-medium">Stopnja</th>
                    <th className="text-right p-3 font-medium">Osnova</th>
                    <th className="text-right p-3 font-medium">DDV</th>
                    <th className="text-right p-3 font-medium">Skupaj</th>
                    <th className="text-right p-3 font-medium">Koda</th>
                  </tr>
                </thead>
                <tbody>
                  {vatData.vatBreakdown.map((vr: { rate: number; label: string; code: string; baseAmount: number; vatAmount: number; totalAmount: number; itemCount: number }, idx: number) => (
                    <tr key={idx} className="border-b hover:bg-muted/30">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: vatColors[String(vr.rate)] || '#888' }} />
                          <span className="font-medium">{vr.label}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right">{fmt(vr.baseAmount)}</td>
                      <td className="p-3 text-right font-semibold" style={{ color: vatColors[String(vr.rate)] }}>{fmt(vr.vatAmount)}</td>
                      <td className="p-3 text-right font-semibold">{fmt(vr.totalAmount)}</td>
                      <td className="p-3 text-right"><Badge variant="outline" className="font-mono text-xs">{vr.code}</Badge></td>
                    </tr>
                  ))}
                  <tr className="bg-muted/50 font-bold">
                    <td className="p-3">SKUPAJ</td>
                    <td className="p-3 text-right">{fmt(vatData.summary.totalBase)}</td>
                    <td className="p-3 text-right">{fmt(vatData.summary.totalVat)}</td>
                    <td className="p-3 text-right">{fmt(vatData.summary.totalWithVat)}</td>
                    <td className="p-3"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        {/* Tortni diagram DDV */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Delež po DDV stopnjah</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={vatData.vatBreakdown.filter((vr: { baseAmount: number }) => vr.baseAmount > 0)}
                    dataKey="totalAmount"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ label, percent }: { label: string; percent: number }) => `${label} ${(percent * 100).toFixed(0)}%`}
                  >
                    {vatData.vatBreakdown.filter((vr: { baseAmount: number }) => vr.baseAmount > 0).map((vr: { rate: number }, index: number) => (
                      <Cell key={`cell-${index}`} fill={vatColors[String(vr.rate)] || PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Znesek z DDV']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Časovna razdelitev DDV */}
      {vatData.timeDistribution && vatData.timeDistribution.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-4 w-4" />
              DDV po obdobjih
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vatData.timeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                  <Legend />
                  <Bar dataKey="vat22" name="DDV 22%" fill="#ef4444" stackId="vat" />
                  <Bar dataKey="vat95" name="DDV 9.5%" fill="#f59e0b" stackId="vat" />
                  <Bar dataKey="vat0" name="DDV 0%" fill="#10b981" stackId="vat" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
      {/* FURS format */}
      <Card className="border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            FURS davčni format
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary/10 border-b">
                  <th className="text-left p-3 font-medium">Koda</th>
                  <th className="text-right p-3 font-medium">Stopnja (%)</th>
                  <th className="text-right p-3 font-medium">Davčna osnova</th>
                  <th className="text-right p-3 font-medium">DDV znesek</th>
                </tr>
              </thead>
              <tbody>
                {vatData.fursFormat.map((f: { code: string; taxRate: number; taxBase: number; taxAmount: number }, idx: number) => (
                  <tr key={idx} className="border-b">
                    <td className="p-3 font-mono font-bold">{f.code}</td>
                    <td className="p-3 text-right">{f.taxRate}%</td>
                    <td className="p-3 text-right">{fmt(f.taxBase)}</td>
                    <td className="p-3 text-right font-semibold">{fmt(f.taxAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Kode: S = Standardna stopnja (22%), R = Znižana stopnja (9.5%), Z = Oproščeno (0%)
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
