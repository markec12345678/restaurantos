'use client'

import { useState, useCallback } from 'react'
import { type GiftCard } from './constants'

export function useGiftCardDialogOpen() {
  const [newCardDialogOpen, setNewCardDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [loadDialogOpen, setLoadDialogOpen] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const openNewCard = useCallback(() => { setNewCardDialogOpen(true) }, [])
  const openEdit = useCallback((_: GiftCard) => { setEditDialogOpen(true) }, [])
  const openLoad = useCallback((_: GiftCard) => { setLoadDialogOpen(true) }, [])
  const openHistory = useCallback((_: GiftCard) => { setHistoryDialogOpen(true) }, [])
  const confirmDelete = useCallback((_: GiftCard) => { setDeleteDialogOpen(true) }, [])

  return {
    newCardDialogOpen, setNewCardDialogOpen, openNewCard,
    editDialogOpen, setEditDialogOpen, openEdit,
    loadDialogOpen, setLoadDialogOpen, openLoad,
    historyDialogOpen, setHistoryDialogOpen, openHistory,
    deleteDialogOpen, setDeleteDialogOpen, confirmDelete,
  }
}
