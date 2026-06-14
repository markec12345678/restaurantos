'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Building2, Navigation } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useLocationManager } from './location/useLocationManager'

// Lazy-loaded podkomponente
const LocationStats = dynamic(() => import('./location/LocationStats').then(m => ({ default: m.LocationStats })), { ssr: false })
const MenuSyncSection = dynamic(() => import('./location/MenuSyncSection').then(m => ({ default: m.MenuSyncSection })), { ssr: false })
const DeliveryZonesSection = dynamic(() => import('./location/DeliveryZonesSection').then(m => ({ default: m.DeliveryZonesSection })), { ssr: false })
const LocationForm = dynamic(() => import('./location/LocationForm').then(m => ({ default: m.LocationForm })), { ssr: false })
const LocationsList = dynamic(() => import('./location/LocationsList').then(m => ({ default: m.LocationsList })), { ssr: false })
const DeleteDialog = dynamic(() => import('./location/DeleteDialog').then(m => ({ default: m.DeleteDialog })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const LocationManager = memo(function LocationManager() {
  const {
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
    createPending,
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
  } = useLocationManager()

  // ============================================
  // RENDER: LOADING SKELETON
  // ============================================

  if (isLoading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  }

  // ============================================
  // GLAVNI RENDER
  // ============================================

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
            Sinhroniziraj meni
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
        createZonePending={createPending}
        onSetZoneForm={setZoneForm}
        onShowZoneForm={setShowZoneForm}
        onZoneFormSubmit={handleZoneFormSubmit}
        onDeleteZone={handleDeleteZone}
      />

      {/* Obrazec za novo lokacijo */}
      <LocationForm
        showForm={showForm}
        form={form}
        createPending={createPending}
        onSetForm={setForm}
        onFormTypeChange={handleFormTypeChange}
        onSubmit={handleSubmit}
        onCancel={handleCancelForm}
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
