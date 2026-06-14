'use client'
import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileText, Receipt, Printer, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { PeriodType, paymentMethodLabels, orderTypeLabels } from './constants'

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
  const { data: fin, isLoading: finLoading } = useQuery({
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
  const be = fin.bookingEntry
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
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left p-3 font-medium">Opis</th>
                  <th className="text-right p-3 font-medium">Znesek</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-3">Skupni promet (bruto)</td>
                  <td className="p-3 text-right font-semibold">{fmt(fin.summary.totalRevenue)}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3 pl-6">Promet brez DDV</td>
                  <td className="p-3 text-right">{fmt(fin.summary.totalSubtotal)}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3 pl-6">DDV</td>
                  <td className="p-3 text-right">{fmt(fin.summary.totalTax)}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3 pl-6">Popusti</td>
                  <td className="p-3 text-right text-red-600">-{fmt(fin.summary.totalDiscount)}</td>
                </tr>
                <tr className="border-b bg-muted/30">
                  <td className="p-3 font-medium">Po plačilnih metodah</td>
                  <td className="p-3 text-right"></td>
                </tr>
                {fin.paymentMethods.map((pm: { method: string; count: number; revenue: number; tax: number }, idx: number) => (
                  <tr key={idx} className="border-b">
                    <td className="p-3 pl-6">{paymentMethodLabels[pm.method] || pm.method} ({pm.count} naročil)</td>
                    <td className="p-3 text-right">{fmt(pm.revenue)}</td>
                  </tr>
                ))}
                <tr className="border-b bg-muted/30">
                  <td className="p-3 font-medium">Po vrstah naročil</td>
                  <td className="p-3 text-right"></td>
                </tr>
                {fin.orderTypes.map((ot: { type: string; count: number; revenue: number }, idx: number) => (
                  <tr key={idx} className="border-b">
                    <td className="p-3 pl-6">{orderTypeLabels[ot.type] || ot.type} ({ot.count} naročil)</td>
                    <td className="p-3 text-right">{fmt(ot.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Stroški */}
          <div className="border rounded-lg overflow-hidden">
            <div className="p-3 bg-muted/50 border-b font-medium">Stroškovna stran</div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="p-3">Nabavni stroški (dobave)</td>
                  <td className="p-3 text-right text-orange-600">{fmt(fin.costs.procurementCost)}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3">Stroški prodanih artiklov (COGS)</td>
                  <td className="p-3 text-right text-red-600">{fmt(fin.costs.cogs)}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3">Odpisi (kvar, razbitje, izguba)</td>
                  <td className="p-3 text-right text-yellow-600">{fmt(fin.costs.writeOffCost)}</td>
                </tr>
                <tr className="bg-green-50 dark:bg-green-900/20">
                  <td className="p-3 font-bold">Bruto dobiček</td>
                  <td className="p-3 text-right font-bold text-green-600">{fmt(fin.costs.grossProfit)} (marža: {fmtPct(fin.costs.grossMargin)})</td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Knjižbeni zapis */}
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Knjižbeni zapis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-primary/10 border-b">
                      <th className="text-left p-3 font-medium">Konto</th>
                      <th className="text-left p-3 font-medium">Opis</th>
                      <th className="text-right p-3 font-medium">Breme (D)</th>
                      <th className="text-right p-3 font-medium">Dobro (C)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(be.debit).map(([account, amount]: [string, unknown]) => (
                      <tr key={account} className="border-b">
                        <td className="p-3 font-mono text-xs">{account.split(' - ')[0]}</td>
                        <td className="p-3">{account.split(' - ')[1]}</td>
                        <td className="p-3 text-right font-semibold">{fmt(amount as number)}</td>
                        <td className="p-3 text-right">—</td>
                      </tr>
                    ))}
                    {Object.entries(be.credit).map(([account, amount]: [string, unknown]) => (
                      <tr key={account} className="border-b bg-muted/30">
                        <td className="p-3 font-mono text-xs">{account.split(' - ')[0]}</td>
                        <td className="p-3">{account.split(' - ')[1]}</td>
                        <td className="p-3 text-right">—</td>
                        <td className="p-3 text-right font-semibold">{fmt(amount as number)}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/50 font-bold">
                      <td className="p-3" colSpan={2}>SKUPAJ</td>
                      <td className="p-3 text-right">{fmt(be.totalDebit)}</td>
                      <td className="p-3 text-right">{fmt(be.totalCredit)}</td>
                    </tr>
                  </tbody>
                </table>
                {Math.abs(be.totalDebit - be.totalCredit) > 0.01 && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">
                    Opozorilo: Zneske se ne ujemajo! Razlika: {fmt(Math.abs(be.totalDebit - be.totalCredit))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          {/* Kategorije izpisek */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Izpisek po kategorijah</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left p-3 font-medium">Kategorija</th>
                      <th className="text-right p-3 font-medium">Količina</th>
                      <th className="text-right p-3 font-medium">Prihodek</th>
                      <th className="text-right p-3 font-medium">Delez</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fin.categoryBreakdown.map((cat: { category: string; quantity: number; revenue: number; items: number }, idx: number) => (
                      <tr key={idx} className="border-b hover:bg-muted/30">
                        <td className="p-3">{cat.category}</td>
                        <td className="p-3 text-right">{cat.quantity}</td>
                        <td className="p-3 text-right font-medium">{fmt(cat.revenue)}</td>
                        <td className="p-3 text-right">{fmtPct(fin.summary.totalRevenue > 0 ? (cat.revenue / fin.summary.totalRevenue) * 100 : 0)}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/50 font-bold">
                      <td className="p-3">SKUPAJ</td>
                      <td className="p-3 text-right">{fin.categoryBreakdown.reduce((s: number, c: { quantity: number }) => s + c.quantity, 0)}</td>
                      <td className="p-3 text-right">{fmt(fin.summary.totalRevenue)}</td>
                      <td className="p-3 text-right">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          {/* Artikli izpisek */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Izpisek po artiklih</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50">
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Artikel</th>
                      <th className="text-left p-3 font-medium">Kategorija</th>
                      <th className="text-right p-3 font-medium">Kol.</th>
                      <th className="text-right p-3 font-medium">Cena</th>
                      <th className="text-right p-3 font-medium">Prihodek</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fin.itemBreakdown.map((item: { name: string; category: string; quantity: number; revenue: number; avgPrice: number }, idx: number) => (
                      <tr key={idx} className="border-b hover:bg-muted/30">
                        <td className="p-3">{item.name}</td>
                        <td className="p-3 text-muted-foreground">{item.category}</td>
                        <td className="p-3 text-right">{item.quantity}</td>
                        <td className="p-3 text-right">{fmt(item.avgPrice)}</td>
                        <td className="p-3 text-right font-medium">{fmt(item.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          {/* Statistika naročil */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Statistika naročil</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground">Vseh naročil</p>
                  <p className="text-xl font-bold">{fin.summary.totalOrdersCount}</p>
                </div>
                <div className="text-center p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground">Zaključenih</p>
                  <p className="text-xl font-bold text-green-600">{fin.summary.completedCount}</p>
                </div>
                <div className="text-center p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground">Preklicanih</p>
                  <p className="text-xl font-bold text-red-600">{fin.summary.cancelledCount}</p>
                </div>
                <div className="text-center p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground">Povpr. vrednost</p>
                  <p className="text-xl font-bold">{fmt(fin.summary.avgOrderValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}
