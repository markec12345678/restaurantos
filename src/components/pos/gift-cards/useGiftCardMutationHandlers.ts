'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { type GiftCard, generateCardNumber } from './constants'

// ============================================
// TIPI za mutacije in dialog stanje
// ============================================

interface DialogState {
  newCardForm: { cardNumber: string; ownerName: string; initialBalance: string; expiresAt: string }
  editTarget: GiftCard | null
  editForm: { status: string; expiresAt: string }
  loadTarget: GiftCard | null
  loadForm: { amount: string; note: string }
  deleteTarget: GiftCard | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MutateFn = (_variables: any) => void

interface MutationFns {
  createMutate: MutateFn
  updateMutate: MutateFn
  loadMutate: MutateFn
  deleteMutate: MutateFn
}

// ============================================
// HOOK: Handlerji za mutacije darilnih kartic
// Ločeno od useGiftCardManager za boljšo berljivost
// ============================================

export function useGiftCardMutationHandlers(
  dlg: DialogState,
  mutations: MutationFns,
) {
  const { createMutate, updateMutate, loadMutate, deleteMutate } = mutations

  const handleCreateCard = useCallback(() => {
    if (!dlg.newCardForm.initialBalance || parseFloat(dlg.newCardForm.initialBalance) <= 0) {
      toast.error('Začetni znesek mora biti večji od 0')
      return
    }
    createMutate({
      cardNumber: dlg.newCardForm.cardNumber || generateCardNumber(),
      ownerName: dlg.newCardForm.ownerName,
      balance: parseFloat(dlg.newCardForm.initialBalance),
      initialBalance: parseFloat(dlg.newCardForm.initialBalance),
      expiresAt: dlg.newCardForm.expiresAt || null,
    })
  }, [dlg.newCardForm, createMutate])

  const handleEditSave = useCallback(() => {
    if (!dlg.editTarget) return
    updateMutate({
      id: dlg.editTarget.id,
      status: dlg.editForm.status,
      expiresAt: dlg.editForm.expiresAt || null,
    })
  }, [dlg.editTarget, dlg.editForm, updateMutate])

  const handleLoad = useCallback(() => {
    if (!dlg.loadTarget) return
    const amount = parseFloat(dlg.loadForm.amount)
    if (!amount || amount <= 0) {
      toast.error('Znesek mora biti večji od 0')
      return
    }
    loadMutate({
      id: dlg.loadTarget.id,
      amount,
      note: dlg.loadForm.note,
    })
  }, [dlg.loadTarget, dlg.loadForm, loadMutate])

  const handleDeleteConfirm = useCallback(() => {
    if (dlg.deleteTarget) {
      deleteMutate(dlg.deleteTarget.id)
    }
  }, [dlg.deleteTarget, deleteMutate])

  const suspendCard = useCallback((card: GiftCard) => {
    updateMutate({
      id: card.id,
      status: 'suspended',
      transaction: {
        type: 'adjust',
        amount: 0,
        balanceAfter: card.balance,
        note: 'Kartica suspendirana',
      },
    })
  }, [updateMutate])

  const reactivateCard = useCallback((card: GiftCard) => {
    if (card.balance <= 0) {
      updateMutate({
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
      updateMutate({
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
  }, [updateMutate])

  return {
    handleCreateCard,
    handleEditSave,
    handleLoad,
    handleDeleteConfirm,
    suspendCard,
    reactivateCard,
  }
}
