'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import {
  CreditCard, Plus, Search, Eye, Pencil, Trash2, ArrowDownToLine,
  Calendar, User, Hash, Wallet, TrendingUp, CheckCircle2, XCircle,
  Clock, ArrowUpDown, History, Ban, RefreshCw, Gift,
} from 'lucide-react'
import { useState, useMemo } from 'react'

// ============================================
// TIPI
// ============================================

interface GiftCardTransaction {
  id: string
  giftCardId: string
  type: string
  amount: number
  balanceAfter: number
  orderId: string | null
  checkId: string | null
  note: string
  createdAt: string
}

interface GiftCard {
  id: string
  cardNumber: string
  balance: number
  initialBalance: number
  status: string
  ownerName: string
  purchasedAt: string
  expiresAt: string | null
  transactions: GiftCardTransaction[]
  createdAt: string
  updatedAt: string
}

// ============================================
// KONSTANTE
// ============================================

const statusConfig: Record<string, { label: string; color: string; bgColor: string; dotColor: string }> = {
  active: {
    label: 'Aktivna',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
  },
  depleted: {
    label: 'Porabljena',
    color: 'text-gray-700 dark:text-gray-400',
    bgColor: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    dotColor: 'bg-gray-500',
  },
  expired: {
    label: 'Potekla',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    dotColor: 'bg-red-500',
  },
  suspended: {
    label: 'Suspendirana',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    dotColor: 'bg-amber-500',
  },
}

const transactionTypeConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  load: {
    label: 'Naloži',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    icon: ArrowDownToLine,
  },
  redeem: {
    label: 'Unovči',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: Wallet,
  },
  adjust: {
    label: 'Prilagodi',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    icon: ArrowUpDown,
  },
  transfer: {
    label: 'Prenesi',
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    icon: RefreshCw,
  },
}

// ============================================
// POMOŽNE FUNKCIJE
// ============================================

