'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Delivery Tracker / Sledenje dostav
// Toast + DoorDash standard — GPS sledenje, statusi, ETA
// Koordinator — poizvedbe, mutacije, delegiranje pod-komponentam
// ═══════════════════════════════════════════════════════════════

import { memo } from 'react'
import dynamic from 'next/dynamic'
import type { DeliveryTrackingData } from './delivery-tracker/constants'
import { useDeliveryTracker } from './useDeliveryTracker'

// Lazy-loaded pod-komponente
const DeliveryStatsCards = dynamic(() => import('./delivery-tracker/DeliveryStatsCards').then(m => ({ default: m.DeliveryStatsCards })), { ssr: false })
const DeliveryCard = dynamic(() => import('./delivery-tracker/DeliveryCard').then(m => ({ default: m.DeliveryCard })), { ssr: false })
const AssignDriverDialog = dynamic(() => import('./delivery-tracker/AssignDriverDialog').then(m => ({ default: m.AssignDriverDialog })), { ssr: false })
const DeliveryHeader = dynamic(() => import('./delivery-tracker/DeliveryHeader').then(m => ({ default: m.DeliveryHeader })), { ssr: false })
const DeliveryEmptyState = dynamic(() => import('./delivery-tracker/DeliveryEmptyState').then(m => ({ default: m.DeliveryEmptyState })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA - Koordinator
// ============================================
export const DeliveryTracker = memo(function DeliveryTracker() {
  const {
    showAssignDialog,
    driverName, driverPhone, vehicleInfo,
    filterStatus, setFilterStatus,
    trackings, isLoading,
    assignMutation, updateStatusMutation,
    getNextStatus,
    activeCount, deliveredCount, avgDeliveryTime,
    handleDriverNameChange, handleDriverPhoneChange, handleVehicleInfoChange,
    handleAssignDialogOpenChange, handleAssignDriver, handleUpdateStatus,
  } = useDeliveryTracker()

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-10 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-muted animate-pulse rounded" />)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-2 overflow-y-auto h-full custom-scrollbar">
      {/* Header */}
      <DeliveryHeader
        activeCount={activeCount}
        deliveredCount={deliveredCount}
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
      />

      {/* Statistika */}
      <DeliveryStatsCards
        activeCount={activeCount}
        deliveredCount={deliveredCount}
        avgDeliveryTime={avgDeliveryTime}
      />

      {/* Dostave */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(trackings || []).length === 0 ? (
          <DeliveryEmptyState />
        ) : (
          (trackings || []).map((tracking: DeliveryTrackingData) => {
            const nextStatus = getNextStatus(tracking.status)
            return (
              <DeliveryCard
                key={tracking.id}
                tracking={tracking}
                nextStatus={nextStatus}
                onUpdateStatus={handleUpdateStatus}
                isStatusUpdatePending={updateStatusMutation.isPending}
              />
            )
          })
        )}
      </div>

      {/* Dialog za dodelitev voznika */}
      <AssignDriverDialog
        open={showAssignDialog}
        onOpenChange={handleAssignDialogOpenChange}
        driverName={driverName}
        onDriverNameChange={handleDriverNameChange}
        driverPhone={driverPhone}
        onDriverPhoneChange={handleDriverPhoneChange}
        vehicleInfo={vehicleInfo}
        onVehicleInfoChange={handleVehicleInfoChange}
        isPending={assignMutation.isPending}
        onAssign={handleAssignDriver}
      />
    </div>
  )
})
