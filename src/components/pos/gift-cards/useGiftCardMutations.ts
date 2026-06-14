'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type GiftCard } from './constants'

// ============================================
// TIPI
// ============================================
export interface GiftCardMutationsProps {
  allCards: GiftCard[]
  setNewCardDialogOpen: (_open: boolean) => void
  setEditDialogOpen: (_open: boolean) => void
  setEditTarget: (_card: GiftCard | null) => void
  setLoadDialogOpen: (_open: boolean) => void
  setLoadTarget: (_card: GiftCard | null) => void
  setDeleteDialogOpen: (_open: boolean) => void
  setDeleteTarget: (_card: GiftCard | null) => void
}

// ============================================
// MUTACIJE ZA DARILNE KARTICE
// ============================================
export function useGiftCardMutations({
  allCards,
  setNewCardDialogOpen,
  setEditDialogOpen,
  setEditTarget,
  setLoadDialogOpen,
  setLoadTarget,
  setDeleteDialogOpen,
  setDeleteTarget,
}: GiftCardMutationsProps) {
  const queryClient = useQueryClient()

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

  return {
    createMutation,
    updateMutation,
    loadMutation,
    deleteMutation,
  }
}
