'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Search, Star, Trophy, Crown, Gem,
  Users, Award, TrendingUp, ArrowDownCircle, History,
  ArrowUpCircle, RotateCcw, Filter, UserCheck, UserX,
  Coins, CircleDollarSign,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'

// ============================================
// TIPI
// ============================================

interface LoyaltyTransaction {
  id: string
  loyaltyAccountId: string
  type: string
  points: number
  reason: string
  orderId: string | null
  checkId: string | null
  monetaryValue: number
  createdAt: string
}

interface LoyaltyAccount {
  id: string
  customerName: string
  customerPhone: string
  customerEmail: string
  pointsBalance: number
  lifetimePoints: number
  tier: string
  isActive: boolean
  transactions: LoyaltyTransaction[]
  createdAt: string
  updatedAt: string
}

// ============================================
// KONSTANTE
// ============================================

const tierConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  bronze: {
    label: 'Bronasti',
    icon: Star,
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  silver: {
    label: 'Srebrni',
    icon: Award,
    color: 'text-gray-600 dark:text-gray-300',
    bgColor: 'bg-gray-50 dark:bg-gray-900/30',
    borderColor: 'border-gray-200 dark:border-gray-700',
  },
  gold: {
    label: 'Zlati',
    icon: Trophy,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
  },
  platinum: {
    label: 'Platinasti',
    icon: Gem,
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
}

const tierBadgeStyles: Record<string, string> = {
  bronze: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  silver: 'bg-gray-200 text-gray-800 dark:bg-gray-700/30 dark:text-gray-300',
  gold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  platinum: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
}

const transactionTypeConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  earn: { label: 'Prislužene', color: 'text-emerald-600 dark:text-emerald-400', icon: ArrowUpCircle },
  redeem: { label: 'Unovčene', color: 'text-blue-600 dark:text-blue-400', icon: ArrowDownCircle },
  adjust: { label: 'Prilagojene', color: 'text-amber-600 dark:text-amber-400', icon: RotateCcw },
  expire: { label: 'Potekle', color: 'text-red-600 dark:text-red-400', icon: TrendingUp },
}

