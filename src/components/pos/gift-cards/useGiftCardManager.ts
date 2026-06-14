'use client'

import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useState, useMemo, useCallback } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type GiftCard, generateCardNumber } from './constants'
import { useGiftCardMutations } from './useGiftCardMutations'

// --- Tipi obrazcev ---

interface NewCardForm {
  cardNumber: string
  ownerName: string
  initialBalance: string
  expiresAt: string
}

interface EditCardForm {
  status: string
  expiresAt: string
}

interface LoadFundsForm {
  amount: string
  note: string
}

// --- Hook ---

export function useGiftCardManager() {
  // --- Stanja ---
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortField, setSortField] = useState<'purchasedAt' | 'balance' | 'cardNumber'>('purchasedAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // --- Dijalog za novo kartico ---
  const [newCardDialogOpen, setNewCardDialogOpen] = useState(false)
  const [newCardForm, setNewCardForm] = useState<NewCardForm>({
    cardNumber: '',
    ownerName: '',
    initialBalance: '',
    expiresAt: '',
  })

  // --- Dijalog za urejanje kartice ---
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<GiftCard | null>(null)
  const [editForm, setEditForm] = useState<EditCardForm>({
    status: 'active',
    expiresAt: '',
  })

  // --- Dijalog za nalaganje sredstev ---
  const [loadDialogOpen, setLoadDialogOpen] = useState(false)
  const [loadTarget, setLoadTarget] = useState<GiftCard | null>(null)
  const [loadForm, setLoadForm] = useState<LoadFundsForm>({
    amount: '',
    note: '',
  })

  // --- Dijalog za zgodovino transakcij ---
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [historyTarget, setHistoryTarget] = useState<GiftCard | null>(null)

  // --- Dijalog za brisanje ---
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<GiftCard | null>(null)

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

    // Iskanje po številki kartice ali imenu lastnika
    if (search.trim()) {
      const q = search.toLowerCase()
      cards = cards.filter(
        (c) =>
          c.cardNumber.toLowerCase().includes(q) ||
          c.ownerName.toLowerCase().includes(q)
      )
    }

    // Sortiranje
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
  // MUTATIONS (iz useGiftCardMutations)
  // ============================================

  const { createMutation, updateMutation, loadMutation, deleteMutation } = useGiftCardMutations({
    allCards,
    setNewCardDialogOpen,
    setEditDialogOpen,
    setEditTarget,
    setLoadDialogOpen,
    setLoadTarget,
    setDeleteDialogOpen,
    setDeleteTarget,
  })

  // ============================================
  // HANDLERJI
  // ============================================

  const handleSort = useCallback((field: 'purchasedAt' | 'balance' | 'cardNumber') => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }, [sortField, sortDir])

  const openNewCard = useCallback(() => {
    setNewCardForm({
      cardNumber: generateCardNumber(),
      ownerName: '',
      initialBalance: '',
      expiresAt: '',
    })
    setNewCardDialogOpen(true)
  }, [])

  const handleCreateCard = useCallback(() => {
    if (!newCardForm.initialBalance || parseFloat(newCardForm.initialBalance) <= 0) {
      toast.error('Začetni znesek mora biti večji od 0')
      return
    }
    createMutation.mutate({
      cardNumber: newCardForm.cardNumber || generateCardNumber(),
      ownerName: newCardForm.ownerName,
      balance: parseFloat(newCardForm.initialBalance),
      initialBalance: parseFloat(newCardForm.initialBalance),
      expiresAt: newCardForm.expiresAt || null,
    })
  }, [newCardForm, createMutation])

  const openEdit = useCallback((card: GiftCard) => {
    setEditTarget(card)
    setEditForm({
      status: card.status,
      expiresAt: card.expiresAt ? new Date(card.expiresAt).toISOString().split('T')[0] : '',
    })
    setEditDialogOpen(true)
  }, [])

  const handleEditSave = useCallback(() => {
    if (!editTarget) return
    updateMutation.mutate({
      id: editTarget.id,
      status: editForm.status,
      expiresAt: editForm.expiresAt || null,
    })
  }, [editTarget, editForm, updateMutation])

  const openLoad = useCallback((card: GiftCard) => {
    setLoadTarget(card)
    setLoadForm({ amount: '', note: '' })
    setLoadDialogOpen(true)
  }, [])

  const handleLoad = useCallback(() => {
    if (!loadTarget) return
    const amount = parseFloat(loadForm.amount)
    if (!amount || amount <= 0) {
      toast.error('Znesek mora biti večji od 0')
      return
    }
    loadMutation.mutate({
      id: loadTarget.id,
      amount,
      note: loadForm.note,
    })
  }, [loadTarget, loadForm, loadMutation])

  const openHistory = useCallback((card: GiftCard) => {
    setHistoryTarget(card)
    setHistoryDialogOpen(true)
  }, [])

  const confirmDelete = useCallback((card: GiftCard) => {
    setDeleteTarget(card)
    setDeleteDialogOpen(true)
  }, [])

  const suspendCard = useCallback((card: GiftCard) => {
    updateMutation.mutate({
      id: card.id,
      status: 'suspended',
      transaction: {
        type: 'adjust',
        amount: 0,
        balanceAfter: card.balance,
        note: 'Kartica suspendirana',
      },
    })
  }, [updateMutation])

  const reactivateCard = useCallback((card: GiftCard) => {
    if (card.balance <= 0) {
      updateMutation.mutate({
        id: card.id,
        status: 'depleted',
        transaction: {
          type: 'adjust',
          amount: 0,
          balanceAfter: card.balance,
          note: 'Kartica reaktivirana (brez sredstev)',
        },
      })
    } else {
      updateMutation.mutate({
        id: card.id,
        status: 'active',
        transaction: {
          type: 'adjust',
          amount: 0,
          balanceAfter: card.balance,
          note: 'Kartica reaktivirana',
        },
      })
    }
  }, [updateMutation])

  // --- Pomožni handlerji za dijaloge ---

  const handleEditDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setEditTarget(null)
    }
    setEditDialogOpen(open)
  }, [])

  const handleLoadDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setLoadTarget(null)
    }
    setLoadDialogOpen(open)
  }, [])

  const handleHistoryDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setHistoryTarget(null)
    }
    setHistoryDialogOpen(open)
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id)
    }
  }, [deleteTarget, deleteMutation])

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
    newCardDialogOpen,
    setNewCardDialogOpen,
    newCardForm,
    setNewCardForm,
    handleCreateCard,
    isCreatePending: createMutation.isPending,

    // Dijalog za urejanje
    editDialogOpen,
    handleEditDialogOpenChange,
    editTarget,
    editForm,
    setEditForm,
    handleEditSave,
    isUpdatePending: updateMutation.isPending,

    // Dijalog za nalaganje
    loadDialogOpen,
    handleLoadDialogOpenChange,
    loadTarget,
    loadForm,
    setLoadForm,
    handleLoad,
    isLoadPending: loadMutation.isPending,

    // Dijalog za zgodovino
    historyDialogOpen,
    handleHistoryDialogOpenChange,
    historyTarget,

    // Dijalog za brisanje
    deleteDialogOpen,
    setDeleteDialogOpen,
    deleteTarget,
    handleDeleteConfirm,
    isDeletePending: deleteMutation.isPending,

    // Handlerji za tabelo
    handleSort,
    openNewCard,
    openEdit,
    openLoad,
    openHistory,
    confirmDelete,
    suspendCard,
    reactivateCard,
  }
}
