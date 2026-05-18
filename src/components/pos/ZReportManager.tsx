'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Z-Report / Dnevni zaključek
// Toast POS + Square standard — poln Z-report z DDV, gotovino, stroški
// ═══════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { authFetch } from '@/components/pos/PinLogin'
import {
  FileText, DollarSign, CreditCard, Banknote, Smartphone, Receipt,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Clock,
  Calculator, BarChart3, PiggyBank, ArrowUpRight, CalendarDays,
  ShoppingBag, Users, Truck, UtensilsCrossed, Package,
} from 'lucide-react'
import { useState } from 'react'
import { format } from 'date-fns'
import { sl } from 'date-fns/locale'
import { toast } from 'sonner'

interface ZReportData {
  id: string
  reportDate: string
  openedAt: string
  closedAt: string | null
  totalSales: number
  totalNetSales: number
  totalTax: number
  cashSales: number
  cardSales: number
  mobileSales: number
  alternateSales: number
  dineInSales: number
  takeoutSales: number
  deliverySales: number
  vatStandard: number
  vatStandardAmount: number
  vatReduced: number
  vatReducedAmount: number
  vatZero: number
  totalOrders: number
  totalGuests: number
  avgOrderValue: number
  totalDiscounts: number
  totalTips: number
  totalVoided: number
  totalStorno: number
  startingCash: number
  expectedCash: number
  actualCash: number
  cashDifference: number
  totalCost: number
  grossProfit: number
  grossMargin: number
  status: string
  finalizedBy: string
  notes: string
}

