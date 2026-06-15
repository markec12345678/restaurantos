'use client'

import { useCallback } from 'react'
import { useLocationState } from './useLocationState'
import { useLocationHandlers } from './useLocationHandlers'

export function useLocationManager() {
  const state = useLocationState()

  const handlers = useLocationHandlers(
    state.form, state.syncSource, state.locations, state.deleteConfirm, state.zoneForm,
    state.setDeleteConfirm, state.setShowForm, state.showForm,
    state.setShowSync, state.showSync,
    state.setShowZones, state.showZones,
    state.setSyncResult, state.setSyncing, state.setExpandedId, state.expandedId,
    state.resetForm,
    state.createMutation, state.toggleActiveMutation, state.deleteMutation,
    state.createZoneMutation, state.deleteZoneMutation,
  )

  const handleSyncSourceChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    state.setSyncSource(e.target.value)
  }, [state])

  const handleCloseSync = useCallback(() => {
    state.setShowSync(false); state.setSyncResult(null)
  }, [state])

  const handleDeleteDialogChange = useCallback((open: boolean) => {
    if (!open) state.setDeleteConfirm(null)
  }, [state])

  const handleFormTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    state.setForm(p => ({ ...p, type: e.target.value }))
  }, [state])

  const handleCancelForm = useCallback(() => {
    state.setShowForm(false); state.resetForm()
  }, [state])

  return {
    showForm: state.showForm, expandedId: state.expandedId,
    showSync: state.showSync, syncSource: state.syncSource,
    syncResult: state.syncResult, deleteConfirm: state.deleteConfirm,
    syncing: state.syncing, form: state.form, setForm: state.setForm,
    showZones: state.showZones, showZoneForm: state.showZoneForm,
    zoneForm: state.zoneForm, setZoneForm: state.setZoneForm,
    setShowZoneForm: state.setShowZoneForm,
    zonesData: state.zonesData, zonesLoading: state.zonesLoading,
    locations: state.locations, stats: state.stats, isLoading: state.isLoading,
    createPending: state.createMutation.isPending,
    handleToggleForm: handlers.handleToggleForm,
    handleToggleSync: handlers.handleToggleSync,
    handleToggleZones: handlers.handleToggleZones,
    handleSyncSourceChange, handleSync: handlers.handleSync,
    handleCloseSync, handleSubmit: handlers.handleSubmit,
    handleFormTypeChange, handleCancelForm,
    handleToggleLocationActive: handlers.handleToggleLocationActive,
    handleToggleExpanded: handlers.handleToggleExpanded,
    handleDeleteLocation: handlers.handleDeleteLocation,
    handleDeleteZone: handlers.handleDeleteZone,
    handleZoneFormSubmit: handlers.handleZoneFormSubmit,
    handleConfirmDelete: handlers.handleConfirmDelete,
    handleDeleteDialogChange,
  }
}
