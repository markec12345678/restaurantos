'use client'

// ============================================
// HOOK: Stanje dijalogov darilnih kartic
// Upravlja samo dialog state (odpiranje/zapiranje, obrazci, tarče)
// Brez mutacij — handlerji, ki kličejo mutate(), so v starševskem hooku
// ============================================

import { useState, useCallback } from 'react'
import { type GiftCard, generateCardNumber } from './constants'

// --- Tipi obrazcev ---

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

// ============================================
// HOOK
// ============================================

export function useGiftCardDialogs() {
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

  // --- onOpenChange handlerji ---

  const handleEditDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setEditTarget(null)
    setEditDialogOpen(open)
  }, [])

  const handleLoadDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setLoadTarget(null)
    setLoadDialogOpen(open)
  }, [])

  const handleHistoryDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setHistoryTarget(null)
    setHistoryDialogOpen(open)
  }, [])

  // --- open handlerji ---

  const openNewCard = useCallback(() => {
    setNewCardForm({
      cardNumber: generateCardNumber(),
      ownerName: '',
      initialBalance: '',
      expiresAt: '',
    })
    setNewCardDialogOpen(true)
  }, [])

  const openEdit = useCallback((card: GiftCard) => {
    setEditTarget(card)
    setEditForm({
      status: card.status,
      expiresAt: card.expiresAt ? new Date(card.expiresAt).toISOString().split('T')[0] : '',
    })
    setEditDialogOpen(true)
  }, [])

  const openLoad = useCallback((card: GiftCard) => {
    setLoadTarget(card)
    setLoadForm({ amount: '', note: '' })
    setLoadDialogOpen(true)
  }, [])

  const openHistory = useCallback((card: GiftCard) => {
    setHistoryTarget(card)
    setHistoryDialogOpen(true)
  }, [])

  const confirmDelete = useCallback((card: GiftCard) => {
    setDeleteTarget(card)
    setDeleteDialogOpen(true)
  }, [])

  return {
    // Nova kartica
    newCardDialogOpen,
    setNewCardDialogOpen,
    newCardForm,
    setNewCardForm,
    openNewCard,
    // Urejanje
    editDialogOpen,
    setEditDialogOpen,
    setEditTarget,
    editTarget,
    editForm,
    setEditForm,
    handleEditDialogOpenChange,
    openEdit,
    // Nalaganje
    loadDialogOpen,
    setLoadDialogOpen,
    setLoadTarget,
    loadTarget,
    loadForm,
    setLoadForm,
    handleLoadDialogOpenChange,
    openLoad,
    // Zgodovina
    historyDialogOpen,
    historyTarget,
    handleHistoryDialogOpenChange,
    openHistory,
    // Brisanje
    deleteDialogOpen,
    setDeleteDialogOpen,
    setDeleteTarget,
    deleteTarget,
    confirmDelete,
  }
}
