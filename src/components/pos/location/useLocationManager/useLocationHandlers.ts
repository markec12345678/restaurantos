'use client'

import { useCallback } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import type { DeliveryZoneRow } from '@/lib/types'
import { type LocationData, type DeleteConfirmState } from '../constants'

export function useLocationHandlers(
  form: import('../constants').LocationFormState,
  syncSource: string,
  locations: LocationData[],
  deleteConfirm: DeleteConfirmState | null,
  zoneForm: import('../constants').ZoneFormState,
  setDeleteConfirm: (_confirm: DeleteConfirmState | null) => void,
  setShowForm: (_show: boolean) => void,
  showForm: boolean,
  setShowSync: (_show: boolean) => void,
  showSync: boolean,
  setShowZones: (_show: boolean) => void,
  showZones: boolean,
  setSyncResult: (_result: import('@/lib/types').SyncResultRow | null) => void,
  setSyncing: (_syncing: boolean) => void,
  setExpandedId: (_id: string | null) => void,
  expandedId: string | null,
  resetForm: () => void,
  createMutation: { mutate: (_data: import('@/lib/types').LocationFormRow) => void },
  toggleActiveMutation: { mutate: (_data: { id: string; isActive: boolean }) => void },
  deleteMutation: { mutate: (_id: string) => void },
  createZoneMutation: { mutate: (_data: import('@/lib/types').DeliveryZoneFormRow) => void },
  deleteZoneMutation: { mutate: (_id: string) => void },
) {
  const handleSubmit = useCallback(() => {
    const payload = {
      ...form,
      latitude: form.latitude ? parseFloat(form.latitude) : undefined,
      longitude: form.longitude ? parseFloat(form.longitude) : undefined,
    }
    createMutation.mutate(payload)
  }, [form, createMutation])

  const handleToggleForm = useCallback(() => {
    setShowForm(!showForm)
    resetForm()
  }, [resetForm, setShowForm, showForm])

  const handleToggleSync = useCallback(() => {
    setShowSync(!showSync)
  }, [setShowSync, showSync])

  const handleToggleZones = useCallback(() => {
    setShowZones(!showZones)
  }, [setShowZones, showZones])

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
          sourceLocationId: syncSource, targetLocationIds: targetIds,
          syncMenuStructure: true, syncItems: true, syncPricing: false, syncModifiers: true, dryRun: false,
        }),
      })
      const syncData = await res.json()
      setSyncResult(syncData)
    } catch {
      setSyncResult({ success: false, error: 'Napaka pri sinhronizaciji' })
    } finally {
      setSyncing(false)
    }
  }, [syncSource, locations, setSyncing, setSyncResult])

  const handleDeleteZone = useCallback((zone: DeliveryZoneRow) => {
    setDeleteConfirm({ type: 'zone', id: zone.id, name: zone.name })
  }, [setDeleteConfirm])

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
    setExpandedId(expandedId === locId ? null : locId)
  }, [setExpandedId, expandedId])

  const handleDeleteLocation = useCallback((loc: LocationData) => {
    setDeleteConfirm({ type: 'location', id: loc.id, name: loc.name })
  }, [setDeleteConfirm])

  const handleConfirmDelete = useCallback(() => {
    if (deleteConfirm) {
      if (deleteConfirm.type === 'zone') deleteZoneMutation.mutate(deleteConfirm.id)
      else deleteMutation.mutate(deleteConfirm.id)
    }
    setDeleteConfirm(null)
  }, [deleteConfirm, deleteZoneMutation, deleteMutation, setDeleteConfirm])

  return {
    handleSubmit, handleToggleForm, handleToggleSync, handleToggleZones,
    handleSync, handleDeleteZone, handleZoneFormSubmit,
    handleToggleLocationActive, handleToggleExpanded, handleDeleteLocation,
    handleConfirmDelete,
  }
}
