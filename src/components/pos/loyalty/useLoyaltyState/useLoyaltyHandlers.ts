'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { type LoyaltyAccount } from '../constants'
import { useLoyaltyMutations } from '../useLoyaltyMutations'

export function useLoyaltyHandlers(
  setDialogOpen: (_open: boolean) => void,
  setEditingAccount: (_account: LoyaltyAccount | null) => void,
  formData: { customerName: string; customerPhone: string; customerEmail: string; tier: string; isActive: boolean },
  editingAccount: LoyaltyAccount | null,
  adjustAccount: LoyaltyAccount | null,
  adjustData: { type: 'earn' | 'redeem' | 'adjust'; points: string; reason: string; monetaryValue: string },
  setAdjustAccount: (_account: LoyaltyAccount | null) => void,
  setAdjustData: React.Dispatch<React.SetStateAction<{ type: 'earn' | 'redeem' | 'adjust'; points: string; reason: string; monetaryValue: string }>>,
  setAdjustDialogOpen: (_open: boolean) => void,
  setHistoryAccount: (_account: LoyaltyAccount | null) => void,
  setHistoryDialogOpen: (_open: boolean) => void,
  setDeleteTarget: (_account: LoyaltyAccount | null) => void,
  setDeleteDialogOpen: (_open: boolean) => void,
) {
  const { createMutation, updateMutation, adjustMutation, deleteMutation } = useLoyaltyMutations({
    onCloseDialog: () => setDialogOpen(false),
    onClearEditingAccount: () => setEditingAccount(null),
    onCloseAdjustDialog: () => setAdjustDialogOpen(false),
    onClearAdjustAccount: () => setAdjustAccount(null),
    onResetAdjustData: () => setAdjustData({ type: 'earn', points: '', reason: '', monetaryValue: '' }),
    onCloseDeleteDialog: () => setDeleteDialogOpen(false),
    onClearDeleteTarget: () => setDeleteTarget(null),
  })

  const openCreate = useCallback(() => {
    setEditingAccount(null)
    setDialogOpen(true)
  }, [setEditingAccount, setDialogOpen])

  const openEdit = useCallback((account: LoyaltyAccount) => {
    setEditingAccount(account)
    setDialogOpen(true)
  }, [setEditingAccount, setDialogOpen])

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
  }, [setAdjustAccount, setAdjustData, setAdjustDialogOpen])

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
  }, [setHistoryAccount, setHistoryDialogOpen])

  const confirmDelete = useCallback((account: LoyaltyAccount) => {
    setDeleteTarget(account); setDeleteDialogOpen(true)
  }, [setDeleteTarget, setDeleteDialogOpen])

  const resetFilters = useCallback(() => {
    // caller handles setSearch, setTierFilter, setShowInactive
  }, [])

  return {
    createMutation, updateMutation, adjustMutation, deleteMutation,
    openCreate, openEdit, handleSubmit, openAdjust, handleAdjust,
    openHistory, confirmDelete, resetFilters,
  }
}