export function ZReportManager() {
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [actualCash, setActualCash] = useState('')
  const [closeNotes, setCloseNotes] = useState('')

  // Pridobi Z-poročila
  const { data: reports, isLoading } = useQuery({
    queryKey: ['z-reports'],
    queryFn: async () => {
      const res = await authFetch('/api/z-report')
      return res.json()
    },
  })

  // Pridobi trenutno poročilo
  const { data: currentReport, isLoading: loadingReport } = useQuery({
    queryKey: ['z-report', selectedDate],
    queryFn: async () => {
      const res = await authFetch(`/api/z-report?date=${selectedDate}`)
      const data = await res.json()
      return data.length > 0 ? data[0] : null
    },
  })

  // Generiraj/Zaključi Z-poročilo
  const generateMutation = useMutation({
    mutationFn: async (finalize: boolean) => {
      const res = await authFetch('/api/z-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          actualCash: parseFloat(actualCash) || 0,
          notes: closeNotes,
          finalize,
        }),
      })
      if (!res.ok) throw new Error('Napaka pri generiranju Z-poročila')
      return res.json()
    },
    onSuccess: (_, finalize) => {
      queryClient.invalidateQueries({ queryKey: ['z-report'] })
      queryClient.invalidateQueries({ queryKey: ['z-reports'] })
      toast.success(finalize ? 'Z-poročilo zaključeno!' : 'Z-poročilo generirano!')
      setShowCloseDialog(false)
    },
    onError: () => toast.error('Napaka pri generiranju Z-poročila'),
  })

  const report = currentReport as ZReportData | null

  const formatCurrency = (val: number) => `€${(val || 0).toFixed(2)}`

  if (isLoading || loadingReport) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-2 overflow-y-auto h-full custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-amber-500" />
            Z-Poročilo
          </h2>
          <p className="text-muted-foreground">Dnevni zaključek — End of Day Report</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-44"
          />
          {report?.status === 'draft' ? (
            <Button onClick={() => setShowCloseDialog(true)} className="bg-amber-600 hover:bg-amber-700">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Zaključi dan
            </Button>
          ) : !report ? (
            <Button onClick={() => generateMutation.mutate(false)} disabled={generateMutation.isPending}>
              <Calculator className="h-4 w-4 mr-2" />
              Generiraj Z-poročilo
            </Button>
          ) : (
            <Badge variant="outline" className="text-green-600 border-green-300 px-3 py-1">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Zaključeno
            </Badge>
          )}
        </div>
      </div>

      {report && (
        <>
          {/* Glavna statistika */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={DollarSign} label="Skupna prodaja" value={formatCurrency(report.totalSales)} color="text-green-600" />
            <StatCard icon={Receipt} label="Čista prodaja" value={formatCurrency(report.totalNetSales)} color="text-blue-600" />
            <StatCard icon={Calculator} label="DDV" value={formatCurrency(report.totalTax)} color="text-amber-600" />
            <StatCard icon={ShoppingBag} label="Naročila" value={String(report.totalOrders)} color="text-purple-600" />
            <StatCard icon={Users} label="Gostov" value={String(report.totalGuests)} color="text-indigo-600" />
            <StatCard icon={TrendingUp} label="Povprečno" value={formatCurrency(report.avgOrderValue)} color="text-teal-600" />
          </div>

          {/* Po načinu plačila + Vrsta naročila */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Po načinu plačila</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <PaymentRow icon={Banknote} label="Gotovina" value={report.cashSales} total={report.totalSales} color="bg-green-500" />
                <PaymentRow icon={CreditCard} label="Kartica" value={report.cardSales} total={report.totalSales} color="bg-blue-500" />
                <PaymentRow icon={Smartphone} label="Mobilno" value={report.mobileSales} total={report.totalSales} color="bg-purple-500" />
                <PaymentRow icon={Package} label="Alternativno" value={report.alternateSales} total={report.totalSales} color="bg-amber-500" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Po vrsti naročila</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <PaymentRow icon={UtensilsCrossed} label="Na mestu" value={report.dineInSales} total={report.totalSales} color="bg-green-500" />
                <PaymentRow icon={ShoppingBag} label="Za s seboj" value={report.takeoutSales} total={report.totalSales} color="bg-blue-500" />
                <PaymentRow icon={Truck} label="Dostava" value={report.deliverySales} total={report.totalSales} color="bg-amber-500" />
              </CardContent>
            </Card>
          </div>

          {/* DDV razčlenitev + Gotovina */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> DDV razčlenitev
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <div>
                      <span className="font-medium">DDV 22%</span>
                      <span className="text-xs text-muted-foreground ml-2">Standardna stopnja</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(report.vatStandardAmount)}</div>
                      <div className="text-xs text-muted-foreground">Osnova: {formatCurrency(report.vatStandard)}</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <div>
                      <span className="font-medium">DDV 9.5%</span>
                      <span className="text-xs text-muted-foreground ml-2">Znižana stopnja</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(report.vatReducedAmount)}</div>
                      <div className="text-xs text-muted-foreground">Osnova: {formatCurrency(report.vatReduced)}</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <div>
                      <span className="font-medium">DDV 0%</span>
                      <span className="text-xs text-muted-foreground ml-2">Oproščeno</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">€0.00</div>
                      <div className="text-xs text-muted-foreground">Osnova: {formatCurrency(report.vatZero)}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PiggyBank className="h-4 w-4" /> Gotovina
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Začetno stanje</span>
                    <span className="font-medium">{formatCurrency(report.startingCash)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Pričakovano</span>
                    <span className="font-medium">{formatCurrency(report.expectedCash)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Dejansko šteto</span>
                    <span className="font-medium">{formatCurrency(report.actualCash)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="font-medium">Razlika</span>
                    <span className={`font-bold text-lg ${
                      report.cashDifference > 0 ? 'text-green-600' :
                      report.cashDifference < 0 ? 'text-red-600' : 'text-muted-foreground'
                    }`}>
                      {report.cashDifference > 0 ? '+' : ''}{formatCurrency(report.cashDifference)}
                    </span>
                  </div>
                  {Math.abs(report.cashDifference) > 5 && (
                    <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-700 dark:text-yellow-400 text-sm">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Razlika presega €5.00 — preverite gotovino!
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profitabiliteta + Popusti/Void */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Profitabiliteta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Stroški (Food Cost)</span>
                    <span className="font-medium text-red-600">{formatCurrency(report.totalCost)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Bruto dobiček</span>
                    <span className="font-medium text-green-600">{formatCurrency(report.grossProfit)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="font-medium">Bruto marža</span>
                    <span className={`font-bold text-lg ${
                      report.grossMargin > 65 ? 'text-green-600' :
                      report.grossMargin > 50 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {report.grossMargin.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mt-1">
                    <div
                      className={`h-3 rounded-full ${
                        report.grossMargin > 65 ? 'bg-green-500' :
                        report.grossMargin > 50 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(report.grossMargin, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Popusti, napitnine in poničitve</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <TrendingDown className="h-4 w-4 text-red-500" /> Popusti
                    </span>
                    <span className="font-medium text-red-600">{formatCurrency(report.totalDiscounts)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="h-4 w-4 text-green-500" /> Napitnine
                    </span>
                    <span className="font-medium text-green-600">{formatCurrency(report.totalTips)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" /> Poničeno
                    </span>
                    <span className="font-medium text-yellow-600">{formatCurrency(report.totalVoided)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Receipt className="h-4 w-4 text-red-500" /> Storno
                    </span>
                    <span className="font-medium text-red-600">{formatCurrency(report.totalStorno)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Opombe */}
          {report.notes && (
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Opombe:</div>
                <div className="mt-1">{report.notes}</div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!report && (
        <Card className="text-center py-16">
          <CardContent>
            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ni Z-poročila za {format(new Date(selectedDate), 'd. MMMM yyyy', { locale: sl })}</h3>
            <p className="text-muted-foreground mb-4">Generirajte Z-poročilo za pregled dnevnih statistik</p>
            <Button onClick={() => generateMutation.mutate(false)} disabled={generateMutation.isPending}>
              <Calculator className="h-4 w-4 mr-2" />
              Generiraj Z-poročilo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Zgodovina */}
      {reports && reports.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> Zadnja Z-poročila
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reports.slice(0, 10).map((r: ZReportData) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setSelectedDate(format(new Date(r.reportDate), 'yyyy-MM-dd'))}
                >
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{format(new Date(r.reportDate), 'EEE, d. MMM', { locale: sl })}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">{formatCurrency(r.totalSales)}</span>
                    <Badge variant={r.status === 'finalized' ? 'default' : 'secondary'} className="text-xs">
                      {r.status === 'finalized' ? 'Zaključeno' : 'Osnutek'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog za zaključek dneva */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-amber-500" />
              Zaključi dan — Z-Report
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Dejansko stanje gotovine</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                className="mt-1"
              />
              {report && (
                <p className="text-xs text-muted-foreground mt-1">
                  Pričakovano: {formatCurrency(report.expectedCash)}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Opombe</label>
              <Textarea
                placeholder="Opombe ob zaključku dneva..."
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Prekliči</Button>
            <Button onClick={() => generateMutation.mutate(true)} disabled={generateMutation.isPending} className="bg-amber-600 hover:bg-amber-700">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Potrdi in zaključi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Pomožne komponente
function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className={`text-xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  )
}

function PaymentRow({ icon: Icon, label, value, total, color }: { icon: any; label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          {label}
        </span>
        <span className="text-sm font-medium">€{(value || 0).toFixed(2)} <span className="text-xs text-muted-foreground">({pct.toFixed(0)}%)</span></span>
      </div>
      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
