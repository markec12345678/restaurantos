'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Sledenje stroškov
// Restaurant365 + Toast standard
// Kategorije, proračun, trendi, ponavljajoči stroški
// ═══════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import { DollarSign, Plus, TrendingDown, TrendingUp, Receipt, Building, Truck, Zap, ShieldCheck, Wrench, Package, CreditCard, Banknote, RefreshCw, ArrowUpRight } from 'lucide-react'
import { useState, useMemo, useCallback, memo } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { queryKeys } from '@/lib/query-keys'

const CATEGORIES = [
  { id: 'rent', label: 'Najemnina', icon: Building, color: 'blue' },
  { id: 'utilities', label: 'Komunalne', icon: Zap, color: 'yellow' },
  { id: 'supplies', label: 'Zaloge', icon: Package, color: 'green' },
  { id: 'food', label: 'Živila', icon: Truck, color: 'orange' },
  { id: 'labor', label: 'Delovna sila', icon: DollarSign, color: 'purple' },
  { id: 'maintenance', label: 'Vzdrževanje', icon: Wrench, color: 'red' },
  { id: 'insurance', label: 'Zavarovanje', icon: ShieldCheck, color: 'cyan' },
  { id: 'marketing', label: 'Marketing', icon: TrendingUp, color: 'pink' },
  { id: 'other', label: 'Ostalo', icon: Receipt, color: 'gray' },
]

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Gotovina', icon: Banknote },
  { id: 'card', label: 'Kartica', icon: CreditCard },
  { id: 'transfer', label: 'Transakcija', icon: ArrowUpRight },
]

export const ExpenseTracker = memo(function ExpenseTracker() {
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState('month')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [form, setForm] = useState({
    category: 'supplies',
    description: '',
    amount: '',
    vendor: '',
    paymentMethod: 'cash',
    recurring: false,
  })

  const { data, isLoading, refetch } = useQuery({
    queryKey: [...queryKeys.expenses.all, period],
    queryFn: async () => {
      const res = await authFetch(`/api/expenses?period=${period}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })

  const addMutation = useMutation({
    mutationFn: async (formData: typeof form) => {
      const res = await authFetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, amount: parseFloat(formData.amount) }),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Strošek dodan')
      setShowAddDialog(false)
      setForm({ category: 'supplies', description: '', amount: '', vendor: '', paymentMethod: 'cash', recurring: false })
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all })
    },
    onError: () => toast.error('Napaka pri dodajanju stroška'),
  })

  // FIX PERF: useMemo za izračune — prej so se računali na vsakem renderu
  const stats = data?.stats
  const expenses = data?.expenses || []
  const byCategory = stats?.byCategory || {}

  const avgExpense = useMemo(() => {
    if (!stats?.count || !stats?.totalExpenses) return '0.00'
    return (stats.totalExpenses / stats.count).toFixed(2)
  }, [stats?.count, stats?.totalExpenses])

  // FIX PERF: useCallback za handlerje — prej so se ustvarjali na vsakem renderu
  const handleAddExpense = useCallback(() => {
    addMutation.mutate(form)
  }, [addMutation, form])

  const handleRefetch = useCallback(() => {
    refetch()
  }, [refetch])

  if (isLoading) {
    return (
      <div className="space-y-6 p-1">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6 overflow-y-auto h-full p-1 custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Sledenje stroškov
          </h2>
          <p className="text-sm text-muted-foreground">Kategorizirani stroški, proračun in ponavljajoči izdatki</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Danes</SelectItem>
              <SelectItem value="week">Teden</SelectItem>
              <SelectItem value="month">Mesec</SelectItem>
              <SelectItem value="year">Leto</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefetch} aria-label="Osveži"><RefreshCw className="h-3 w-3" /></Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-1"><Plus className="h-3 w-3" />Nov strošek</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Skupni stroški</span>
            </div>
            <p className="text-2xl font-bold">€{(stats?.totalExpenses || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <RefreshCw className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Ponavljajoči</span>
            </div>
            <p className="text-2xl font-bold">€{(stats?.recurringExpenses || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Število</span>
            </div>
            <p className="text-2xl font-bold">{stats?.count || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Povprečni</span>
            </div>
            <p className="text-2xl font-bold">€{avgExpense}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stroški po kategorijah */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Po kategorijah</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {CATEGORIES.map(cat => {
                const catData = byCategory[cat.id]
                if (!catData) return null
                const CatIcon = cat.icon
                const pct = stats?.totalExpenses ? (catData.total / stats.totalExpenses) * 100 : 0
                return (
                  <div key={cat.id} className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full bg-${cat.color}-100 dark:bg-${cat.color}-900/30 flex items-center justify-center`}>
                      <CatIcon className={`h-4 w-4 text-${cat.color}-600`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-medium">{cat.label}</span>
                        <span className="text-sm font-bold">€{catData.total.toFixed(2)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full bg-${cat.color}-500 rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{catData.count} vnosov · {pct.toFixed(1)}%</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Zadnji stroški */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Zadnji vnosi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
              {expenses.slice(0, 20).map((exp: {
                id: string; category: string; description: string; amount: number;
                date: string; vendor: string; paymentMethod: string; recurring: boolean
              }) => {
                const catInfo = CATEGORIES.find(c => c.id === exp.category) || CATEGORIES[CATEGORIES.length - 1]
                const CatIcon = catInfo.icon
                const payMethod = PAYMENT_METHODS.find(p => p.id === exp.paymentMethod) || PAYMENT_METHODS[0]
                const PayIcon = payMethod.icon
                return (
                  <div key={exp.id} className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/30 transition-colors">
                    <div className={`h-9 w-9 rounded-full bg-${catInfo.color}-100 dark:bg-${catInfo.color}-900/30 flex items-center justify-center flex-shrink-0`}>
                      <CatIcon className={`h-4 w-4 text-${catInfo.color}-600`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{exp.description}</p>
                        {exp.recurring && <Badge variant="outline" className="text-[9px]">Ponavljajoč</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{catInfo.label}</span>
                        {exp.vendor && <span>· {exp.vendor}</span>}
                        <span>· {format(new Date(exp.date), 'dd.MM.yyyy')}</span>
                        <PayIcon className="h-3 w-3" />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-red-600">-€{exp.amount.toFixed(2)}</span>
                  </div>
                )
              })}
              {expenses.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Ni zabeleženih stroškov</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Nov strošek</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="exp-category">Kategorija</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger id="exp-category" autoFocus><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="exp-description">Opis</Label>
              <Input id="exp-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Opis stroška"  aria-label="Opis stroška"/>
            </div>
            <div>
              <Label htmlFor="exp-amount">Znesek (€)</Label>
              <Input id="exp-amount" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00"  aria-label="0.00"/>
            </div>
            <div>
              <Label htmlFor="exp-vendor">Dobavitelj</Label>
              <Input id="exp-vendor" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Ime dobavitelja"  aria-label="Ime dobavitelja"/>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="exp-payment">Način plačila</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                  <SelectTrigger id="exp-payment"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input id="exp-recurring" type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} className="rounded" />
                <Label htmlFor="exp-recurring" className="text-sm">Ponavljajoč</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Prekliči</Button>
            <Button onClick={handleAddExpense} disabled={!form.description || !form.amount || addMutation.isPending}>Dodaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})
