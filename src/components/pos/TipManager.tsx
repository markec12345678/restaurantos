'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Tip Manager / Upravitelj napitnin
// Toast POS standard — distribucija napitnin med zaposlene
// Equal, Hours, Points, Manual distribucija
// ═══════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { DollarSign, Users, Clock, Star, HandCoins, CheckCircle2, ChevronLeft, ChevronRight, BarChart3, Equal, Edit, Wallet, CreditCard } from 'lucide-react'
import { useState, memo } from 'react'
import type { LucideIcon } from 'lucide-react'
import { format, addDays, subDays } from 'date-fns'
import { sl } from 'date-fns/locale'
import { toast } from 'sonner'

interface TipDistribution {
  id: string
  employeeId: string
  employeeName: string
  hoursWorked: number
  points: number
  amount: number
  status: string
  paidAt: string | null
}

interface TipPoolData {
  id: string
  date: string
  totalTips: number
  cashTips: number
  cardTips: number
  distributionMethod: string
  status: string
  distributions: TipDistribution[]
}

const METHOD_LABELS: Record<string, { label: string; icon: LucideIcon; desc: string }> = {
  equal: { label: 'Enako', icon: Equal, desc: 'Enak del za vse' },
  hours: { label: 'Po urah', icon: Clock, desc: 'Proporcionalno uram' },
  points: { label: 'Po točkah', icon: Star, desc: 'Po točkah/sISTEMU' },
  manual: { label: 'Ročno', icon: Edit, desc: 'Ročna dodelitev' },
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Čakajoče', color: 'bg-yellow-100 text-yellow-800' },
  distributed: { label: 'Razdeljeno', color: 'bg-blue-100 text-blue-800' },
  approved: { label: 'Odobreno', color: 'bg-green-100 text-green-800' },
  paid: { label: 'Izplačano', color: 'bg-emerald-100 text-emerald-800' },
}

