'use client'

import { useState, memo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CreditCard, Check, Star, Zap, Crown, Receipt, Clock, ArrowUpRight, Plus } from 'lucide-react'
import { authFetch } from '@/components/pos/PinLogin'
import type { SubscriptionFormRow, InvoiceRow } from '@/lib/types'
import { queryKeys } from '@/lib/query-keys'

const planIcons: Record<string, React.ReactNode> = {
  starter: <Zap className="h-5 w-5" />,
  professional: <Star className="h-5 w-5" />,
  enterprise: <Crown className="h-5 w-5" />,
}

const planColors: Record<string, string> = {
  starter: 'from-blue-500 to-blue-600',
  professional: 'from-amber-500 to-orange-600',
  enterprise: 'from-purple-600 to-indigo-700',
}

export const SubscriptionManager = memo(function SubscriptionManager() {
  const queryClient = useQueryClient()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<string>('starter')
  const [form, setForm] = useState({
    companyName: '', email: '', phone: '', taxId: '', businessId: '',
    locationCount: 1, paymentMethod: 'bank_transfer',
  })

  const { data, isLoading } = useQuery<{
    subscription?: {
      id: string; plan: string; status: string; monthlyPrice: number; locationCount: number
      companyName: string; trialEndsAt?: string; currentPeriodEnd?: string
      invoices?: InvoiceRow[]
    }
    plans?: Record<string, { name: string; price: number; features: string[] }>
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
  const plans = data?.plans || {} as Record<string, { name: string; price: number; features: string[] }>
  const stats = data?.stats || {} as Record<string, number>
  const invoices = subscription?.invoices || []

  const statusLabels: Record<string, string> = {
    trial: 'Preizkusno obdobje',
    active: 'Aktivna',
    past_due: 'Zapadla',
    cancelled: 'Preklicana',
    expired: 'Potekla',
  }

  const statusColors: Record<string, string> = {
    trial: 'bg-blue-100 text-blue-700',
    active: 'bg-green-100 text-green-700',
    past_due: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-600',
    expired: 'bg-gray-100 text-gray-500',
  }

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
        <Card className={`border-2 ${subscription.status === 'active' ? 'border-green-500/30' : subscription.status === 'trial' ? 'border-blue-500/30' : 'border-red-500/30'}`}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${planColors[subscription.plan] || 'from-gray-400 to-gray-500'} text-white flex items-center justify-center`}>
                    {planIcons[subscription.plan]}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{plans[subscription.plan]?.name || subscription.plan}</h3>
                    <p className="text-muted-foreground">{subscription.companyName}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Badge className={statusColors[subscription.status] || ''}>
                    {statusLabels[subscription.status] || subscription.status}
                  </Badge>
                  <span className="text-2xl font-bold">€{subscription.monthlyPrice}<span className="text-sm text-muted-foreground font-normal">/mesec</span></span>
                  <span className="text-sm text-muted-foreground">{subscription.locationCount} lokacij</span>
                </div>
                {subscription.status === 'trial' && subscription.trialEndsAt && (
                  <p className="text-sm text-blue-600 mt-2">
                    <Clock className="h-3.5 w-3.5 inline mr-1" />
                    Preizkusno obdobje do {new Date(subscription.trialEndsAt).toLocaleDateString('sl-SI')}
                  </p>
                )}
                {subscription.currentPeriodEnd && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Veljavno do {new Date(subscription.currentPeriodEnd).toLocaleDateString('sl-SI')}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {subscription.status === 'trial' && (
                  <Button onClick={() => activateMutation.mutate(subscription.id)} className="gap-1">
                    <Check className="h-4 w-4" /> Aktiviraj
                  </Button>
                )}
                {subscription.plan !== 'enterprise' && (
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => upgradeMutation.mutate({ id: subscription.id, plan: subscription.plan === 'starter' ? 'professional' : 'enterprise' })}>
                    <ArrowUpRight className="h-3.5 w-3.5" /> Nadgradi
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paketi */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(plans).map(([key, plan]) => (
          <Card key={key} className={`relative overflow-hidden ${subscription?.plan === key ? 'ring-2 ring-primary' : ''}`}>
            <div className={`h-1.5 bg-gradient-to-r ${planColors[key]}`} />
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${planColors[key]} text-white flex items-center justify-center`}>
                  {planIcons[key]}
                </div>
                <h3 className="font-bold text-lg">{plan.name}</h3>
              </div>
              <div className="mb-4">
                <span className="text-3xl font-bold">€{plan.price}</span>
                <span className="text-muted-foreground text-sm">/mesec</span>
              </div>
              <ul className="space-y-2 text-sm">
                {plan.features.map((f: string, i: number) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {!subscription && (
                <Button
                  className="w-full mt-4"
                  variant={selectedPlan === key ? 'default' : 'outline'}
                  onClick={() => setSelectedPlan(key)}
                >
                  {selectedPlan === key ? 'Izbrano ✓' : 'Izberi'}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create form */}
      {showCreateForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Aktivacija naročnine — {plans[selectedPlan]?.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input aria-label="Ime podjetja" placeholder="Ime podjetja *" value={form.companyName} onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))} className="col-span-2" />
              <Input aria-label="E-pošta" placeholder="E-pošta *" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              <Input aria-label="Telefon" placeholder="Telefon" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              <Input aria-label="Matična številka" placeholder="Matična št." value={form.businessId} onChange={e => setForm(p => ({ ...p, businessId: e.target.value }))} />
              <Input aria-label="DDV identifikacija" placeholder="DDV ID" value={form.taxId} onChange={e => setForm(p => ({ ...p, taxId: e.target.value }))} />
              <div className="flex items-center gap-2">
                <label className="text-sm">Št. lokacij:</label>
                <Input aria-label="Število lokacij" type="number" min={1} max={50} value={form.locationCount} onChange={e => setForm(p => ({ ...p, locationCount: parseInt(e.target.value) || 1 }))} className="w-20" />
              </div>
              <select value={form.paymentMethod} onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value }))} className="px-3 py-2 rounded-lg border bg-background text-sm">
                <option value="bank_transfer">Bančno nakazilo</option>
                <option value="card">Kartica</option>
                <option value="invoice">Račun</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createMutation.mutate(form)} disabled={!form.companyName || !form.email || createMutation.isPending} className="flex-1">
                {createMutation.isPending ? 'Ustvarjam...' : `Aktiviraj ${plans[selectedPlan]?.name} (€${plans[selectedPlan]?.price}/mesec)`}
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>Prekliči</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Računi */}
      {invoices.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Računi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left p-3 font-medium">Št. računa</th>
                    <th className="text-right p-3 font-medium">Znesek</th>
                    <th className="text-left p-3 font-medium">Obdobje</th>
                    <th className="text-right p-3 font-medium">Zapadlost</th>
                    <th className="text-center p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: InvoiceRow) => (
                    <tr key={inv.id} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="p-3 text-right font-semibold">€{(inv.totalAmount ?? 0).toFixed(2)}</td>
                      <td className="p-3 text-xs">{inv.periodStart ? new Date(inv.periodStart).toLocaleDateString('sl-SI') : '-'} - {inv.periodEnd ? new Date(inv.periodEnd).toLocaleDateString('sl-SI') : '-'}</td>
                      <td className="p-3 text-right text-xs">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('sl-SI') : '-'}</td>
                      <td className="p-3 text-center">
                        <Badge variant={inv.status === 'paid' ? 'default' : 'secondary'} className={inv.status === 'paid' ? 'bg-green-600' : inv.status === 'overdue' ? 'bg-red-600' : ''}>
                          {inv.status === 'paid' ? 'Plačan' : inv.status === 'overdue' ? 'Zapadel' : 'Čakajoč'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {stats.totalInvoices > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Računi skupaj</p>
            <p className="text-xl font-bold">{stats.totalInvoices}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Plačani</p>
            <p className="text-xl font-bold text-green-600">{stats.paidInvoices}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Skupni prihodek</p>
            <p className="text-xl font-bold text-blue-600">€{(stats.totalRevenue || 0).toFixed(2)}</p>
          </CardContent></Card>
        </div>
      )}
    </div>
  )
})
