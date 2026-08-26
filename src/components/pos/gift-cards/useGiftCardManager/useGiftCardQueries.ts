'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type GiftCard } from '../constants'
import type { SortField, SortDir } from './useGiftCardFilters'

// ============================================
// Poizvedbe in izračuni za darilne kartice
// ============================================

export interface UseGiftCardQueriesParams {
  statusFilter: string
  search: string
  sortField: SortField
  sortDir: SortDir
}

export interface UseGiftCardQueriesReturn {
  isLoading: boolean
  allCards: GiftCard[]
  filteredCards: GiftCard[]
  summaryStats: {
    totalCards: number
    activeCards: number
    totalBalanceOutstanding: number
    totalLoadedThisMonth: number
  }
}

export function useGiftCardQueries({
  statusFilter,
  search,
  sortField,
  sortDir,
}: UseGiftCardQueriesParams): UseGiftCardQueriesReturn {
  const { data: giftCards, isLoading } = useQuery<GiftCard[]>({
    queryKey: [...queryKeys.giftCards.all, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await authFetch(`/api/gift-cards?${params}`)
      if (!res.ok) throw new Error('Napaka pri pridobivanju darilnih kartic')
      const data = await res.json(); return Array.isArray(data) ? data : (data.items || data.employees || data.jobs || data.shifts || data.entries || data.recipes || data.menuItems || data.transactions || data.suppliers || data.giftCards || data.locations || data.categories || data.menus || data.accounts || data.invoices || data.logs || data.haccpEntries || data.orders || data.payments || data.receipts || data.tables || data.loyaltyAccounts || [])
    },
  })

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

  return { isLoading, allCards, filteredCards, summaryStats }
}
