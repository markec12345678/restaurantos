'use client'

import { useState, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, Plus, Navigation } from 'lucide-react'
import { authFetch } from '@/components/pos/PinLogin'
import type { SyncResultRow, DeliveryZoneFormRow, LocationFormRow, DeliveryZoneRow } from '@/lib/types'
import { queryKeys } from '@/lib/query-keys'
import type { LocationData, DeleteConfirmState, LocationFormState, ZoneFormState } from './location/constants'
import { defaultLocationForm, defaultZoneForm } from './location/constants'

// Lenčasično nalaganje podkomponent — izboljša začetni čas nalaganja
const LocationStats = dynamic(() => import('./location/LocationStats').then(m => m.LocationStats), { ssr: false })
const MenuSyncSection = dynamic(() => import('./location/MenuSyncSection').then(m => m.MenuSyncSection), { ssr: false })
const DeliveryZonesSection = dynamic(() => import('./location/DeliveryZonesSection').then(m => m.DeliveryZonesSection), { ssr: false })
const LocationForm = dynamic(() => import('./location/LocationForm').then(m => m.LocationForm), { ssr: false })
const LocationsList = dynamic(() => import('./location/LocationsList').then(m => m.LocationsList), { ssr: false })
const DeleteDialog = dynamic(() => import('./location/DeleteDialog').then(m => m.DeleteDialog), { ssr: false })

export const LocationManager = memo(function LocationManager() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [_editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showSync, setShowSync] = useState(false)
  const [syncSource, setSyncSource] = useState<string>('')
  const [syncResult, setSyncResult] = useState<SyncResultRow | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null)
  const [syncing, setSyncing] = useState(false)

  const [form, setForm] = useState<LocationFormState>(defaultLocationForm)

  // Cone dostave
  const [showZones, setShowZones] = useState(false)
  const [showZoneForm, setShowZoneForm] = useState(false)
  const [zoneForm, setZoneForm] = useState<ZoneFormState>(defaultZoneForm)

  // Pridobivanje con dostave
  const { data: zonesData, isLoading: zonesLoading } = useQuery({
    queryKey: queryKeys.delivery.zones,
    queryFn: async () => {
      const res = await authFetch('/api/delivery-zones')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
    enabled: showZones,
  })

  // Ustvarjanje cone dostave
  const createZoneMutation = useMutation({
    mutationFn: async (data: DeliveryZoneFormRow) => {
      const res = await authFetch('/api/delivery-zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.delivery.zones })
      setShowZoneForm(false)
      setZoneForm(defaultZoneForm)
    },
  })

  // Brisanje cone dostave
  const deleteZoneMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/delivery-zones/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.delivery.zones }),
  })

  // Pridobivanje lokacij
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

  // Ustvarjanje lokacije
  const createMutation = useMutation({
    mutationFn: async (data: LocationFormRow) => {
      const res = await authFetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka pri ustvarjanju')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.locations.all })
      setShowForm(false)
      resetForm()
    },
  })

  // Preklop aktivnosti lokacije
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await authFetch(`/api/locations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.locations.all }),
  })

  // Brisanje lokacije
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/locations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka pri brisanju')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.locations.all }),
  })

  // Ponastavitev obrazca
  const resetForm = useCallback(() => {
    setForm(defaultLocationForm)
    setEditingId(null)
  }, [])

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

  if (isLoading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  }

  return (
    <div className="space-y-6">
      {/* Glava */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Lokacije
          </h2>
          <p className="text-muted-foreground">Upravljanje poslovnih enot in lokacij</p>
        </div>
        <Button onClick={handleToggleForm} className="gap-2">
          <Plus className="h-4 w-4" /> Nova lokacija
        </Button>
        {locations.length > 1 && (
          <Button variant="outline" onClick={handleToggleSync} className="gap-2">
            🔄 Sinhroniziraj meni
          </Button>
        )}
        <Button variant="outline" onClick={handleToggleZones} className="gap-2">
          <Navigation className="h-4 w-4" /> Cone dostave
        </Button>
      </div>

      {/* Statistika */}
      <LocationStats total={stats.total} active={stats.active} open={stats.open} />

      {/* Sinhronizacija menijev */}
      <MenuSyncSection
        showSync={showSync}
        syncSource={syncSource}
        syncing={syncing}
        syncResult={syncResult}
        locations={locations}
        onSyncSourceChange={handleSyncSourceChange}
        onSync={handleSync}
        onCloseSync={handleCloseSync}
      />

      {/* Cone dostave */}
      <DeliveryZonesSection
        showZones={showZones}
        zonesLoading={zonesLoading}
        zonesData={zonesData}
        showZoneForm={showZoneForm}
        zoneForm={zoneForm}
        locations={locations}
        createZonePending={createZoneMutation.isPending}
        onSetZoneForm={setZoneForm}
        onShowZoneForm={setShowZoneForm}
        onZoneFormSubmit={handleZoneFormSubmit}
        onDeleteZone={handleDeleteZone}
      />

      {/* Obrazec za ustvarjanje lokacije */}
      <LocationForm
        showForm={showForm}
        form={form}
        createPending={createMutation.isPending}
        onSetForm={setForm}
        onFormTypeChange={handleFormTypeChange}
        onSubmit={handleSubmit}
        onCancel={() => { setShowForm(false); resetForm() }}
      />

      {/* Seznam lokacij */}
      <LocationsList
        locations={locations}
        expandedId={expandedId}
        onToggleLocationActive={handleToggleLocationActive}
        onToggleExpanded={handleToggleExpanded}
        onDeleteLocation={handleDeleteLocation}
      />

      {/* Potrditveno okno za brisanje */}
      <DeleteDialog
        deleteConfirm={deleteConfirm}
        onOpenChange={handleDeleteDialogChange}
        onConfirmDelete={handleConfirmDelete}
      />
    </div>
  )
})
