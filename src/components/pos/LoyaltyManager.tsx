'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Plus, Crown } from 'lucide-react'
import { useState, useMemo, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type LoyaltyAccount } from './loyalty/constants'

// Lazy-loaded podkomponente
const LoyaltySummaryCards = dynamic(() => import('./loyalty/LoyaltySummaryCards').then(m => ({ default: m.LoyaltySummaryCards })), { ssr: false })
const LoyaltyFilters = dynamic(() => import('./loyalty/LoyaltyFilters').then(m => ({ default: m.LoyaltyFilters })), { ssr: false })
const LoyaltyAccountTable = dynamic(() => import('./loyalty/LoyaltyAccountTable').then(m => ({ default: m.LoyaltyAccountTable })), { ssr: false })
const LoyaltyFormDialog = dynamic(() => import('./loyalty/LoyaltyFormDialog').then(m => ({ default: m.LoyaltyFormDialog })), { ssr: false })
const LoyaltyAdjustPointsDialog = dynamic(() => import('./loyalty/LoyaltyAdjustPointsDialog').then(m => ({ default: m.LoyaltyAdjustPointsDialog })), { ssr: false })
const LoyaltyHistoryDialog = dynamic(() => import('./loyalty/LoyaltyHistoryDialog').then(m => ({ default: m.LoyaltyHistoryDialog })), { ssr: false })
const LoyaltyDeleteDialog = dynamic(() => import('./loyalty/LoyaltyDeleteDialog').then(m => ({ default: m.LoyaltyDeleteDialog })), { ssr: false })
const LoyaltyLoadingSkeleton = dynamic(() => import('./loyalty/LoyaltyLoadingSkeleton').then(m => ({ default: m.LoyaltyLoadingSkeleton })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const LoyaltyManager = memo(function LoyaltyManager() {
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
    queryKey: [...queryKeys.loyalty.all, tierFilter, showInactive],
    queryFn: async () => {
      const res = await authFetch(`/api/loyalty?${queryParams}`)
      if (!res.ok) throw new Error('Napaka pri pridobivanju podatkov')
      return res.json()
    },
  })

  // Query za podrobnosti računa (zgodovina transakcij)
  const { data: accountDetail, isLoading: isLoadingDetail } = useQuery<LoyaltyAccount>({
    queryKey: [...queryKeys.loyalty.all, historyAccount?.id],
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
      queryClient.invalidateQueries({ queryKey: queryKeys.loyalty.all })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.loyalty.all })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.loyalty.all })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.loyalty.all })
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

  const openCreate = useCallback(() => {
    setEditingAccount(null)
    setFormData({
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      tier: 'bronze',
      isActive: true,
    })
    setDialogOpen(true)
  }, [])

  const openEdit = useCallback((account: LoyaltyAccount) => {
    setEditingAccount(account)
    setFormData({
      customerName: account.customerName,
      customerPhone: account.customerPhone,
      customerEmail: account.customerEmail,
      tier: account.tier,
      isActive: account.isActive,
    })
    setDialogOpen(true)
  }, [])

  const handleSubmit = useCallback(() => {
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
  }, [formData, editingAccount, updateMutation, createMutation])

  const openAdjust = useCallback((account: LoyaltyAccount) => {
    setAdjustAccount(account)
    setAdjustData({ type: 'earn', points: '', reason: '', monetaryValue: '' })
    setAdjustDialogOpen(true)
  }, [])

  const handleAdjust = useCallback(() => {
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
  }, [adjustAccount, adjustData, adjustMutation])

  const openHistory = useCallback((account: LoyaltyAccount) => {
    setHistoryAccount(account)
    setHistoryDialogOpen(true)
  }, [])

  const confirmDelete = useCallback((account: LoyaltyAccount) => {
    setDeleteTarget(account)
    setDeleteDialogOpen(true)
  }, [])

  const resetFilters = useCallback(() => {
    setSearch('')
    setTierFilter('all')
    setShowInactive(false)
  }, [])

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
  }, [])

  const handleFormDialogOpenChange = useCallback((open: boolean) => {
    if (!open) { setEditingAccount(null) }
    setDialogOpen(open)
  }, [])

  const handleFormDialogCancel = useCallback(() => {
    setDialogOpen(false)
    setEditingAccount(null)
  }, [])

  const handleAdjustDialogClose = useCallback(() => {
    setAdjustDialogOpen(false)
  }, [])

  const handleConfirmDeleteAccount = useCallback(() => {
    if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
  }, [deleteTarget, deleteMutation])

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    setDeleteDialogOpen(open)
  }, [])

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
        <LoyaltyLoadingSkeleton />
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
      <LoyaltySummaryCards
        totalAccounts={allAccounts.length}
        activeAccounts={activeAccounts.length}
        totalPointsIssued={totalPointsIssued}
        totalPointsRedeemed={totalPointsRedeemed}
      />

      {/* Filtri */}
      <LoyaltyFilters
        search={search}
        tierFilter={tierFilter}
        showInactive={showInactive}
        onSearchChange={handleSearchChange}
        onTierFilterChange={setTierFilter}
        onShowInactiveChange={setShowInactive}
        onResetFilters={resetFilters}
      />

      {/* Tabela računov */}
      <LoyaltyAccountTable
        accounts={filteredAccounts}
        totalAccounts={allAccounts.length}
        tierFilter={tierFilter}
        onOpenAdjust={openAdjust}
        onOpenHistory={openHistory}
        onOpenEdit={openEdit}
        onConfirmDelete={confirmDelete}
        onOpenCreate={openCreate}
        search={search}
      />

      {/* Dijalog za vnos/urejanje */}
      <LoyaltyFormDialog
        open={dialogOpen}
        editingAccount={editingAccount}
        formData={formData}
        isCreatePending={createMutation.isPending}
        isUpdatePending={updateMutation.isPending}
        onOpenChange={handleFormDialogOpenChange}
        onFormDataChange={setFormData}
        onSubmit={handleSubmit}
        onCancel={handleFormDialogCancel}
      />

      {/* Dijalog za prilagajanje točk */}
      <LoyaltyAdjustPointsDialog
        open={adjustDialogOpen}
        adjustAccount={adjustAccount}
        adjustData={adjustData}
        isPending={adjustMutation.isPending}
        onOpenChange={setAdjustDialogOpen}
        onAdjustDataChange={setAdjustData}
        onSubmit={handleAdjust}
        onCancel={handleAdjustDialogClose}
      />

      {/* Dijalog za zgodovino transakcij */}
      <LoyaltyHistoryDialog
        open={historyDialogOpen}
        historyAccount={historyAccount}
        accountDetail={accountDetail}
        isLoadingDetail={isLoadingDetail}
        onOpenChange={setHistoryDialogOpen}
      />

      {/* Dijalog za brisanje */}
      <LoyaltyDeleteDialog
        open={deleteDialogOpen}
        deleteTarget={deleteTarget}
        isPending={deleteMutation.isPending}
        onOpenChange={handleDeleteDialogOpenChange}
        onConfirm={handleConfirmDeleteAccount}
      />
    </div>
  )
})
