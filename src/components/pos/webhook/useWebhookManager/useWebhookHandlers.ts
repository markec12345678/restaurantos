'use client'
// useWebhookManager — Handlerji in mutacije

import React, { useCallback } from 'react'
import { toast } from 'sonner'
import type { WebhookItem, FormData } from '../constants'
import { useWebhookMutations } from '../useWebhookMutations'

export function useWebhookHandlers(
  formData: FormData,
  editingItem: WebhookItem | null,
  setDialogOpen: (_open: boolean) => void,
  setEditingItem: (_item: WebhookItem | null) => void,
  setDeleteDialogOpen: (_open: boolean) => void,
  setDeleteTarget: (_item: WebhookItem | null) => void,
  setFormData: React.Dispatch<React.SetStateAction<FormData>>,
  deleteTarget: WebhookItem | null,
) {
  const {
    createMutation,
    updateMutation,
    deleteMutation,
  } = useWebhookMutations({
    onCloseDialog: () => setDialogOpen(false),
    onClearEditingItem: () => setEditingItem(null),
    onCloseDeleteDialog: () => setDeleteDialogOpen(false),
    onClearDeleteTarget: () => setDeleteTarget(null),
  })

  const openCreate = useCallback(() => {
    setEditingItem(null)
    setFormData({ name: '', url: '', events: [], secret: '', isActive: true })
    setDialogOpen(true)
  }, [setEditingItem, setFormData, setDialogOpen])

  const openEdit = useCallback((item: WebhookItem) => {
    setEditingItem(item)
    let parsedEvents: string[] = []
    try { parsedEvents = JSON.parse(item.events || '[]') } catch { parsedEvents = [] }
    setFormData({
      name: item.name,
      url: item.url,
      events: parsedEvents,
      secret: item.secret,
      isActive: item.isActive,
    })
    setDialogOpen(true)
  }, [setEditingItem, setFormData, setDialogOpen])

  const handleSubmit = useCallback(() => {
    if (!formData.name.trim()) { toast.error('Ime je obvezno'); return }
    if (!formData.url.trim()) { toast.error('URL je obvezen'); return }
    if (formData.events.length === 0) { toast.error('Izberite vsaj en dogodek'); return }

    const payload = {
      name: formData.name,
      url: formData.url,
      events: JSON.stringify(formData.events),
      secret: formData.secret,
      isActive: formData.isActive,
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }, [formData, editingItem, updateMutation, createMutation])

  const toggleEvent = useCallback((eventValue: string) => {
    setFormData((prev: FormData) => ({
      ...prev,
      events: prev.events.includes(eventValue)
        ? prev.events.filter(e => e !== eventValue)
        : [...prev.events, eventValue],
    }))
  }, [setFormData])

  // R167 (#143): testWebhook gumb odstranjen — klical je /api/webhooks/test, ki ne obstaja (404
  // od prvega dne); engine helper testWebhookDelivery prav tako izbrisan. Nov "testni webhook"
  // endpoint = ločen feature, ne cleanup.

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setEditingItem(null)
    setDialogOpen(open)
  }, [setEditingItem, setDialogOpen])

  const handleDeleteTarget = useCallback((item: WebhookItem) => {
    setDeleteTarget(item)
    setDeleteDialogOpen(true)
  }, [setDeleteTarget, setDeleteDialogOpen])

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
  }, [deleteTarget, deleteMutation])

  return {
    createMutation,
    updateMutation,
    openCreate,
    openEdit,
    handleSubmit,
    toggleEvent,
    handleDialogOpenChange,
    handleDeleteTarget,
    handleDeleteConfirm,
  }
}
