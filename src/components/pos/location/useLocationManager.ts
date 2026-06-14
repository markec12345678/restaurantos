'use client'

// ============================================
// CUSTOM HOOK ZA LOCATION MANAGER
// Izvleče poslovno logiko iz komponente
// ============================================

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import type { SyncResultRow, DeliveryZoneRow } from '@/lib/types'
import { queryKeys } from '@/lib/query-keys'
import { type LocationData, type DeleteConfirmState, type ZoneFormState, type LocationFormState, defaultLocationForm, defaultZoneForm } from './constants'
import { useLocationMutations } from './useLocationMutations'

export function useLocationManager() {
  const [showForm, setShowForm] = useState(false)
  const [_editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showSync, setShowSync] = useState(false)
  const [syncSource, setSyncSource] = useState<string>('')
  const [syncResult, setSyncResult] = useState<SyncResultRow | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null)
  const [syncing, setSyncing] = useState(false)

  const [form, setForm] = useState<LocationFormState>({ ...defaultLocationForm })

  // Cone dostave
  const [showZones, setShowZones] = useState(false)
  const [showZoneForm, setShowZoneForm] = useState(false)
  const [zoneForm, setZoneForm] = useState<ZoneFormState>({ ...defaultZoneForm })

  // ============================================
  // QUERIES
  // ============================================

  const { data: zonesData, isLoading: zonesLoading } = useQuery({
    queryKey: queryKeys.delivery.zones,
    queryFn: async () => {
      const res = await authFetch('/api/delivery-zones')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
    enabled: showZones,
  })

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.locations.all,
    queryFn: async () => {
      const res = await authFetch('/api/locations')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })

  const locations: LocationData[] = data?.locations || []
  const stats = data?.stats || { total: 0, active: 0, open: 0 }

  // ============================================
  // MUTATIONS (podedovane iz pod-hooka)
  // ============================================

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

  // ============================================
  // HANDLERJI
  // ============================================

  const handleSubmit = useCallback(() => {
    const payload = {
      ...form,
      latitude: form.latitude ? parseFloat(form.latitude) : undefined,
      longitude: form.longitude ? parseFloat(form.longitude) : undefined,
    }
    createMutation.mutate(payload)
  }, [form, createMutation])

  const handleToggleForm = useCallback(() => {
    setShowForm(prev => !prev)
    resetForm()
  }, [resetForm])

  const handleToggleSync = useCallback(() => {
    setShowSync(prev => !prev)
  }, [])

  const handleToggleZones = useCallback(() => {
    setShowZones(prev => !prev)
  }, [])

  const handleSyncSourceChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSyncSource(e.target.value)
  }, [])

  const handleSync = useCallback(async () => {
    if (!syncSource) return
    setSyncing(true)
    setSyncResult(null)
    try {
      const targetIds = locations.filter(l => l.id !== syncSource).map(l => l.id)
      const res = await authFetch('/api/locations/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceLocationId: syncSource,
          targetLocationIds: targetIds,
          syncMenuStructure: true,
          syncItems: true,
          syncPricing: false,
          syncModifiers: true,
          dryRun: false,
        }),
      })
      const syncData = await res.json()
      setSyncResult(syncData)
    } catch {
      setSyncResult({ success: false, error: 'Napaka pri sinhronizaciji' })
    } finally {
      setSyncing(false)
    }
  }, [syncSource, locations])

  const handleCloseSync = useCallback(() => {
    setShowSync(false)
    setSyncResult(null)
  }, [])

  const handleDeleteZone = useCallback((zone: DeliveryZoneRow) => {
    setDeleteConfirm({ type: 'zone', id: zone.id, name: zone.name })
  }, [])

  const handleZoneFormSubmit = useCallback(() => {
    createZoneMutation.mutate({
      name: zoneForm.name,
      postCodes: JSON.stringify(zoneForm.postCodes.split(',').map(s => s.trim()).filter(Boolean)),
      cities: JSON.stringify(zoneForm.cities.split(',').map(s => s.trim()).filter(Boolean)),
      deliveryFee: parseFloat(zoneForm.deliveryFee) || 2.50,
      minOrderAmount: parseFloat(zoneForm.minOrderAmount) || 10.00,
      freeDeliveryAbove: parseFloat(zoneForm.freeDeliveryAbove) || 0,
      estimatedMinutes: parseInt(zoneForm.estimatedMinutes) || 30,
      locationId: zoneForm.locationId || null,
    })
  }, [zoneForm, createZoneMutation])

  const handleToggleLocationActive = useCallback((loc: LocationData) => {
    toggleActiveMutation.mutate({ id: loc.id, isActive: !loc.isActive })
  }, [toggleActiveMutation])

  const handleToggleExpanded = useCallback((locId: string) => {
    setExpandedId(prev => prev === locId ? null : locId)
  }, [])

  const handleDeleteLocation = useCallback((loc: LocationData) => {
    setDeleteConfirm({ type: 'location', id: loc.id, name: loc.name })
  }, [])

  const handleConfirmDelete = useCallback(() => {
    if (deleteConfirm) {
      if (deleteConfirm.type === 'zone') deleteZoneMutation.mutate(deleteConfirm.id)
      else deleteMutation.mutate(deleteConfirm.id)
    }
    setDeleteConfirm(null)
  }, [deleteConfirm, deleteZoneMutation, deleteMutation])

  const handleDeleteDialogChange = useCallback((open: boolean) => {
    if (!open) setDeleteConfirm(null)
  }, [])

  const handleFormTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm(p => ({ ...p, type: e.target.value }))
  }, [])

  const handleCancelForm = useCallback(() => {
    setShowForm(false)
    resetForm()
  }, [resetForm])

  return {
    // Stanja
    showForm,
    expandedId,
    showSync,
    syncSource,
    syncResult,
    deleteConfirm,
    syncing,
    form,
    setForm,
    showZones,
    showZoneForm,
    zoneForm,
    setZoneForm,
    setShowZoneForm,
    zonesData,
    zonesLoading,
    locations,
    stats,
    isLoading,
    createPending: createMutation.isPending,
    // Handlerji
    handleToggleForm,
    handleToggleSync,
    handleToggleZones,
    handleSyncSourceChange,
    handleSync,
    handleCloseSync,
    handleSubmit,
    handleFormTypeChange,
    handleCancelForm,
    handleToggleLocationActive,
    handleToggleExpanded,
    handleDeleteLocation,
    handleDeleteZone,
    handleZoneFormSubmit,
    handleConfirmDelete,
    handleDeleteDialogChange,
  }
}
