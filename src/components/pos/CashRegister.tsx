'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Wallet, Lock, Unlock, Banknote, CreditCard, Smartphone, Receipt,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Clock,
  ArrowRight, Split, Gift
} from 'lucide-react'
import { useState } from 'react'
import { format } from 'date-fns'
import { authFetch } from '@/components/pos/PinLogin'

export function CashRegister() {
  const queryClient = useQueryClient()
  const [openDialog, setOpenDialog] = useState(false)
  const [closeDialog, setCloseDialog] = useState(false)
  const [openForm, setOpenForm] = useState({ startingCash: '200', employeeId: '', employeeName: '' })
  const [closeForm, setCloseForm] = useState({ closingCash: '', notes: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['cash-register'],
    queryFn: async () => {
      const res = await authFetch('/api/cash-register')
      return res.json()
    },
    refetchInterval: 15000,
  })

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await authFetch('/api/employees')
      return res.json()
    },
  })

  const activeShift = data?.activeShift
  const liveStats = data?.liveStats
  const recentShifts = data?.recentShifts || []

  // Open shift mutation
  const openShiftMutation = useMutation({
    mutationFn: async (form: typeof openForm) => {
      const res = await authFetch('/api/cash-register', {
        method: 'POST',
        body: JSON.stringify({
          startingCash: parseFloat(form.startingCash) || 0,
          employeeId: form.employeeId || null,
          employeeName: form.employeeName || '',
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Napaka pri odpiranju izmene')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Izmena odprta! Blagajna je aktivna.')
      setOpenDialog(false)
      queryClient.invalidateQueries({ queryKey: ['cash-register'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Close shift mutation
  const closeShiftMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: typeof closeForm }) => {
      const closingCash = parseFloat(form.closingCash)
      const res = await authFetch(`/api/cash-register/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          closingCash: isNaN(closingCash) ? 0 : closingCash,
          notes: form.notes,
        }),
      })
      if (!res.ok) throw new Error('Napaka pri zapiranju izmene')
      return res.json()
    },
    onSuccess: (result) => {
      const diff = result.cashDifference
      if (Math.abs(diff) > 0.01) {
        toast.warning(`Izmena zaprta. Razlika v gotovini: €${diff.toFixed(2)}`)
      } else {
        toast.success('Izmena uspešno zaprta! Gotovina se ujema.')
      }
      setCloseDialog(false)
      queryClient.invalidateQueries({ queryKey: ['cash-register'] })
    },
    onError: () => toast.error('Napaka pri zapiranju izmene'),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Blagajna</h2>
          <p className="text-muted-foreground">Upravljajte izmene in stanje blagajne</p>
        </div>
        {activeShift ? (
          <Button
            variant="destructive"
            onClick={() => {
              setCloseForm({ closingCash: String(liveStats?.expectedCash || activeShift.startingCash), notes: '' })
              setCloseDialog(true)
            }}
          >
            <Lock className="h-4 w-4 mr-2" />
            Zapri izmeno
          </Button>
        ) : (
          <Button onClick={() => setOpenDialog(true)}>
            <Unlock className="h-4 w-4 mr-2" />
            Odpri izmeno
          </Button>
        )}
      </div>

      {/* Active Shift Info */}
      {activeShift ? (
        <div className="space-y-4">
          {/* Status Banner */}
          <Card className="border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-bold text-emerald-800 dark:text-emerald-400">Izmena odprta</p>
                    <p className="text-sm text-muted-foreground">
                      Odprto: {format(new Date(activeShift.openedAt), 'dd.MM.yyyy HH:mm')}
                      {activeShift.employeeName && ` · ${activeShift.employeeName}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Začetna gotovina</p>
                  <p className="text-xl font-bold">€{activeShift.startingCash.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Stats */}
          {liveStats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Banknote className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs text-muted-foreground">Gotovina</span>
                  </div>
                  <p className="text-xl font-bold">€{liveStats.cashSales.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Pričakovano: €{liveStats.expectedCash.toFixed(2)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    <span className="text-xs text-muted-foreground">Kartično</span>
                  </div>
                  <p className="text-xl font-bold">€{liveStats.cardSales.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone className="h-4 w-4 text-purple-600" />
                    <span className="text-xs text-muted-foreground">Mobilno</span>
                  </div>
                  <p className="text-xl font-bold">€{liveStats.mobileSales.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Skupaj</span>
                  </div>
                  <p className="text-xl font-bold text-primary">€{liveStats.totalSales.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {liveStats.totalOrders} naročil
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Payment Breakdown */}
          {liveStats && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Pregled plačil
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm">Gotovina</span>
                    </div>
                    <span className="font-semibold">€{liveStats.cashSales.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">Kartično</span>
                    </div>
                    <span className="font-semibold">€{liveStats.cardSales.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-purple-600" />
                      <span className="text-sm">Mobilno</span>
                    </div>
                    <span className="font-semibold">€{liveStats.mobileSales.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Split className="h-4 w-4 text-amber-600" />
                      <span className="text-sm">Deljeno</span>
                    </div>
                    <span className="font-semibold">€{liveStats.splitPayments.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-primary/5">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Skupaj</span>
                    </div>
                    <span className="font-bold text-lg">€{liveStats.totalSales.toFixed(2)}</span>
                  </div>
                  {liveStats.totalDiscounts > 0 && (
                    <div className="flex items-center justify-between py-2 px-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Gift className="h-4 w-4 text-rose-500" />
                        <span className="text-sm text-muted-foreground">Popusti</span>
                      </div>
                      <span className="text-sm text-rose-600">-€{liveStats.totalDiscounts.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* No active shift */
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold mb-2">Blagajna ni odprta</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Za začetek prodaje morate odpreti novo izmeno in vnesti začetno stanje gotovine.
            </p>
            <Button onClick={() => setOpenDialog(true)}>
              <Unlock className="h-4 w-4 mr-2" />
              Odpri izmeno
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Closed Shifts */}
      {recentShifts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Zadnje zaprte izmene
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentShifts.map((shift: {
                id: string
                employeeName: string
                openedAt: string
                closedAt: string
                startingCash: number
                closingCash: number
                expectedCash: number
                cashDifference: number
                totalSales: number
                totalOrders: number
                cashSales: number
                cardSales: number
                notes: string
              }) => (
                <div key={shift.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {format(new Date(shift.openedAt), 'dd.MM HH:mm')} → {shift.closedAt ? format(new Date(shift.closedAt), 'HH:mm') : ''}
                        {shift.employeeName && ` · ${shift.employeeName}`}
                      </p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>€{shift.startingCash.toFixed(2)} → €{shift.closingCash.toFixed(2)}</span>
                        <span>·</span>
                        <span>{shift.totalOrders} naročil</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="font-semibold text-sm">€{shift.totalSales.toFixed(2)}</p>
                      <div className="flex gap-1.5">
                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                          <Banknote className="h-2.5 w-2.5 mr-0.5" />€{shift.cashSales.toFixed(0)}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                          <CreditCard className="h-2.5 w-2.5 mr-0.5" />€{shift.cardSales.toFixed(0)}
                        </Badge>
                      </div>
                    </div>
                    {Math.abs(shift.cashDifference) > 0.01 && (
                      <Badge
                        variant={shift.cashDifference > 0 ? 'default' : 'destructive'}
                        className="text-[9px] h-5"
                      >
                        {shift.cashDifference > 0 ? (
                          <><TrendingUp className="h-2.5 w-2.5 mr-0.5" />+€{shift.cashDifference.toFixed(2)}</>
                        ) : (
                          <><TrendingDown className="h-2.5 w-2.5 mr-0.5" />€{shift.cashDifference.toFixed(2)}</>
                        )}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Open Shift Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5" />
              Odpri novo izmeno
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Zaposleni</label>
              <Select
                value={openForm.employeeId}
                onValueChange={(v) => {
                  const emp = employees?.find((e: { id: string }) => e.id === v)
                  setOpenForm({ ...openForm, employeeId: v, employeeName: emp?.name || '' })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Izberi zaposlenega" />
                </SelectTrigger>
                <SelectContent>
                  {employees?.filter((e: { status: string }) => e.status === 'active').map((emp: { id: string; name: string; role: string }) => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name} ({emp.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Začetna gotovina (€)</label>
              <Input
                type="number"
                step="0.01"
                value={openForm.startingCash}
                onChange={e => setOpenForm({ ...openForm, startingCash: e.target.value })}
                placeholder="200.00"
              />
              <p className="text-xs text-muted-foreground mt-1">Vnesite znesek gotovine v blagajni ob odprtju</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Prekliči</Button>
            <Button onClick={() => openShiftMutation.mutate(openForm)} disabled={openShiftMutation.isPending}>
              {openShiftMutation.isPending ? 'Odpiram...' : 'Odpri izmeno'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Zapri izmeno
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Summary before closing */}
            {liveStats && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Prodaja v gotovini:</span>
                  <span className="font-semibold">€{liveStats.cashSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kartična prodaja:</span>
                  <span className="font-semibold">€{liveStats.cardSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Mobilna prodaja:</span>
                  <span className="font-semibold">€{liveStats.mobileSales.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Skupna prodaja:</span>
                  <span>€{liveStats.totalSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Skupaj naročil:</span>
                  <span>{liveStats.totalOrders}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Pričakovana gotovina:</span>
                  <span className="font-bold">€{liveStats.expectedCash.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Dejanska gotovina v blagajni (€)</label>
              <Input
                type="number"
                step="0.01"
                value={closeForm.closingCash}
                onChange={e => setCloseForm({ ...closeForm, closingCash: e.target.value })}
                placeholder={String(liveStats?.expectedCash?.toFixed(2) || '0.00')}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Vnesite znesek štete gotovine ob zaprtju izmene
              </p>
              {closeForm.closingCash && liveStats && (
                <div className={`mt-2 flex items-center gap-2 text-sm font-medium ${
                  parseFloat(closeForm.closingCash) - liveStats.expectedCash > 0.01
                    ? 'text-emerald-600'
                    : parseFloat(closeForm.closingCash) - liveStats.expectedCash < -0.01
                    ? 'text-red-600'
                    : 'text-muted-foreground'
                }`}>
                  {parseFloat(closeForm.closingCash) - liveStats.expectedCash > 0.01 ? (
                    <><TrendingUp className="h-4 w-4" /> Prihranek: €{(parseFloat(closeForm.closingCash) - liveStats.expectedCash).toFixed(2)}</>
                  ) : parseFloat(closeForm.closingCash) - liveStats.expectedCash < -0.01 ? (
                    <><AlertTriangle className="h-4 w-4" /> Manjka: €{(liveStats.expectedCash - parseFloat(closeForm.closingCash)).toFixed(2)}</>
                  ) : (
                    <><CheckCircle2 className="h-4 w-4" /> Gotovina se ujema</>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Opombe</label>
              <Textarea
                value={closeForm.notes}
                onChange={e => setCloseForm({ ...closeForm, notes: e.target.value })}
                placeholder="Opombe ob zaključku izmene..."
                className="h-20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialog(false)}>Prekliči</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (activeShift) closeShiftMutation.mutate({ id: activeShift.id, form: closeForm })
              }}
              disabled={closeShiftMutation.isPending}
            >
              {closeShiftMutation.isPending ? 'Zapiram...' : 'Zapri izmeno'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
