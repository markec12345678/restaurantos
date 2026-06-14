'use client'

import { useState, memo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CreditCard, Plus } from 'lucide-react'
import { authFetch } from '@/components/pos/PinLogin'
import type { SubscriptionFormRow } from '@/lib/types'
import { queryKeys } from '@/lib/query-keys'
import dynamic from 'next/dynamic'
import type { SubscriptionData, PlanData, SubscriptionForm } from './subscription/constants'

// Lazy-loaded podkomponente
const SubscriptionCard = dynamic(() => import('./subscription/SubscriptionCard').then(m => ({ default: m.SubscriptionCard })), { ssr: false })
const PlansGrid = dynamic(() => import('./subscription/PlansGrid').then(m => ({ default: m.PlansGrid })), { ssr: false })
const CreateForm = dynamic(() => import('./subscription/CreateForm').then(m => ({ default: m.CreateForm })), { ssr: false })
const InvoicesTable = dynamic(() => import('./subscription/InvoicesTable').then(m => ({ default: m.InvoicesTable })), { ssr: false })
const StatsCards = dynamic(() => import('./subscription/StatsCards').then(m => ({ default: m.StatsCards })), { ssr: false })

export const SubscriptionManager = memo(function SubscriptionManager() {
  const queryClient = useQueryClient()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<string>('starter')
  const [form, setForm] = useState<SubscriptionForm>({
    companyName: '', email: '', phone: '', taxId: '', businessId: '',
    locationCount: 1, paymentMethod: 'bank_transfer',
  })

  const { data, isLoading } = useQuery<{
    subscription?: SubscriptionData
    plans?: Record<string, PlanData>
    stats?: Record<string, number>
  }>({
    queryKey: queryKeys.subscription.all,
    queryFn: async () => {
      const res = await authFetch('/api/subscription')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })

  const createMutation = useMutation({
    mutationFn: async (formData: SubscriptionFormRow) => {
      const res = await authFetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, plan: selectedPlan }),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription.all })
      setShowCreateForm(false)
    },
  })

  const upgradeMutation = useMutation({
    mutationFn: async ({ id, plan }: { id: string; plan: string }) => {
      const res = await authFetch('/api/subscription', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, plan }),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.subscription.all }),
  })

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch('/api/subscription', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'active' }),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.subscription.all }),
  })

  if (isLoading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  }

  const subscription = data?.subscription
  const plans = data?.plans || {} as Record<string, PlanData>
  const stats = data?.stats || {} as Record<string, number>
  const invoices = subscription?.invoices || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Naročnina
          </h2>
          <p className="text-muted-foreground">Upravljanje SaaS naročnine in paketov</p>
        </div>
        {!subscription && (
          <Button onClick={() => setShowCreateForm(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Aktiviraj naročnino
          </Button>
        )}
      </div>

      {/* Trenutna naročnina */}
      {subscription && (
        <SubscriptionCard
          subscription={subscription}
          planName={plans[subscription.plan]?.name || subscription.plan}
          onActivate={(id) => activateMutation.mutate(id)}
          onUpgrade={(id, plan) => upgradeMutation.mutate({ id, plan })}
        />
      )}

      {/* Paketi */}
      <PlansGrid
        plans={plans}
        selectedPlan={selectedPlan}
        currentPlan={subscription?.plan}
        onSelectPlan={setSelectedPlan}
      />

      {/* Create form */}
      {showCreateForm && (
        <CreateForm
          selectedPlan={selectedPlan}
          plans={plans}
          form={form}
          onFormChange={setForm}
          onSubmit={() => createMutation.mutate(form as unknown as SubscriptionFormRow)}
          onCancel={() => setShowCreateForm(false)}
          isPending={createMutation.isPending}
        />
      )}

      {/* Računi */}
      {invoices.length > 0 && (
        <InvoicesTable invoices={invoices} />
      )}

      {/* Stats */}
      {stats.totalInvoices > 0 && (
        <StatsCards stats={stats} />
      )}
    </div>
  )
})