export const TipManager = memo(function TipManager() {
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [method, setMethod] = useState('equal')
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [editingAmounts, setEditingAmounts] = useState<Record<string, string>>({})

  // Pridobi tip poole
  const { data: _pools, isLoading } = useQuery({
    queryKey: queryKeys.tipPool.all,
    queryFn: async () => {
      const res = await authFetch('/api/tip-pool')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })

  // Pridobi trenutni pool
  const { data: currentPool } = useQuery({
    queryKey: queryKeys.tipPool.byDate(selectedDate),
    queryFn: async () => {
      const res = await authFetch(`/api/tip-pool?date=${selectedDate}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      const data = await res.json()
      return data.length > 0 ? data[0] : null
    },
  })

  // Generiraj tip pool
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch('/api/tip-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, distributionMethod: method }),
      })
      if (!res.ok) throw new Error('Napaka pri generiranju')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tip-pool'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.tipPool.all })
      toast.success('Tip pool generiran!')
      setShowGenerateDialog(false)
    },
    onError: () => toast.error('Napaka pri generiranju tip poola'),
  })

  // Shrani ročne zneske
  const saveManualMutation = useMutation({
    mutationFn: async () => {
      const pool = currentPool as TipPoolData
      if (!pool) return
      const distributions = pool.distributions.map(d => ({
        employeeId: d.employeeId,
        employeeName: d.employeeName,
        hoursWorked: d.hoursWorked,
        points: d.points,
        amount: parseFloat(editingAmounts[d.employeeId] ?? String(d.amount)) || 0,
      }))
      const res = await authFetch('/api/tip-pool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipPoolId: pool.id, distributions }),
      })
      if (!res.ok) throw new Error('Napaka pri shranjevanju')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tipPool.byDate(selectedDate) })
      toast.success('Napitnine shranjene!')
    },
    onError: () => toast.error('Napaka pri shranjevanju'),
  })

  const pool = currentPool as TipPoolData | null
  const formatCurrency = (val: number) => `€${(val || 0).toFixed(2)}`

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-48" />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-2 overflow-y-auto h-full custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <HandCoins className="h-6 w-6 text-green-500" />
            Upravitelj napitnin
          </h2>
          <p className="text-muted-foreground">Distribucija napitnin med zaposlene</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Nazaj" onClick={() => setSelectedDate(format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-40" />
            <Button variant="outline" size="icon" aria-label="Naprej" onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {!pool && (
            <Button onClick={() => setShowGenerateDialog(true)}>
              <DollarSign className="h-4 w-4 mr-2" />
              Generiraj
            </Button>
          )}
        </div>
      </div>

      {pool && (
        <>
          {/* Povzetek */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-muted-foreground">Skupne napitnine</span>
                </div>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(pool.totalTips)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="h-4 w-4 text-amber-600" />
                  <span className="text-xs text-muted-foreground">Gotovinske</span>
                </div>
                <div className="text-xl font-bold text-amber-600">{formatCurrency(pool.cashTips)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-muted-foreground">Kartične</span>
                </div>
                <div className="text-xl font-bold text-blue-600">{formatCurrency(pool.cardTips)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-purple-600" />
                  <span className="text-xs text-muted-foreground">Zaposlenih</span>
                </div>
                <div className="text-xl font-bold text-purple-600">{pool.distributions.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Metoda + Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Metoda:</span>
              {(() => {
                const m = METHOD_LABELS[pool.distributionMethod]
                const Icon = m?.icon || Equal
                return (
                  <Badge variant="outline" className="gap-1">
                    <Icon className="h-3 w-3" />
                    {m?.label || pool.distributionMethod}
                  </Badge>
                )
              })()}
            </div>
            <Badge className={STATUS_LABELS[pool.status]?.color || 'bg-gray-100 text-gray-800'}>
              {STATUS_LABELS[pool.status]?.label || pool.status}
            </Badge>
          </div>

          {/* Distribucija */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Distribucija napitnin</CardTitle>
                {pool.distributionMethod === 'manual' && pool.status === 'pending' && (
                  <Button size="sm" onClick={() => saveManualMutation.mutate()} disabled={saveManualMutation.isPending}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Shrani
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pool.distributions.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                        {d.employeeName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{d.employeeName}</div>
                        <div className="text-xs text-muted-foreground">
                          {d.hoursWorked > 0 && `${d.hoursWorked}h`}
                          {d.hoursWorked > 0 && d.points > 0 && ' · '}
                          {d.points > 0 && `${d.points} točk`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {pool.distributionMethod === 'manual' && pool.status === 'pending' ? (
                        <Input
                          type="number"
                          step="0.01"
                          className="w-24 h-8 text-right"
                          value={editingAmounts[d.employeeId] ?? d.amount.toFixed(2)}
                          onChange={(e) => setEditingAmounts(prev => ({ ...prev, [d.employeeId]: e.target.value }))}
                        />
                      ) : (
                        <span className="font-bold text-green-600">{formatCurrency(d.amount)}</span>
                      )}
                      {d.status === 'paid' && (
                        <Badge variant="outline" className="text-green-600 border-green-300 text-xs">Izplačano</Badge>
                      )}
                    </div>
                  </div>
                ))}
                {pool.distributions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Ni zaposlenih za distribucijo
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Vizualizacija */}
          {pool.distributions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Pregled distribucije
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pool.distributions.map((d) => {
                    const pct = pool.totalTips > 0 ? (d.amount / pool.totalTips) * 100 : 0
                    return (
                      <div key={d.id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{d.employeeName}</span>
                          <span className="text-muted-foreground">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                          <div className="h-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-600" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!pool && (
        <Card className="text-center py-16">
          <CardContent>
            <HandCoins className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ni tip poola za {format(new Date(selectedDate), 'd. MMMM yyyy', { locale: sl })}</h3>
            <p className="text-muted-foreground mb-4">Generirajte tip pool za distribucijo napitnin</p>
            <Button onClick={() => setShowGenerateDialog(true)}>
              <DollarSign className="h-4 w-4 mr-2" />
              Generiraj tip pool
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialog za generiranje */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generiraj tip pool</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Metoda distribucije</label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="mt-1" autoFocus>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(METHOD_LABELS).map(([key, { label, desc }]) => (
                    <SelectItem key={key} value={key}>
                      <div>
                        <div className="font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground">{desc}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>Prekliči</Button>
            <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              Generiraj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})
