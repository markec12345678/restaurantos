'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useMemo, useCallback } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type GiftCard } from './constants'
import { useGiftCardMutations } from './useGiftCardMutations'
import { useGiftCardDialogs } from './useGiftCardDialogs'
import { useGiftCardMutationHandlers } from './useGiftCardMutationHandlers'

// ============================================
// HOOK: Upravljanje darilnih kartic
// Združuje poizvedbe, filtre, mutacije in dialog handlerje
// ============================================

export function useGiftCardManager() {
  // --- Filtri ---
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortField, setSortField] = useState<'purchasedAt' | 'balance' | 'cardNumber'>('purchasedAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // ============================================
  // DIALOG STATE (iz useGiftCardDialogs)
  // ============================================

  const dlg = useGiftCardDialogs()

  // ============================================
  // QUERIES
  // ============================================

  const { data: giftCards, isLoading } = useQuery<GiftCard[]>({
    queryKey: [...queryKeys.giftCards.all, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await authFetch(`/api/gift-cards?${params}`)
      if (!res.ok) throw new Error('Napaka pri pridobivanju darilnih kartic')
      return res.json()
    },
  })

  // ============================================
  // IZRAČUNI
  // ============================================

  const allCards = giftCards || []

  const filteredCards = useMemo(() => {
    let cards = allCards

    if (search.trim()) {
      const q = search.toLowerCase()
      cards = cards.filter(
        (c) =>
          c.cardNumber.toLowerCase().includes(q) ||
          c.ownerName.toLowerCase().includes(q)
      )
    }

    cards = [...cards].sort((a, b) => {
      let cmp = 0
      if (sortField === 'purchasedAt') {
        cmp = new Date(a.purchasedAt).getTime() - new Date(b.purchasedAt).getTime()
      } else if (sortField === 'balance') {
        cmp = a.balance - b.balance
      } else if (sortField === 'cardNumber') {
        cmp = a.cardNumber.localeCompare(b.cardNumber)
      }
      return sortDir === 'desc' ? -cmp : cmp
    })

    return cards
  }, [allCards, search, sortField, sortDir])

  const summaryStats = useMemo(() => ({
    totalCards: allCards.length,
    activeCards: allCards.filter((c) => c.status === 'active').length,
    totalBalanceOutstanding: allCards.reduce((sum, c) => sum + c.balance, 0),
    totalLoadedThisMonth: (() => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      return allCards.reduce((sum, c) => {
        const loadTx = (c.transactions || []).filter(
          (t) => t.type === 'load' && new Date(t.createdAt) >= monthStart
        )
        return sum + loadTx.reduce((s, t) => s + t.amount, 0)
      }, 0)
    })(),
  }), [allCards])

  // ============================================
  // MUTATIONS + HANDLERJI
  // ============================================

  const mutations = useGiftCardMutations({
    allCards,
    setNewCardDialogOpen: dlg.setNewCardDialogOpen,
    setEditDialogOpen: dlg.setEditDialogOpen,
    setEditTarget: dlg.setEditTarget,
    setLoadDialogOpen: dlg.setLoadDialogOpen,
    setLoadTarget: dlg.setLoadTarget,
    setDeleteDialogOpen: dlg.setDeleteDialogOpen,
    setDeleteTarget: dlg.setDeleteTarget,
  })

  const handlers = useGiftCardMutationHandlers(dlg, {
    createMutate: mutations.createMutation.mutate,
    updateMutate: mutations.updateMutation.mutate,
    loadMutate: mutations.loadMutation.mutate,
    deleteMutate: mutations.deleteMutation.mutate,
  })

  // ============================================
  // SORTIRANJE
  // ============================================

  const handleSort = useCallback((field: 'purchasedAt' | 'balance' | 'cardNumber') => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }, [sortField, sortDir])

  return {
    // Nalaganje
    isLoading,

    // Filtri
    search,
    statusFilter,
    sortField,
    sortDir,
    setSearch,
    setStatusFilter,

    // Izračuni
    allCards,
    filteredCards,
    summaryStats,

    // Dijalog za novo kartico
    newCardDialogOpen: dlg.newCardDialogOpen,
    setNewCardDialogOpen: dlg.setNewCardDialogOpen,
    newCardForm: dlg.newCardForm,
    setNewCardForm: dlg.setNewCardForm,
    handleCreateCard: handlers.handleCreateCard,
    isCreatePending: mutations.createMutation.isPending,

    // Dijalog za urejanje
    editDialogOpen: dlg.editDialogOpen,
    handleEditDialogOpenChange: dlg.handleEditDialogOpenChange,
    editTarget: dlg.editTarget,
    editForm: dlg.editForm,
    setEditForm: dlg.setEditForm,
    openEdit: dlg.openEdit,
    handleEditSave: handlers.handleEditSave,
    isUpdatePending: mutations.updateMutation.isPending,

    // Dijalog za nalaganje
    loadDialogOpen: dlg.loadDialogOpen,
    handleLoadDialogOpenChange: dlg.handleLoadDialogOpenChange,
    loadTarget: dlg.loadTarget,
    loadForm: dlg.loadForm,
    setLoadForm: dlg.setLoadForm,
    openLoad: dlg.openLoad,
    handleLoad: handlers.handleLoad,
    isLoadPending: mutations.loadMutation.isPending,

    // Dijalog za zgodovino
    historyDialogOpen: dlg.historyDialogOpen,
    handleHistoryDialogOpenChange: dlg.handleHistoryDialogOpenChange,
    historyTarget: dlg.historyTarget,
    openHistory: dlg.openHistory,

    // Dijalog za brisanje
    deleteDialogOpen: dlg.deleteDialogOpen,
    setDeleteDialogOpen: dlg.setDeleteDialogOpen,
    deleteTarget: dlg.deleteTarget,
    confirmDelete: dlg.confirmDelete,
    handleDeleteConfirm: handlers.handleDeleteConfirm,
    isDeletePending: mutations.deleteMutation.isPending,

    // Handlerji za tabelo
    handleSort,
    openNewCard: dlg.openNewCard,
    suspendCard: handlers.suspendCard,
    reactivateCard: handlers.reactivateCard,
  }
}
