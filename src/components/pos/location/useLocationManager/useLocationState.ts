'use client'

import { useState, useCallback } from 'react'
import type { SyncResultRow } from '@/lib/types'
import { type DeleteConfirmState, type ZoneFormState, type LocationFormState, defaultLocationForm, defaultZoneForm } from '../constants'
import { useLocationMutations } from '../useLocationMutations'
import { useLocationQueries } from './useLocationQueries'

export function useLocationState() {
  const [showForm, setShowForm] = useState(false)
  const [_editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showSync, setShowSync] = useState(false)
  const [syncSource, setSyncSource] = useState<string>('')
  const [syncResult, setSyncResult] = useState<SyncResultRow | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null)
  const [syncing, setSyncing] = useState(false)

  const [form, setForm] = useState<LocationFormState>({ ...defaultLocationForm })

  const [showZones, setShowZones] = useState(false)
  const [showZoneForm, setShowZoneForm] = useState(false)
  const [zoneForm, setZoneForm] = useState<ZoneFormState>({ ...defaultZoneForm })

  const queries = useLocationQueries(showZones)

  const resetForm = useCallback(() => {
    setForm({ ...defaultLocationForm })
    setEditingId(null)
  }, [])

  const resetZoneForm = useCallback(() => {
    setZoneForm({ ...defaultZoneForm })
  }, [])

  const { createMutation, toggleActiveMutation, deleteMutation, createZoneMutation, deleteZoneMutation } = useLocationMutations({
    onHideForm: () => setShowForm(false),
    onResetForm: resetForm,
    onHideZoneForm: () => setShowZoneForm(false),
    onResetZoneForm: resetZoneForm,
  })

  return {
    showForm, setShowForm, expandedId, setExpandedId,
    showSync, setShowSync, syncSource, setSyncSource,
    syncResult, setSyncResult, deleteConfirm, setDeleteConfirm,
    syncing, setSyncing, form, setForm,
    showZones, setShowZones, showZoneForm, setShowZoneForm,
    zoneForm, setZoneForm, resetForm, resetZoneForm,
    ...queries,
    createMutation, toggleActiveMutation, deleteMutation, createZoneMutation, deleteZoneMutation,
  }
}
