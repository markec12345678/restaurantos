'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { CreditCard, Plus } from 'lucide-react'
import { useState, useMemo, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type GiftCard, generateCardNumber } from './gift-cards/constants'

// Lazy-loaded podkomponente
const GiftCardSummaryCards = dynamic(() => import('./gift-cards/GiftCardSummaryCards').then(m => ({ default: m.GiftCardSummaryCards })), { ssr: false })
const GiftCardTable = dynamic(() => import('./gift-cards/GiftCardTable').then(m => ({ default: m.GiftCardTable })), { ssr: false })
const NewCardDialog = dynamic(() => import('./gift-cards/NewCardDialog').then(m => ({ default: m.NewCardDialog })), { ssr: false })
const EditCardDialog = dynamic(() => import('./gift-cards/EditCardDialog').then(m => ({ default: m.EditCardDialog })), { ssr: false })
const LoadFundsDialog = dynamic(() => import('./gift-cards/LoadFundsDialog').then(m => ({ default: m.LoadFundsDialog })), { ssr: false })
const TransactionHistoryDialog = dynamic(() => import('./gift-cards/TransactionHistoryDialog').then(m => ({ default: m.TransactionHistoryDialog })), { ssr: false })
const DeleteCardDialog = dynamic(() => import('./gift-cards/DeleteCardDialog').then(m => ({ default: m.DeleteCardDialog })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const GiftCardManager = memo(function GiftCardManager() {
  const queryClient = useQueryClient()

  // --- Stanja ---
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortField, setSortField] = useState<'purchasedAt' | 'balance' | 'cardNumber'>('purchasedAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // --- Dijalog za novo kartico ---
  const [newCardDialogOpen, setNewCardDialogOpen] = useState(false)
  const [newCardForm, setNewCardForm] = useState({
    cardNumber: '',
    ownerName: '',
    initialBalance: '',
    expiresAt: '',
  })

  // --- Dijalog za urejanje kartice ---
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<GiftCard | null>(null)
  const [editForm, setEditForm] = useState({
    status: 'active',
    expiresAt: '',
  })

  // --- Dijalog za nalaganje sredstev ---
  const [loadDialogOpen, setLoadDialogOpen] = useState(false)
  const [loadTarget, setLoadTarget] = useState<GiftCard | null>(null)
  const [loadForm, setLoadForm] = useState({
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

  const { totalCards, activeCards, totalBalanceOutstanding, totalLoadedThisMonth } = summaryStats

  // ============================================
  // MUTATIONS
  // ============================================

  const createMutation = useMutation({
    mutationFn: async (data: {
      cardNumber: string
      ownerName: string
      balance: number
      initialBalance: number
      expiresAt: string | null
    }) => {
      const res = await authFetch('/api/gift-cards', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka pri ustvarjanju kartice')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Darilna kartica uspešno ustvarjena')
      queryClient.invalidateQueries({ queryKey: queryKeys.giftCards.all })
      setNewCardDialogOpen(false)
    },
    onError: () => {
      toast.error('Napaka pri ustvarjanju darilne kartice')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/gift-cards/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka pri posodabljanju kartice')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Darilna kartica uspešno posodobljena')
      queryClient.invalidateQueries({ queryKey: queryKeys.giftCards.all })
      setEditDialogOpen(false)
      setEditTarget(null)
    },
    onError: () => {
      toast.error('Napaka pri posodabljanju darilne kartice')
    },
  })

  const loadMutation = useMutation({
    mutationFn: async ({ id, amount, note }: { id: string; amount: number; note: string }) => {
      const card = allCards.find((c) => c.id === id)
      const newBalance = (card?.balance || 0) + amount
      const res = await authFetch(`/api/gift-cards/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          balance: newBalance,
          status: newBalance > 0 && card?.status === 'depleted' ? 'active' : undefined,
          transaction: {
            type: 'load',
            amount,
            balanceAfter: newBalance,
            note: note || 'Nalaganje sredstev',
          },
        }),
      })
      if (!res.ok) throw new Error('Napaka pri nalaganju sredstev')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Sredstva uspešno naložena')
      queryClient.invalidateQueries({ queryKey: queryKeys.giftCards.all })
      setLoadDialogOpen(false)
      setLoadTarget(null)
    },
    onError: () => {
      toast.error('Napaka pri nalaganju sredstev')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/gift-cards/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka pri brisanju kartice')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Darilna kartica uspešno izbrisana')
      queryClient.invalidateQueries({ queryKey: queryKeys.giftCards.all })
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    },
    onError: () => {
      toast.error('Napaka pri brisanju darilne kartice')
    },
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

  // ============================================
  // RENDER: LOADING SKELETON
  // ============================================

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Darilne kartice</h2>
            <p className="text-muted-foreground">Nalaganje...</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={`sum-${i}`} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-16" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  // ============================================
  // GLAVNI RENDER
  // ============================================

  return (
    <div className="space-y-6 p-6">
      {/* Glava */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" />
            Darilne kartice
          </h2>
          <p className="text-muted-foreground">Upravljanje darilnih kartic in bonov</p>
        </div>
        <Button onClick={openNewCard}>
          <Plus className="h-4 w-4 mr-2" />
          Nova kartica
        </Button>
      </div>

      {/* Povzetek */}
      <GiftCardSummaryCards
        totalCards={totalCards}
        activeCards={activeCards}
        totalBalanceOutstanding={totalBalanceOutstanding}
        totalLoadedThisMonth={totalLoadedThisMonth}
      />

      {/* Filtri + Tabela kartic */}
      <GiftCardTable
        allCards={allCards}
        filteredCards={filteredCards}
        search={search}
        statusFilter={statusFilter}
        sortField={sortField}
        sortDir={sortDir}
        onSearchChange={setSearch}
        onStatusFilterChange={setStatusFilter}
        onSort={handleSort}
        onOpenNewCard={openNewCard}
        onOpenHistory={openHistory}
        onOpenLoad={openLoad}
        onOpenEdit={openEdit}
        onConfirmDelete={confirmDelete}
        onSuspendCard={suspendCard}
        onReactivateCard={reactivateCard}
      />

      {/* Dijalog za novo kartico */}
      <NewCardDialog
        open={newCardDialogOpen}
        onOpenChange={setNewCardDialogOpen}
        form={newCardForm}
        onFormChange={setNewCardForm}
        onSubmit={handleCreateCard}
        isPending={createMutation.isPending}
      />

      {/* Dijalog za urejanje kartice */}
      <EditCardDialog
        open={editDialogOpen}
        onOpenChange={handleEditDialogOpenChange}
        target={editTarget}
        form={editForm}
        onFormChange={setEditForm}
        onSubmit={handleEditSave}
        isPending={updateMutation.isPending}
      />

      {/* Dijalog za nalaganje sredstev */}
      <LoadFundsDialog
        open={loadDialogOpen}
        onOpenChange={handleLoadDialogOpenChange}
        target={loadTarget}
        form={loadForm}
        onFormChange={setLoadForm}
        onSubmit={handleLoad}
        isPending={loadMutation.isPending}
      />

      {/* Dijalog za zgodovino transakcij */}
      <TransactionHistoryDialog
        open={historyDialogOpen}
        onOpenChange={handleHistoryDialogOpenChange}
        target={historyTarget}
      />

      {/* Dijalog za brisanje */}
      <DeleteCardDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        target={deleteTarget}
        onConfirm={handleDeleteConfirm}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
})
