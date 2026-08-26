'use client'

import { useState, useCallback } from 'react'
import { type GiftCard, generateCardNumber } from './constants'
import { useGiftCardDialogOpen } from './useGiftCardDialogOpen'

export interface NewCardForm {
  cardNumber: string
  ownerName: string
  initialBalance: string
  expiresAt: string
}

export interface EditCardForm {
  status: string
  expiresAt: string
}

export interface LoadFundsForm {
  amount: string
  note: string
}

export function useGiftCardDialogs() {
  const dialogOpen = useGiftCardDialogOpen()

  const [newCardForm, setNewCardForm] = useState<NewCardForm>({
    cardNumber: '', ownerName: '', initialBalance: '', expiresAt: '',
  })
  const [editTarget, setEditTarget] = useState<GiftCard | null>(null)
  const [editForm, setEditForm] = useState<EditCardForm>({ status: 'active', expiresAt: '' })
  const [loadTarget, setLoadTarget] = useState<GiftCard | null>(null)
  const [loadForm, setLoadForm] = useState<LoadFundsForm>({ amount: '', note: '' })
  const [historyTarget, setHistoryTarget] = useState<GiftCard | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GiftCard | null>(null)

  const handleEditDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setEditTarget(null)
    dialogOpen.setEditDialogOpen(open)
  }, [dialogOpen])

  const handleLoadDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setLoadTarget(null)
    dialogOpen.setLoadDialogOpen(open)
  }, [dialogOpen])

  const handleHistoryDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setHistoryTarget(null)
    dialogOpen.setHistoryDialogOpen(open)
  }, [dialogOpen])

  const openNewCard = useCallback(() => {
    setNewCardForm({ cardNumber: generateCardNumber(), ownerName: '', initialBalance: '', expiresAt: '' })
    dialogOpen.setNewCardDialogOpen(true)
  }, [dialogOpen])

  const openEdit = useCallback((card: GiftCard) => {
    setEditTarget(card)
    setEditForm({ status: card.status, expiresAt: card.expiresAt ? new Date(card.expiresAt).toISOString().split('T')[0] : '' })
    dialogOpen.setEditDialogOpen(true)
  }, [dialogOpen])

  const openLoad = useCallback((card: GiftCard) => {
    setLoadTarget(card)
    setLoadForm({ amount: '', note: '' })
    dialogOpen.setLoadDialogOpen(true)
  }, [dialogOpen])

  const openHistory = useCallback((card: GiftCard) => {
    setHistoryTarget(card)
    dialogOpen.setHistoryDialogOpen(true)
  }, [dialogOpen])

  const confirmDelete = useCallback((card: GiftCard) => {
    setDeleteTarget(card)
    dialogOpen.setDeleteDialogOpen(true)
  }, [dialogOpen])

  return {
    newCardDialogOpen: dialogOpen.newCardDialogOpen,
    setNewCardDialogOpen: dialogOpen.setNewCardDialogOpen,
    newCardForm, setNewCardForm, openNewCard,
    editDialogOpen: dialogOpen.editDialogOpen,
    setEditDialogOpen: dialogOpen.setEditDialogOpen,
    setEditTarget, editTarget, editForm, setEditForm,
    handleEditDialogOpenChange, openEdit,
    loadDialogOpen: dialogOpen.loadDialogOpen,
    setLoadDialogOpen: dialogOpen.setLoadDialogOpen,
    setLoadTarget, loadTarget, loadForm, setLoadForm,
    handleLoadDialogOpenChange, openLoad,
    historyDialogOpen: dialogOpen.historyDialogOpen,
    historyTarget, handleHistoryDialogOpenChange, openHistory,
    deleteDialogOpen: dialogOpen.deleteDialogOpen,
    setDeleteDialogOpen: dialogOpen.setDeleteDialogOpen,
    setDeleteTarget, deleteTarget, confirmDelete,
  }
}
