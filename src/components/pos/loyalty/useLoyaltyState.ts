'use client'

import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useState, useMemo, useCallback } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type LoyaltyAccount } from './constants'
import { useLoyaltyMutations } from './useLoyaltyMutations'

// ============================================
// HOOK: Stanje, poizvedbe, mutacije in handlerji
// za upravljanje zvestobnega programa
// ============================================

export function useLoyaltyState() {
  // --- Stanja ---
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [showInactive, setShowInactive] = useState(false)

  // Dijalog za vnos/urejanje
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<LoyaltyAccount | null>(null)
  const [formData, setFormData] = useState({
    customerName: '', customerPhone: '', customerEmail: '', tier: 'bronze', isActive: true,
  })

  // Dijalog za zgodovino transakcij
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [historyAccount, setHistoryAccount] = useState<LoyaltyAccount | null>(null)

  // Dijalog za prilagajanje točk
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [adjustAccount, setAdjustAccount] = useState<LoyaltyAccount | null>(null)
  const [adjustData, setAdjustData] = useState({
    type: 'earn' as 'earn' | 'redeem' | 'adjust', points: '', reason: '', monetaryValue: '',
  })

  // Dijalog za brisanje
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
    return account.customerName.toLowerCase().includes(q) ||
      account.customerPhone.toLowerCase().includes(q) ||
      account.customerEmail.toLowerCase().includes(q)
  })

  const activeAccounts = allAccounts.filter((a) => a.isActive)
  const totalPointsIssued = allAccounts.reduce((sum, a) => sum + a.lifetimePoints, 0)
  const totalPointsRedeemed = allAccounts.reduce((sum, a) => {
    return sum + a.transactions
      .filter((t) => t.type === 'redeem')
      .reduce((s, t) => s + Math.abs(t.points), 0)
  }, 0)

  // ============================================
  // MUTATIONS (podedovane iz pod-hooka)
  // ============================================

  const { createMutation, updateMutation, adjustMutation, deleteMutation } = useLoyaltyMutations({
    onCloseDialog: () => setDialogOpen(false),
    onClearEditingAccount: () => setEditingAccount(null),
    onCloseAdjustDialog: () => setAdjustDialogOpen(false),
    onClearAdjustAccount: () => setAdjustAccount(null),
    onResetAdjustData: () => setAdjustData({ type: 'earn', points: '', reason: '', monetaryValue: '' }),
    onCloseDeleteDialog: () => setDeleteDialogOpen(false),
    onClearDeleteTarget: () => setDeleteTarget(null),
  })

  // ============================================
  // HANDLERJI
  // ============================================

  const openCreate = useCallback(() => {
    setEditingAccount(null)
    setFormData({ customerName: '', customerPhone: '', customerEmail: '', tier: 'bronze', isActive: true })
    setDialogOpen(true)
  }, [])

  const openEdit = useCallback((account: LoyaltyAccount) => {
    setEditingAccount(account)
    setFormData({
      customerName: account.customerName, customerPhone: account.customerPhone,
      customerEmail: account.customerEmail, tier: account.tier, isActive: account.isActive,
    })
    setDialogOpen(true)
  }, [])

  const handleSubmit = useCallback(() => {
    if (!formData.customerName.trim()) { toast.error('Ime stranke je obvezno'); return }
    const payload = {
      customerName: formData.customerName, customerPhone: formData.customerPhone,
      customerEmail: formData.customerEmail, tier: formData.tier, isActive: formData.isActive,
    }
    if (editingAccount) { updateMutation.mutate({ id: editingAccount.id, ...payload }) }
    else { createMutation.mutate(payload) }
  }, [formData, editingAccount, updateMutation, createMutation])

  const openAdjust = useCallback((account: LoyaltyAccount) => {
    setAdjustAccount(account)
    setAdjustData({ type: 'earn', points: '', reason: '', monetaryValue: '' })
    setAdjustDialogOpen(true)
  }, [])

  const handleAdjust = useCallback(() => {
    if (!adjustAccount) return
    const pointsValue = parseInt(adjustData.points)
    if (!pointsValue || pointsValue <= 0) { toast.error('Vnesite veljavno število točk'); return }
    if (!adjustData.reason.trim()) { toast.error('Razlog za prilagoditev je obvezen'); return }

    let newPointsBalance = adjustAccount.pointsBalance
    let newLifetimePoints = adjustAccount.lifetimePoints
    const transactionPoints = adjustData.type === 'redeem' ? -pointsValue : pointsValue

    if (adjustData.type === 'earn') {
      newPointsBalance += pointsValue; newLifetimePoints += pointsValue
    } else if (adjustData.type === 'redeem') {
      if (pointsValue > adjustAccount.pointsBalance) { toast.error('Ni dovolj točk za unovčenje'); return }
      newPointsBalance -= pointsValue
    } else if (adjustData.type === 'adjust') {
      newPointsBalance += transactionPoints
      if (transactionPoints > 0) { newLifetimePoints += transactionPoints }
    }

    adjustMutation.mutate({
      id: adjustAccount.id, pointsBalance: newPointsBalance, lifetimePoints: newLifetimePoints,
      transaction: {
        type: adjustData.type, points: transactionPoints, reason: adjustData.reason,
        monetaryValue: parseFloat(adjustData.monetaryValue) || 0,
      },
    })
  }, [adjustAccount, adjustData, adjustMutation])

  const openHistory = useCallback((account: LoyaltyAccount) => {
    setHistoryAccount(account); setHistoryDialogOpen(true)
  }, [])

  const confirmDelete = useCallback((account: LoyaltyAccount) => {
    setDeleteTarget(account); setDeleteDialogOpen(true)
  }, [])

  const resetFilters = useCallback(() => {
    setSearch(''); setTierFilter('all'); setShowInactive(false)
  }, [])

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
  }, [])

  const handleFormDialogOpenChange = useCallback((open: boolean) => {
    if (!open) { setEditingAccount(null) }
    setDialogOpen(open)
  }, [])

  const handleFormDialogCancel = useCallback(() => {
    setDialogOpen(false); setEditingAccount(null)
  }, [])

  const handleAdjustDialogClose = useCallback(() => { setAdjustDialogOpen(false) }, [])

  const handleConfirmDeleteAccount = useCallback(() => {
    if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
  }, [deleteTarget, deleteMutation])

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    setDeleteDialogOpen(open)
  }, [])

  return {
    // Nalaganje
    isLoading,
    // Povzetek
    allAccounts, activeAccounts, totalPointsIssued, totalPointsRedeemed,
    // Filtri
    filteredAccounts, search, tierFilter, showInactive,
    handleSearchChange, resetFilters, setTierFilter, setShowInactive,
    // Dijalog za vnos/urejanje
    dialogOpen, editingAccount, formData, setFormData,
    isCreatePending: createMutation.isPending, isUpdatePending: updateMutation.isPending,
    handleFormDialogOpenChange, handleFormDialogCancel, handleSubmit, openCreate, openEdit,
    // Dijalog za prilagajanje točk
    adjustDialogOpen, adjustAccount, adjustData, setAdjustData,
    isAdjustPending: adjustMutation.isPending,
    setAdjustDialogOpen, handleAdjustDialogClose, handleAdjust, openAdjust,
    // Dijalog za zgodovino
    historyDialogOpen, historyAccount, accountDetail, isLoadingDetail,
    setHistoryDialogOpen, openHistory,
    // Dijalog za brisanje
    deleteDialogOpen, deleteTarget, isDeletePending: deleteMutation.isPending,
    handleDeleteDialogOpenChange, handleConfirmDeleteAccount, confirmDelete,
  }
}
