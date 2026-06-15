'use client'

import { useState, useCallback } from 'react'
import { type LoyaltyAccount } from '../constants'
import { useLoyaltyQueries } from './useLoyaltyQueries'
import { useLoyaltyHandlers } from './useLoyaltyHandlers'

export function useLoyaltyState() {
  // --- Stanja ---
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [showInactive, setShowInactive] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<LoyaltyAccount | null>(null)
  const [formData, setFormData] = useState({
    customerName: '', customerPhone: '', customerEmail: '', tier: 'bronze', isActive: true,
  })

  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [historyAccount, setHistoryAccount] = useState<LoyaltyAccount | null>(null)

  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [adjustAccount, setAdjustAccount] = useState<LoyaltyAccount | null>(null)
  const [adjustData, setAdjustData] = useState({
    type: 'earn' as 'earn' | 'redeem' | 'adjust', points: '', reason: '', monetaryValue: '',
  })

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LoyaltyAccount | null>(null)

  // Queries
  const { accounts, isLoading, accountDetail, isLoadingDetail } = useLoyaltyQueries(tierFilter, showInactive, historyAccount, historyDialogOpen)

  // Computed
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

  // Handlers
  const handlers = useLoyaltyHandlers(
    setDialogOpen, setEditingAccount, formData, editingAccount,
    adjustAccount, adjustData, setAdjustAccount, setAdjustData,
    setAdjustDialogOpen, setHistoryAccount, setHistoryDialogOpen,
    setDeleteTarget, setDeleteDialogOpen,
  )

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
    if (deleteTarget) handlers.deleteMutation.mutate(deleteTarget.id)
  }, [deleteTarget, handlers.deleteMutation])

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    setDeleteDialogOpen(open)
  }, [])

  return {
    isLoading,
    allAccounts, activeAccounts, totalPointsIssued, totalPointsRedeemed,
    filteredAccounts, search, tierFilter, showInactive,
    handleSearchChange, resetFilters, setTierFilter, setShowInactive,
    dialogOpen, editingAccount, formData, setFormData,
    isCreatePending: handlers.createMutation.isPending, isUpdatePending: handlers.updateMutation.isPending,
    handleFormDialogOpenChange, handleFormDialogCancel, handleSubmit: handlers.handleSubmit, openCreate: handlers.openCreate, openEdit: handlers.openEdit,
    adjustDialogOpen, adjustAccount, adjustData, setAdjustData,
    isAdjustPending: handlers.adjustMutation.isPending,
    setAdjustDialogOpen, handleAdjustDialogClose, handleAdjust: handlers.handleAdjust, openAdjust: handlers.openAdjust,
    historyDialogOpen, historyAccount, accountDetail, isLoadingDetail,
    setHistoryDialogOpen, openHistory: handlers.openHistory,
    deleteDialogOpen, deleteTarget, isDeletePending: handlers.deleteMutation.isPending,
    handleDeleteDialogOpenChange, handleConfirmDeleteAccount, confirmDelete: handlers.confirmDelete,
  }
}
