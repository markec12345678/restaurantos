'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Users } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { EmployeeRow } from '@/lib/types'
import { authFetch } from '@/components/pos/PinLogin'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { queryKeys } from '@/lib/query-keys'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

// ============================================
// POROČILO PO ZAPOSLENIH
// ============================================
export function EmployeeReport() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.reports.employees({ startDate: startDate, endDate: endDate }),
    queryFn: async () => {
      const res = await authFetch(`/api/reports/employees?startDate=${startDate}&endDate=${endDate}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })
  const fmt = (n: number) => `€${safeToFixed(n, 2)}`
  if (isLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  if (!data) return <p className="text-center py-12 text-muted-foreground">Ni podatkov</p>
  const { employees, totals } = data
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Poročilo po zaposlenih
        </h3>
        <div className="flex items-center gap-3">
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36" aria-label="Datum začetka" />
          <span className="text-muted-foreground">—</span>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36" aria-label="Datum konca" />
        </div>
      </div>
      {/* Povzetek */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Skupaj prihodek</p><p className="text-xl font-bold text-blue-600">{fmt(totals.totalRevenue)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Skupaj napitnine</p><p className="text-xl font-bold text-green-600">{fmt(totals.totalTips)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Naročil skupaj</p><p className="text-xl font-bold">{totals.totalOrders}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Prodanih artiklov</p><p className="text-xl font-bold">{totals.totalItemsSold}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Povpr. naročilo</p><p className="text-xl font-bold">{fmt(totals.avgOrderValue)}</p></CardContent></Card>
      </div>
      {/* Grafikon po zaposlenih */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Prihodek po zaposlenih</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employees} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                <YAxis type="category" dataKey="employeeName" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => [`€${safeToFixed(value, 2)}`, 'Prihodek']} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                <Bar dataKey="totalRevenue" fill="oklch(0.7 0.15 55)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      {/* Tabela po zaposlenih */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Podrobnosti po zaposlenih</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left p-3 font-medium">Zaposleni</th>
                  <th className="text-left p-3 font-medium">Vloga</th>
                  <th className="text-right p-3 font-medium">Naročila</th>
                  <th className="text-right p-3 font-medium">Prihodek</th>
                  <th className="text-right p-3 font-medium">Napitnine</th>
                  <th className="text-right p-3 font-medium">Povpr.</th>
                  <th className="text-right p-3 font-medium">Artikli</th>
                  <th className="text-right p-3 font-medium">Poničeno</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp: EmployeeRow) => (
                  <tr key={emp.employeeId ?? emp.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium">{emp.employeeName ?? emp.name}</td>
                    <td className="p-3 text-muted-foreground">{emp.role}</td>
                    <td className="p-3 text-right">{emp.orderCount ?? 0}</td>
                    <td className="p-3 text-right font-semibold">{fmt(emp.totalRevenue ?? 0)}</td>
                    <td className="p-3 text-right text-green-600">{fmt(emp.totalTips ?? 0)}</td>
                    <td className="p-3 text-right">{fmt(emp.avgOrderValue ?? 0)}</td>
                    <td className="p-3 text-right">{emp.itemsSold ?? 0}</td>
                    <td className="p-3 text-right text-red-600">{emp.voidedItems ?? 0}</td>
                  </tr>
                ))}
                <tr className="bg-muted/50 font-bold">
                  <td className="p-3" colSpan={2}>SKUPAJ</td>
                  <td className="p-3 text-right">{totals.totalOrders}</td>
                  <td className="p-3 text-right">{fmt(totals.totalRevenue)}</td>
                  <td className="p-3 text-right text-green-600">{fmt(totals.totalTips)}</td>
                  <td className="p-3 text-right">{fmt(totals.avgOrderValue)}</td>
                  <td className="p-3 text-right">{totals.totalItemsSold}</td>
                  <td className="p-3 text-right text-red-600">{totals.totalVoidedItems}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {employees.length === 0 && <p className="text-center py-8 text-muted-foreground">Ni podatkov za izbrano obdobje</p>}
    </div>
  )
}
