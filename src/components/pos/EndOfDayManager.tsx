'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Zaključek dneva (End of Day)
// Toast POS + Restaurant365 standard
// Celoten EOD proces: Z-poročilo, FURS, gotovina, DDV, povzetek
// ═══════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { CheckCircle2, XCircle, AlertTriangle, DollarSign, CreditCard, Banknote, Shield, FileText, TrendingUp, Receipt, Lock, ChevronDown, ChevronUp } from 'lucide-react'
import { useState, memo } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface EODData {
  date: string
  eodCompleted: boolean
  orders: { total: number; completed: number; cancelled: number; revenue: number; avgOrderValue: number }
  payments: { byMethod: Record<string, { count: number; total: number; tips: number }>; totalTips: number; totalPayments: number }
  vat: Record<string, { base: number; vat: number }>
  furs: { verified: number; queued: number; failed: number; allVerified: boolean }
  shift: { id: string; startingCash: number; cashSales: number; cardSales: number; totalSales: number; cashDiff: number; isClosed: boolean } | null
  reservations: { total: number; confirmed: number; noShow: number }
  guests: { newToday: number }
  expenses: { total: number; count: number }
  netProfit: number
  topItems: Array<{ name: string; quantity: number; revenue: number }>
}

export const EndOfDayManager = memo(function EndOfDayManager() {
  const queryClient = useQueryClient()
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [actualCash, setActualCash] = useState('')
  const [eodNotes, setEodNotes] = useState('')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['orders', 'payments']))
  // EOD checklist — interaktivno potrjevanje namesto hardcoded false
  // Must be declared before any early returns to satisfy rules-of-hooks
  const [cashConfirmed, setCashConfirmed] = useState(false)
  const [checklistConfirmed, setChecklistConfirmed] = useState(false)

  const { data, isLoading, refetch: _refetch } = useQuery<EODData>({
    queryKey: queryKeys.endOfDay.all,
    queryFn: async () => {
      const res = await authFetch('/api/end-of-day')
      return res.json()
    },
  })

  const closeDayMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch('/api/end-of-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: data?.date || new Date().toISOString().split('T')[0],
          actualCash: parseFloat(actualCash) || 0,
          notes: eodNotes,
        }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Napaka' }))
        throw new Error(errorData.error || `Napaka (${res.status})`)
      }
      return res.json()
    },
    onSuccess: (result) => {
      toast.success(result.message || 'Dan uspešno zaključen!')
      setShowCloseDialog(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.endOfDay.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
    onError: () => toast.error('Napaka pri zaključku dneva'),
  })

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-1">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!data) return null

  const eodChecks = [
    { label: 'Vsa naročila zaključena', done: data.orders.total === data.orders.completed + data.orders.cancelled },
    { label: 'FURS vsi računi overjeni', done: data.furs.allVerified },
    { label: 'Izmena zaprta', done: data.shift?.isClosed || false },
    { label: 'Gotovina usklajena', done: cashConfirmed },
    { label: 'Dnevni kontrolni seznam zaključen', done: checklistConfirmed },
  ]

  const completedChecks = eodChecks.filter(c => c.done).length
  const allChecksDone = eodChecks.every(c => c.done)

  return (
    <div className="space-y-6 overflow-y-auto h-full p-1 custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Zaključek dneva
          </h2>
          <p className="text-sm text-muted-foreground">
            {format(new Date(data.date), 'EEEE, dd. MMMM yyyy')} — Pregled in zaključek
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.eodCompleted ? (
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-sm px-3 py-1">
              <CheckCircle2 className="h-4 w-4 mr-1" /> Dan zaključen
            </Badge>
          ) : (
            <Button onClick={() => setShowCloseDialog(true)} className="gap-1" disabled={!allChecksDone}>
              <Lock className="h-4 w-4" /> Zaključi dan
            </Button>
          )}
        </div>
      </div>

      {/* EOD Checklist */}
      <Card className={allChecksDone ? 'border-emerald-300 dark:border-emerald-800' : 'border-amber-300 dark:border-amber-800'}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Predpogoji za zaključek dneva ({completedChecks}/{eodChecks.length})
            </h3>
            <Progress value={(completedChecks / eodChecks.length) * 100} className="h-2 w-32" />
          </div>
          <div className="space-y-2">
            {eodChecks.map((check, idx) => {
              // FIX: Interaktivni kontrolni elementi za gotovino in seznam
              const isCashCheck = check.label === 'Gotovina usklajena'
              const isChecklistCheck = check.label === 'Dnevni kontrolni seznam zaključen'
              const isInteractive = isCashCheck || isChecklistCheck

              return (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  {isInteractive ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (isCashCheck) setCashConfirmed(v => !v)
                        if (isChecklistCheck) setChecklistConfirmed(v => !v)
                      }}
                      className="focus:outline-none"
                      aria-label={check.label}
                    >
                      {check.done ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-amber-500" />
                      )}
                    </button>
                  ) : check.done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-amber-500" />
                  )}
                  <span className={check.done ? 'line-through text-muted-foreground' : ''}>{check.label}</span>
                  {isInteractive && !check.done && (
                    <span className="text-[10px] text-muted-foreground">(kliknite za potrditev)</span>
                  )}
                </div>
              )
            })}
          </div>
          {!allChecksDone && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Rešite vse predpogoje pred zaključkom dneva
            </p>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Prihodek</p>
            <p className="text-xl font-bold text-emerald-600">€{data.orders.revenue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Naročila</p>
            <p className="text-xl font-bold">{data.orders.completed}</p>
            <p className="text-[9px] text-muted-foreground">{data.orders.cancelled} preklicanih</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Napitnine</p>
            <p className="text-xl font-bold text-amber-600">€{data.payments.totalTips.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Neto dobiček</p>
            <p className={`text-xl font-bold ${data.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              €{data.netProfit.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">FURS overjeno</p>
            <p className="text-xl font-bold">{data.furs.verified}</p>
            {data.furs.failed > 0 && <p className="text-[9px] text-red-500">{data.furs.failed} neuspešnih</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Stroški</p>
            <p className="text-xl font-bold text-red-600">€{data.expenses.total.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Expandable Sections */}
      {/* ── Naročila ──────────────────────────────── */}
      <Card>
        <CardHeader className="p-3 cursor-pointer" role="button" tabIndex={0} aria-expanded={expandedSections.has('orders')} onClick={() => toggleSection('orders')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection('orders') } }}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Receipt className="h-4 w-4" />Naročila</CardTitle>
            {expandedSections.has('orders') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CardHeader>
        {expandedSections.has('orders') && (
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Skupaj</p>
                <p className="font-bold">{data.orders.total}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/10">
                <p className="text-xs text-muted-foreground">Zaključena</p>
                <p className="font-bold text-emerald-600">{data.orders.completed}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/10">
                <p className="text-xs text-muted-foreground">Preklicana</p>
                <p className="font-bold text-red-600">{data.orders.cancelled}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Povpr. naročilo</p>
                <p className="font-bold">€{data.orders.avgOrderValue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Plačila ──────────────────────────────── */}
      <Card>
        <CardHeader className="p-3 cursor-pointer" role="button" tabIndex={0} aria-expanded={expandedSections.has('payments')} onClick={() => toggleSection('payments')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection('payments') } }}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" />Plačila po metodi</CardTitle>
            {expandedSections.has('payments') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CardHeader>
        {expandedSections.has('payments') && (
          <CardContent className="p-3 pt-0">
            <div className="space-y-2">
              {Object.entries(data.payments.byMethod).map(([method, info]) => (
                <div key={method} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    {method === 'cash' ? <Banknote className="h-4 w-4 text-green-600" /> :
                     method === 'card' ? <CreditCard className="h-4 w-4 text-blue-600" /> :
                     <DollarSign className="h-4 w-4 text-purple-600" />}
                    <span className="text-sm font-medium capitalize">{method === 'cash' ? 'Gotovina' : method === 'card' ? 'Kartica' : method}</span>
                    <span className="text-xs text-muted-foreground">({info.count}x)</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">€{info.total.toFixed(2)}</p>
                    {info.tips > 0 && <p className="text-[10px] text-amber-600">Napitnine: €{info.tips.toFixed(2)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── DDV ──────────────────────────────── */}
      <Card>
        <CardHeader className="p-3 cursor-pointer" role="button" tabIndex={0} aria-expanded={expandedSections.has('vat')} onClick={() => toggleSection('vat')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection('vat') } }}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Receipt className="h-4 w-4" />DDV po stopnjah</CardTitle>
            {expandedSections.has('vat') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CardHeader>
        {expandedSections.has('vat') && (
          <CardContent className="p-3 pt-0">
            <div className="space-y-2">
              {Object.entries(data.vat).map(([rate, info]) => (
                <div key={rate} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div>
                    <span className="text-sm font-medium">DDV {rate}%</span>
                    <p className="text-xs text-muted-foreground">Osnova: €{info.base.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">€{info.vat.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">Skupaj: €{(info.base + info.vat).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── FURS ──────────────────────────────── */}
      <Card className={data.furs.allVerified ? 'border-emerald-300 dark:border-emerald-800' : 'border-red-300 dark:border-red-800'}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className={`h-5 w-5 ${data.furs.allVerified ? 'text-emerald-500' : 'text-red-500'}`} />
              <span className="font-bold text-sm">FURS davčno potrjevanje</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-600">{data.furs.verified}</p>
                <p className="text-[9px] text-muted-foreground">Overjenih</p>
              </div>
              {data.furs.queued > 0 && (
                <div className="text-center">
                  <p className="text-lg font-bold text-amber-600">{data.furs.queued}</p>
                  <p className="text-[9px] text-muted-foreground">V čakalni</p>
                </div>
              )}
              {data.furs.failed > 0 && (
                <div className="text-center">
                  <p className="text-lg font-bold text-red-600">{data.furs.failed}</p>
                  <p className="text-[9px] text-muted-foreground">Neuspešnih</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Top artikli ──────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-4 w-4" />Najbolj prodajani danes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.topItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{idx + 1}</span>
                  <span className="text-sm">{item.name}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{item.quantity}x</span>
                  <span className="font-semibold">€{item.revenue.toFixed(2)}</span>
                </div>
              </div>
            ))}
            {data.topItems.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Ni prodaje danes</p>}
          </div>
        </CardContent>
      </Card>

      {/* Close Day Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="h-5 w-5" />Zaključi dan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                To dejanje ni mogoče razveljaviti. Prepričajte se, da so vsa naročila zaključena in gotovina prešteta.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Dejanska gotovina v blagajni (€)</label>
              <Input type="number" step="0.01" value={actualCash} onChange={(e) => setActualCash(e.target.value)} placeholder="0.00"  aria-label="0.00" autoFocus/>
              {data.shift && (
                <p className="text-xs text-muted-foreground mt-1">
                  Pričakovano: €{((data.shift.startingCash || 0) + (data.shift.cashSales || 0)).toFixed(2)}
                  {' '}(začetna €{(data.shift.startingCash || 0).toFixed(2)} + prodaja €{(data.shift.cashSales || 0).toFixed(2)})
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Opombe</label>
              <Textarea value={eodNotes} onChange={(e) => setEodNotes(e.target.value)} placeholder="Opombe za zaključek dneva..." rows={3}  aria-label="Opombe za zaključek dneva"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Prekliči</Button>
            <Button onClick={() => closeDayMutation.mutate()} disabled={closeDayMutation.isPending} className="gap-1">
              <Lock className="h-3 w-3" /> Potrdi zaključek
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})