function formatDateSI(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDateTimeSI(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCurrency(amount: number): string {
  return `€${amount.toFixed(2)}`
}

function generateCardNumber(): string {
  const prefix = 'GC'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp.slice(-4)}-${random}`
}

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export function GiftCardManager() {
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
    queryKey: ['gift-cards', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/gift-cards?${params}`)
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

  const totalCards = allCards.length
  const activeCards = allCards.filter((c) => c.status === 'active').length
  const totalBalanceOutstanding = allCards.reduce((sum, c) => sum + c.balance, 0)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const totalLoadedThisMonth = allCards.reduce((sum, c) => {
    const loadTx = (c.transactions || []).filter(
      (t) => t.type === 'load' && new Date(t.createdAt) >= monthStart
    )
    return sum + loadTx.reduce((s, t) => s + t.amount, 0)
  }, 0)

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
      const res = await fetch('/api/gift-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka pri ustvarjanju kartice')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Darilna kartica uspešno ustvarjena')
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] })
      setNewCardDialogOpen(false)
    },
    onError: () => {
      toast.error('Napaka pri ustvarjanju darilne kartice')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/gift-cards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka pri posodabljanju kartice')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Darilna kartica uspešno posodobljena')
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] })
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
      const res = await fetch(`/api/gift-cards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] })
      setLoadDialogOpen(false)
      setLoadTarget(null)
    },
    onError: () => {
      toast.error('Napaka pri nalaganju sredstev')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/gift-cards/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka pri brisanju kartice')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Darilna kartica uspešno izbrisana')
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] })
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

  const handleSort = (field: 'purchasedAt' | 'balance' | 'cardNumber') => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const openNewCard = () => {
    setNewCardForm({
      cardNumber: generateCardNumber(),
      ownerName: '',
      initialBalance: '',
      expiresAt: '',
    })
    setNewCardDialogOpen(true)
  }

  const handleCreateCard = () => {
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
  }

  const openEdit = (card: GiftCard) => {
    setEditTarget(card)
    setEditForm({
      status: card.status,
      expiresAt: card.expiresAt ? new Date(card.expiresAt).toISOString().split('T')[0] : '',
    })
    setEditDialogOpen(true)
  }

  const handleEditSave = () => {
    if (!editTarget) return
    updateMutation.mutate({
      id: editTarget.id,
      status: editForm.status,
      expiresAt: editForm.expiresAt || null,
    })
  }

  const openLoad = (card: GiftCard) => {
    setLoadTarget(card)
    setLoadForm({ amount: '', note: '' })
    setLoadDialogOpen(true)
  }

  const handleLoad = () => {
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
  }

  const openHistory = (card: GiftCard) => {
    setHistoryTarget(card)
    setHistoryDialogOpen(true)
  }

  const confirmDelete = (card: GiftCard) => {
    setDeleteTarget(card)
    setDeleteDialogOpen(true)
  }

  const suspendCard = (card: GiftCard) => {
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
  }

  const reactivateCard = (card: GiftCard) => {
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
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCards}</p>
              <p className="text-xs text-muted-foreground">Skupaj kartic</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{activeCards}</p>
              <p className="text-xs text-muted-foreground">Aktivne kartice</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{formatCurrency(totalBalanceOutstanding)}</p>
              <p className="text-xs text-muted-foreground">Stanje izdatka</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-teal-700 dark:text-teal-400">{formatCurrency(totalLoadedThisMonth)}</p>
              <p className="text-xs text-muted-foreground">Naloženo ta mesec</p>
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
              placeholder="Išči po številki kartice ali lastniku..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vsi statusi</SelectItem>
              <SelectItem value="active">Aktivna</SelectItem>
              <SelectItem value="depleted">Porabljena</SelectItem>
              <SelectItem value="expired">Potekla</SelectItem>
              <SelectItem value="suspended">Suspendirana</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openNewCard}>
            <Plus className="h-4 w-4 mr-2" />
            Nova kartica
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  // ============================================
  // RENDER: TABELA KARTIC
  // ============================================

  const renderSortIcon = (field: 'purchasedAt' | 'balance' | 'cardNumber') => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />
    return sortDir === 'asc' ? <ArrowUpDown className="h-3 w-3 ml-1 text-primary" /> : <ArrowUpDown className="h-3 w-3 ml-1 text-primary rotate-180" />
  }

  const renderCardsTable = () => (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('cardNumber')}
                >
                  <span className="flex items-center">Številka kartice {renderSortIcon('cardNumber')}</span>
                </TableHead>
                <TableHead>Lastnik</TableHead>
                <TableHead className="text-right">Začetno stanje</TableHead>
                <TableHead
                  className="text-right cursor-pointer select-none"
                  onClick={() => handleSort('balance')}
                >
                  <span className="flex items-center justify-end">Trenutno stanje {renderSortIcon('balance')}</span>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('purchasedAt')}
                >
                  <span className="flex items-center">Datum nakupa {renderSortIcon('purchasedAt')}</span>
                </TableHead>
                <TableHead>Datum poteka</TableHead>
                <TableHead className="text-right">Dejanja</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Gift className="h-10 w-10 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Ni darilnih kartic</p>
                      <p className="text-xs text-muted-foreground">
                        {search || statusFilter !== 'all'
                          ? 'Poskusite spremeniti filtre iskanja'
                          : 'Ustvarite novo darilno kartico za začetek'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCards.map((card) => {
                  const cfg = statusConfig[card.status] || statusConfig.active
                  return (
                    <TableRow key={card.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-mono text-sm font-medium">{card.cardNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{card.ownerName || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {formatCurrency(card.initialBalance)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-bold text-sm ${card.balance > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                          {formatCurrency(card.balance)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] px-2 py-0.5 ${cfg.bgColor}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotColor} mr-1.5`} />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDateSI(card.purchasedAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {card.expiresAt ? formatDateSI(card.expiresAt) : 'Brez roka'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Zgodovina transakcij"
                            onClick={() => openHistory(card)}
                          >
                            <History className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Naloži sredstva"
                            onClick={() => openLoad(card)}
                            disabled={card.status === 'suspended'}
                          >
                            <ArrowDownToLine className="h-3.5 w-3.5" />
                          </Button>
                          {card.status === 'active' ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-amber-600"
                              title="Suspendiraj"
                              onClick={() => suspendCard(card)}
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          ) : (card.status === 'suspended' || card.status === 'expired') ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-emerald-600"
                              title="Reaktiviraj"
                              onClick={() => reactivateCard(card)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Uredi"
                            onClick={() => openEdit(card)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            title="Izbriši"
                            onClick={() => confirmDelete(card)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {filteredCards.length > 0 && (
          <div className="border-t px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Prikazanih {filteredCards.length} od {allCards.length} kartic</span>
            {search && <span>Iskanje: &bdquo;{search}&ldquo;</span>}
          </div>
        )}
      </CardContent>
    </Card>
  )

  // ============================================
  // RENDER: DIJALOG ZA NOVO KARTICO
  // ============================================

  const renderNewCardDialog = () => (
    <Dialog open={newCardDialogOpen} onOpenChange={setNewCardDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Nova darilna kartica
          </DialogTitle>
          <DialogDescription>
            Ustvarite novo darilno kartico za stranko.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Številka kartice</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Samodejno generirano"
                value={newCardForm.cardNumber}
                onChange={(e) => setNewCardForm({ ...newCardForm, cardNumber: e.target.value })}
                className="font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                className="flex-shrink-0"
                title="Generiraj novo številko"
                onClick={() => setNewCardForm({ ...newCardForm, cardNumber: generateCardNumber() })}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Pustite prazno za samodejno generiranje</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Lastnik</Label>
            <Input
              placeholder="Ime in priimek lastnika"
              value={newCardForm.ownerName}
              onChange={(e) => setNewCardForm({ ...newCardForm, ownerName: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Začetno stanje (€) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={newCardForm.initialBalance}
              onChange={(e) => setNewCardForm({ ...newCardForm, initialBalance: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Datum poteka</Label>
            <Input
              type="date"
              value={newCardForm.expiresAt}
              onChange={(e) => setNewCardForm({ ...newCardForm, expiresAt: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Pustite prazno za kartico brez roka veljavnosti</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setNewCardDialogOpen(false)}>
            Prekliči
          </Button>
          <Button
            onClick={handleCreateCard}
            disabled={
              !newCardForm.initialBalance ||
              parseFloat(newCardForm.initialBalance) <= 0 ||
              createMutation.isPending
            }
          >
            {createMutation.isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Ustvarjam...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1.5" />
                Ustvari kartico
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // ============================================
  // RENDER: DIJALOG ZA UREJANJE KARTICE
  // ============================================

  const renderEditDialog = () => (
    <Dialog open={editDialogOpen} onOpenChange={(open) => { if (!open) { setEditTarget(null) } setEditDialogOpen(open) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Uredi darilno kartico
          </DialogTitle>
          <DialogDescription>
            Spremenite status ali podaljšajte veljavnost kartice {editTarget?.cardNumber}.
          </DialogDescription>
        </DialogHeader>

        {editTarget && (
          <div className="space-y-4">
            {/* Info o kartici */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Številka kartice:</span>
                <span className="font-mono font-medium">{editTarget.cardNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lastnik:</span>
                <span>{editTarget.ownerName || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trenutno stanje:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(editTarget.balance)}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(v) => setEditForm({ ...editForm, status: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Izberite status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${cfg.dotColor}`} />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Datum poteka</Label>
              <Input
                type="date"
                value={editForm.expiresAt}
                onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Pustite prazno za kartico brez roka veljavnosti</p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => { setEditDialogOpen(false); setEditTarget(null) }}>
            Prekliči
          </Button>
          <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Shranjujem...
              </>
            ) : (
              'Shrani spremembe'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // ============================================
  // RENDER: DIJALOG ZA NALAGANJE SREDSTEV
  // ============================================

  const renderLoadDialog = () => (
    <Dialog open={loadDialogOpen} onOpenChange={(open) => { if (!open) { setLoadTarget(null) } setLoadDialogOpen(open) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-primary" />
            Naloži sredstva
          </DialogTitle>
          <DialogDescription>
            Dodajte sredstva na kartico {loadTarget?.cardNumber}.
          </DialogDescription>
        </DialogHeader>

        {loadTarget && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Številka kartice:</span>
                <span className="font-mono font-medium">{loadTarget.cardNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lastnik:</span>
                <span>{loadTarget.ownerName || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trenutno stanje:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(loadTarget.balance)}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Znesek (€) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={loadForm.amount}
                onChange={(e) => setLoadForm({ ...loadForm, amount: e.target.value })}
                autoFocus
              />
            </div>

            {loadForm.amount && parseFloat(loadForm.amount) > 0 && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-700 dark:text-emerald-400">Novo stanje:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(loadTarget.balance + parseFloat(loadForm.amount))}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Opomba</Label>
              <Textarea
                placeholder="Opomba za transakcijo..."
                value={loadForm.note}
                onChange={(e) => setLoadForm({ ...loadForm, note: e.target.value })}
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => { setLoadDialogOpen(false); setLoadTarget(null) }}>
            Prekliči
          </Button>
          <Button
            onClick={handleLoad}
            disabled={
              !loadForm.amount ||
              parseFloat(loadForm.amount) <= 0 ||
              loadMutation.isPending
            }
          >
            {loadMutation.isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Nalagam...
              </>
            ) : (
              <>
                <ArrowDownToLine className="h-4 w-4 mr-1.5" />
                Naloži sredstva
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

  const renderHistoryDialog = () => (
    <Dialog open={historyDialogOpen} onOpenChange={(open) => { if (!open) { setHistoryTarget(null) } setHistoryDialogOpen(open) }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Zgodovina transakcij
          </DialogTitle>
          <DialogDescription>
            Transakcije za kartico {historyTarget?.cardNumber}
            {historyTarget?.ownerName ? ` — ${historyTarget.ownerName}` : ''}
          </DialogDescription>
        </DialogHeader>

        {historyTarget && (
          <div className="space-y-4 overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {/* Info o kartici */}
            <div className="rounded-lg bg-muted/50 p-3 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Trenutno stanje</p>
                <p className="font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(historyTarget.balance)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Začetno stanje</p>
                <p className="font-medium">{formatCurrency(historyTarget.initialBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge className={`text-[10px] px-2 py-0.5 ${(statusConfig[historyTarget.status] || statusConfig.active).bgColor}`}>
                  {(statusConfig[historyTarget.status] || statusConfig.active).label}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Seznam transakcij */}
            {(historyTarget.transactions || []).length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Ni transakcij</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(historyTarget.transactions || []).map((tx) => {
                  const txConfig = transactionTypeConfig[tx.type] || transactionTypeConfig.adjust
                  const TxIcon = txConfig.icon
                  return (
                    <div
                      key={tx.id}
                      className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 ${txConfig.bgColor}`}>
                        <TxIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge className={`text-[10px] px-1.5 py-0 ${txConfig.bgColor}`}>
                              {txConfig.label}
                            </Badge>
                            <span className={`font-bold text-sm ${tx.amount >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                              {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {formatDateTimeSI(tx.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>Stanje po: <span className="font-medium text-foreground">{formatCurrency(tx.balanceAfter)}</span></span>
                          {tx.note && <span className="truncate">Opomba: {tx.note}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )

  // ============================================
  // RENDER: DIJALOG ZA BRISANJE
  // ============================================

  const renderDeleteDialog = () => (
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Izbriši darilno kartico</AlertDialogTitle>
          <AlertDialogDescription>
            Ali ste prepričani, da želite izbrisati kartico
            <strong> &bdquo;{deleteTarget?.cardNumber}&ldquo;</strong>
            {deleteTarget?.ownerName ? ` (${deleteTarget.ownerName})` : ''}?
            {deleteTarget && deleteTarget.balance > 0 && (
              <span className="block mt-2 text-amber-600 dark:text-amber-400 font-medium">
                Opozorilo: Kartica ima še {formatCurrency(deleteTarget.balance)} stanja!
              </span>
            )}
            Tega dejanja ni mogoče razveljaviti.
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
      <Skeleton className="h-16" />
      <Skeleton className="h-64" />
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
            <h2 className="text-2xl font-bold">Darilne kartice</h2>
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
      {renderSummaryCards()}

      {/* Filtri */}
      {renderFilters()}

      {/* Tabela kartic */}
      {renderCardsTable()}

      {/* Dijalog za novo kartico */}
      {renderNewCardDialog()}

      {/* Dijalog za urejanje kartice */}
      {renderEditDialog()}

      {/* Dijalog za nalaganje sredstev */}
      {renderLoadDialog()}

      {/* Dijalog za zgodovino transakcij */}
      {renderHistoryDialog()}

      {/* Dijalog za brisanje */}
      {renderDeleteDialog()}
    </div>
  )
}