const transactionBadgeStyles: Record<string, string> = {
  earn: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  redeem: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  adjust: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  expire: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

// ============================================
// POMOŽNE FUNKCIJE
// ============================================

function formatDateSI(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPoints(points: number): string {
  return points.toLocaleString('sl-SI')
}

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export function LoyaltyManager() {
  const queryClient = useQueryClient()

  // --- Stanja ---
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [showInactive, setShowInactive] = useState(false)

  // --- Dijalog za vnos/urejanje ---
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<LoyaltyAccount | null>(null)
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    tier: 'bronze',
    isActive: true,
  })

  // --- Dijalog za zgodovino transakcij ---
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [historyAccount, setHistoryAccount] = useState<LoyaltyAccount | null>(null)

  // --- Dijalog za prilagajanje točk ---
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [adjustAccount, setAdjustAccount] = useState<LoyaltyAccount | null>(null)
  const [adjustData, setAdjustData] = useState({
    type: 'earn' as 'earn' | 'redeem' | 'adjust',
    points: '',
    reason: '',
    monetaryValue: '',
  })

  // --- Dijalog za brisanje ---
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LoyaltyAccount | null>(null)

  // ============================================
  // QUERIES
  // ============================================

  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    if (tierFilter !== 'all') params.set('tier', tierFilter)
    if (!showInactive) params.set('isActive', 'true')
    return params.toString()
  }, [tierFilter, showInactive])

  const { data: accounts, isLoading } = useQuery<LoyaltyAccount[]>({
    queryKey: ['loyalty', tierFilter, showInactive],
    queryFn: async () => {
      const res = await authFetch(`/api/loyalty?${queryParams}`)
      if (!res.ok) throw new Error('Napaka pri pridobivanju podatkov')
      return res.json()
    },
  })

  // Query za podrobnosti računa (zgodovina transakcij)
  const { data: accountDetail, isLoading: isLoadingDetail } = useQuery<LoyaltyAccount>({
    queryKey: ['loyalty', historyAccount?.id],
    queryFn: async () => {
      if (!historyAccount) return null
      const res = await authFetch(`/api/loyalty/${historyAccount.id}`)
      if (!res.ok) throw new Error('Napaka pri pridobivanju podatkov')
      return res.json()
    },
    enabled: !!historyAccount && historyDialogOpen,
  })

  // ============================================
  // IZRAČUNI ZA POVZETEK
  // ============================================

  const allAccounts = accounts || []

  const filteredAccounts = allAccounts.filter((account) => {
    const q = search.toLowerCase()
    const matchesSearch =
      account.customerName.toLowerCase().includes(q) ||
      account.customerPhone.toLowerCase().includes(q) ||
      account.customerEmail.toLowerCase().includes(q)
    return matchesSearch
  })

  const activeAccounts = allAccounts.filter((a) => a.isActive)
  const totalPointsIssued = allAccounts.reduce((sum, a) => sum + a.lifetimePoints, 0)
  const totalPointsRedeemed = allAccounts.reduce((sum, a) => {
    const redeemed = a.transactions
      .filter((t) => t.type === 'redeem')
      .reduce((s, t) => s + Math.abs(t.points), 0)
    return sum + redeemed
  }, 0)

  // ============================================
  // MUTATIONS
  // ============================================

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/loyalty', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka pri ustvarjanju računa')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Zvestobni račun uspešno ustvarjen')
      queryClient.invalidateQueries({ queryKey: ['loyalty'] })
      setDialogOpen(false)
    },
    onError: () => {
      toast.error('Napaka pri ustvarjanju zvestobnega računa')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/loyalty/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka pri posodabljanju računa')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Zvestobni račun uspešno posodobljen')
      queryClient.invalidateQueries({ queryKey: ['loyalty'] })
      setDialogOpen(false)
      setEditingAccount(null)
    },
    onError: () => {
      toast.error('Napaka pri posodabljanju zvestobnega računa')
    },
  })

  const adjustMutation = useMutation({
    mutationFn: async ({ id, transaction, ...data }: { id: string; transaction: Record<string, unknown> } & Record<string, unknown>) => {
      const res = await authFetch(`/api/loyalty/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...data, transaction }),
      })
      if (!res.ok) throw new Error('Napaka pri prilagajanju točk')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Točke uspešno prilagojene')
      queryClient.invalidateQueries({ queryKey: ['loyalty'] })
      setAdjustDialogOpen(false)
      setAdjustAccount(null)
      setAdjustData({ type: 'earn', points: '', reason: '', monetaryValue: '' })
    },
    onError: () => {
      toast.error('Napaka pri prilagajanju točk')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/loyalty/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka pri brisanju računa')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Zvestobni račun uspešno izbrisan')
      queryClient.invalidateQueries({ queryKey: ['loyalty'] })
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    },
    onError: () => {
      toast.error('Napaka pri brisanju zvestobnega računa')
    },
  })

  // ============================================
  // HANDLERJI
  // ============================================

  const openCreate = () => {
    setEditingAccount(null)
    setFormData({
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      tier: 'bronze',
      isActive: true,
    })
    setDialogOpen(true)
  }

  const openEdit = (account: LoyaltyAccount) => {
    setEditingAccount(account)
    setFormData({
      customerName: account.customerName,
      customerPhone: account.customerPhone,
      customerEmail: account.customerEmail,
      tier: account.tier,
      isActive: account.isActive,
    })
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!formData.customerName.trim()) {
      toast.error('Ime stranke je obvezno')
      return
    }

    const payload = {
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      customerEmail: formData.customerEmail,
      tier: formData.tier,
      isActive: formData.isActive,
    }

    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const openAdjust = (account: LoyaltyAccount) => {
    setAdjustAccount(account)
    setAdjustData({ type: 'earn', points: '', reason: '', monetaryValue: '' })
    setAdjustDialogOpen(true)
  }

  const handleAdjust = () => {
    if (!adjustAccount) return
    const pointsValue = parseInt(adjustData.points)
    if (!pointsValue || pointsValue <= 0) {
      toast.error('Vnesite veljavno število točk')
      return
    }
    if (!adjustData.reason.trim()) {
      toast.error('Razlog za prilagoditev je obvezen')
      return
    }

    let newPointsBalance = adjustAccount.pointsBalance
    let newLifetimePoints = adjustAccount.lifetimePoints
    const transactionPoints = adjustData.type === 'redeem' ? -pointsValue : pointsValue

    if (adjustData.type === 'earn') {
      newPointsBalance += pointsValue
      newLifetimePoints += pointsValue
    } else if (adjustData.type === 'redeem') {
      if (pointsValue > adjustAccount.pointsBalance) {
        toast.error('Ni dovolj točk za unovčenje')
        return
      }
      newPointsBalance -= pointsValue
    } else if (adjustData.type === 'adjust') {
      newPointsBalance += transactionPoints
      if (transactionPoints > 0) {
        newLifetimePoints += transactionPoints
      }
    }

    adjustMutation.mutate({
      id: adjustAccount.id,
      pointsBalance: newPointsBalance,
      lifetimePoints: newLifetimePoints,
      transaction: {
        type: adjustData.type,
        points: transactionPoints,
        reason: adjustData.reason,
        monetaryValue: parseFloat(adjustData.monetaryValue) || 0,
      },
    })
  }

  const openHistory = (account: LoyaltyAccount) => {
    setHistoryAccount(account)
    setHistoryDialogOpen(true)
  }

  const confirmDelete = (account: LoyaltyAccount) => {
    setDeleteTarget(account)
    setDeleteDialogOpen(true)
  }

  const resetFilters = () => {
    setSearch('')
    setTierFilter('all')
    setShowInactive(false)
  }

  // ============================================
  // RENDER: POVZETEK
  // ============================================

  const renderSummaryCards = () => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{allAccounts.length}</p>
              <p className="text-xs text-muted-foreground">Skupaj računov</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{activeAccounts.length}</p>
              <p className="text-xs text-muted-foreground">Aktivni računi</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{formatPoints(totalPointsIssued)}</p>
              <p className="text-xs text-muted-foreground">Izdane točke</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
              <CircleDollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{formatPoints(totalPointsRedeemed)}</p>
              <p className="text-xs text-muted-foreground">Unovčene točke</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // ============================================
  // RENDER: FILTRI
  // ============================================

  const renderFilters = () => (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Išči po imenu, telefonu, e-pošti..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="w-44">
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Vsi nivoji" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Vsi nivoji</SelectItem>
                {Object.entries(tierConfig).map(([key, cfg]) => {
                  const Icon = cfg.icon
                  return (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 h-9">
            <Switch
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Prikaži nedejavne</Label>
          </div>
          {(search || tierFilter !== 'all' || showInactive) && (
            <Button variant="ghost" size="sm" className="h-9" onClick={resetFilters}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Počisti
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )

  // ============================================
  // RENDER: TABELA RAČUNOV
  // ============================================

  const renderAccountTable = () => {
    if (filteredAccounts.length === 0) {
      return renderEmptyState()
    }

    return (
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ime stranke</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Nivo</TableHead>
                  <TableHead className="text-right">Stanje točk</TableHead>
                  <TableHead className="text-right">Doslej zbrane</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Dejanja</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map((account) => {
                  const tier = tierConfig[account.tier] || tierConfig.bronze
                  const TierIcon = tier.icon

                  return (
                    <TableRow key={account.id} className={!account.isActive ? 'opacity-60' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tier.bgColor} ${tier.color} flex-shrink-0`}>
                            <TierIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{account.customerName || 'Brez imena'}</p>
                            {account.customerEmail && (
                              <p className="text-xs text-muted-foreground truncate max-w-36">{account.customerEmail}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{account.customerPhone || '—'}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${tierBadgeStyles[account.tier] || tierBadgeStyles.bronze}`}>
                          {tier.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">{formatPoints(account.pointsBalance)}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{formatPoints(account.lifetimePoints)}</TableCell>
                      <TableCell>
                        {account.isActive ? (
                          <Badge className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                            Aktiven
                          </Badge>
                        ) : (
                          <Badge className="text-xs bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400">
                            Nedejaven
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Prilagodi točke" onClick={() => openAdjust(account)}>
                            <Coins className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Zgodovina" onClick={() => openHistory(account)}>
                            <History className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Uredi" onClick={() => openEdit(account)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Izbriši" onClick={() => confirmDelete(account)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground px-4 py-3 border-t">
            <span>Prikazanih {filteredAccounts.length} od {allAccounts.length} računov</span>
            {tierFilter !== 'all' && (
              <span>Filter: {tierConfig[tierFilter]?.label || tierFilter}</span>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // ============================================
  // RENDER: PRAZNO STANJE
  // ============================================

  const renderEmptyState = () => (
    <div className="text-center py-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
        <Award className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">Ni zvestobnih računov</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
        {search || tierFilter !== 'all'
          ? 'Za izbrane filtre ni računov. Poskusite spremeniti filter.'
          : 'Ustvarite prvi zvestobni račun za začetek programa zvestobe.'}
      </p>
      <Button onClick={openCreate}>
        <Plus className="h-4 w-4 mr-2" />
        Dodaj račun
      </Button>
    </div>
  )

  // ============================================
  // RENDER: DIJALOG ZA VNOS/UREJANJE
  // ============================================

  const renderFormDialog = () => (
    <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setEditingAccount(null) } setDialogOpen(open) }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            {editingAccount ? 'Uredi zvestobni račun' : 'Dodaj račun'}
          </DialogTitle>
          <DialogDescription>
            {editingAccount
              ? 'Posodobite podatke obstoječega zvestobnega računa.'
              : 'Ustvarite nov zvestobni račun za stranko.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Ime stranke */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Ime stranke *</Label>
            <Input
              placeholder="npr. Ana Novak"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
            />
          </div>

          {/* Telefon in E-pošta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Telefon</Label>
              <Input
                placeholder="npr. 031 234 567"
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">E-pošta</Label>
              <Input
                placeholder="npr. ana@primer.si"
                type="email"
                value={formData.customerEmail}
                onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
              />
            </div>
          </div>

          {/* Nivo */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Nivo</Label>
            <Select
              value={formData.tier}
              onValueChange={(v) => setFormData({ ...formData, tier: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Izberite nivo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(tierConfig).map(([key, cfg]) => {
                  const Icon = cfg.icon
                  return (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Aktiven */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">Aktiven račun</Label>
              <p className="text-xs text-muted-foreground">Nedejavni računi ne morejo zbirati ali unovčevati točk</p>
            </div>
            <Switch
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingAccount(null) }}>
            Prekliči
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !formData.customerName.trim() ||
              createMutation.isPending ||
              updateMutation.isPending
            }
          >
            {createMutation.isPending || updateMutation.isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                {editingAccount ? 'Posodabljam...' : 'Vnašam...'}
              </>
            ) : editingAccount ? (
              'Posodobi račun'
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1.5" />
                Dodaj račun
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // ============================================
  // RENDER: DIJALOG ZA PRILAGANJE TOČK
  // ============================================

  const renderAdjustDialog = () => (
    <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Prilagodi točke
          </DialogTitle>
          <DialogDescription>
            Ročno dodajte ali odštejte točke za{' '}
            <strong>{adjustAccount?.customerName || 'stranko'}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Trenutno stanje */}
          {adjustAccount && (
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/50">
              <span className="text-sm text-muted-foreground">Trenutno stanje točk</span>
              <span className="font-bold text-lg">{formatPoints(adjustAccount.pointsBalance)}</span>
            </div>
          )}

          {/* Vrsta transakcije */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Vrsta transakcije</Label>
            <Select
              value={adjustData.type}
              onValueChange={(v) => setAdjustData({ ...adjustData, type: v as 'earn' | 'redeem' | 'adjust' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="earn">
                  <span className="flex items-center gap-2">
                    <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-600" />
                    Prislužene točke
                  </span>
                </SelectItem>
                <SelectItem value="redeem">
                  <span className="flex items-center gap-2">
                    <ArrowDownCircle className="h-3.5 w-3.5 text-blue-600" />
                    Unovči točke
                  </span>
                </SelectItem>
                <SelectItem value="adjust">
                  <span className="flex items-center gap-2">
                    <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                    Prilagoditev
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Število točk */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Število točk *</Label>
            <Input
              type="number"
              min="1"
              placeholder="npr. 100"
              value={adjustData.points}
              onChange={(e) => setAdjustData({ ...adjustData, points: e.target.value })}
            />
          </div>

          {/* Denarna vrednost */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Denarna vrednost (€)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="npr. 5.00"
              value={adjustData.monetaryValue}
              onChange={(e) => setAdjustData({ ...adjustData, monetaryValue: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Neobvezno — vnesite, če točke ustrezajo določenemu znesku</p>
          </div>

          {/* Razlog */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Razlog *</Label>
            <Textarea
              placeholder="npr. Rojstnodnevni bonus, kompenzacija, napaka..."
              value={adjustData.reason}
              onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>
            Prekliči
          </Button>
          <Button
            onClick={handleAdjust}
            disabled={adjustMutation.isPending}
          >
            {adjustMutation.isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Prilagajam...
              </>
            ) : (
              <>
                <Coins className="h-4 w-4 mr-1.5" />
                Potrdi
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // ============================================
  // RENDER: DIJALOG ZA ZGODOVINO TRANSAKCIJ
  // ============================================

  const renderHistoryDialog = () => {
    const account = accountDetail || historyAccount
    if (!account) return null

    const transactions = account.transactions || []
    const tier = tierConfig[account.tier] || tierConfig.bronze
    const TierIcon = tier.icon

    return (
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Zgodovina transakcij
            </DialogTitle>
            <DialogDescription>
              Zgodovina transakcij za <strong>{account.customerName || 'stranko'}</strong>
            </DialogDescription>
          </DialogHeader>

          {/* Podatki o stranki */}
          <div className="flex items-center gap-3 rounded-lg border p-4 bg-muted/50">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tier.bgColor} ${tier.color}`}>
              <TierIcon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{account.customerName || 'Brez imena'}</p>
                <Badge className={`text-xs ${tierBadgeStyles[account.tier] || tierBadgeStyles.bronze}`}>
                  {tier.label}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                {account.customerPhone && <span>{account.customerPhone}</span>}
                {account.customerEmail && <span>{account.customerEmail}</span>}
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg">{formatPoints(account.pointsBalance)}</p>
              <p className="text-xs text-muted-foreground">Stanje točk</p>
            </div>
          </div>

          <Separator />

          {/* Tabela transakcij */}
          {isLoadingDetail ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : transactions.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vrsta</TableHead>
                    <TableHead className="text-right">Točke</TableHead>
                    <TableHead>Razlog</TableHead>
                    <TableHead className="text-right">Vrednost (€)</TableHead>
                    <TableHead>Datum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => {
                    const txConfig = transactionTypeConfig[tx.type] || transactionTypeConfig.adjust
                    const TxIcon = txConfig.icon
                    return (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TxIcon className={`h-4 w-4 ${txConfig.color}`} />
                            <Badge className={`text-xs ${transactionBadgeStyles[tx.type] || transactionBadgeStyles.adjust}`}>
                              {txConfig.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${tx.points >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {tx.points >= 0 ? '+' : ''}{formatPoints(tx.points)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-40 truncate">
                          {tx.reason || '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {tx.monetaryValue > 0 ? `€${tx.monetaryValue.toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateSI(tx.createdAt)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <History className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-30" />
              <p className="text-sm text-muted-foreground">Ni transakcij za ta račun</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    )
  }

  // ============================================
  // RENDER: DIJALOG ZA BRISANJE
  // ============================================

  const renderDeleteDialog = () => (
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Izbriši zvestobni račun</AlertDialogTitle>
          <AlertDialogDescription>
            Ali ste prepričani, da želite izbrisati račun {deleteTarget?.customerName || 'Brez imena'}? Vse transakcije bodo prav tako izbrisane. Tega dejanja ni mogoče razveljaviti.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Prekliči</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Brišem...' : 'Izbriši'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  // ============================================
  // RENDER: LOADING SKELETON
  // ============================================

  const renderLoadingSkeleton = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={`sum-${i}`} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-14" />
      <Skeleton className="h-96" />
    </div>
  )

  // ============================================
  // GLAVNI RENDER
  // ============================================

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Zvestobni program</h2>
            <p className="text-muted-foreground">Nalaganje...</p>
          </div>
        </div>
        {renderLoadingSkeleton()}
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Glava */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" />
            Zvestobni program
          </h2>
          <p className="text-muted-foreground">Upravljanje zvestobnih računov in točk</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj račun
        </Button>
      </div>

      {/* Povzetek */}
      {renderSummaryCards()}

      {/* Filtri */}
      {renderFilters()}

      {/* Tabela računov */}
      {renderAccountTable()}

      {/* Dijalog za vnos/urejanje */}
      {renderFormDialog()}

      {/* Dijalog za prilagajanje točk */}
      {renderAdjustDialog()}

      {/* Dijalog za zgodovino transakcij */}
      {renderHistoryDialog()}

      {/* Dijalog za brisanje */}
      {renderDeleteDialog()}
    </div>
  )
}
