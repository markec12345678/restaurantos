'use client'

import { memo, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import { Plus, Receipt, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { ExpenseAddDialog } from './ExpenseAddDialog'
import { ExpenseStatsCards } from './ExpenseStatsCards'
import { CategoryBreakdown } from './CategoryBreakdown'
import { RecentExpensesList } from './RecentExpensesList'

// ============================================
// Main ExpenseTracker component
// ============================================
export const ExpenseTracker = memo(function ExpenseTracker() {
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState('month')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [form, setForm] = useState({
    category: 'supplies', description: '', amount: '', vendor: '', paymentMethod: 'cash', recurring: false,
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

  const stats = data?.stats
  const expenses = data?.expenses || []
  const byCategory = stats?.byCategory || {}

  const avgExpense = useMemo(() => {
    if (!stats?.count || !stats?.totalExpenses) return '0.00'
    return safeToFixed(stats.totalExpenses / stats.count, 2)
  }, [stats?.count, stats?.totalExpenses])

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
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
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

      <ExpenseStatsCards stats={stats} avgExpense={avgExpense} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryBreakdown byCategory={byCategory} totalExpenses={stats?.totalExpenses || 0} />
        <RecentExpensesList expenses={expenses} />
      </div>

      <ExpenseAddDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        form={form}
        setForm={setForm}
        onSubmit={handleAddExpense}
        isPending={addMutation.isPending}
      />
    </div>
  )
})
