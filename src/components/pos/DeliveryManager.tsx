'use client'

// ============================================
// DOSTAVNI SISTEM — Profesionalen upravitelj
// Toast POS + TouchBistro standard
// ============================================

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Truck } from 'lucide-react'
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { useDeliveryManager } from './delivery/useDeliveryManager'

// Lazy-loaded podkomponente
const DeliveryTable = dynamic(() => import('./DeliveryTable').then(m => ({ default: m.DeliveryTable })), { ssr: false })
const DeliveryEditDialog = dynamic(() => import('./delivery/DeliveryEditDialog').then(m => ({ default: m.DeliveryEditDialog })), { ssr: false })
const OnlineOrderDetailDialog = dynamic(() => import('./delivery/OnlineOrderDetailDialog').then(m => ({ default: m.OnlineOrderDetailDialog })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================
export const DeliveryManager = memo(function DeliveryManager() {
  const {
    statusFilter, setStatusFilter,
    dialogOpen, setDialogOpen,
    formData, setFormData,
    onlineFilter, setOnlineFilter,
    detailOrder,
    isLoading, ordersLoading,
    activeDeliveries, completedDeliveries,
    onlineOrders, safeDeliveries,
    openEdit, handleUpdate, advanceStatus,
    handleOnlineNextStatus, handleShowDetail, handleDetailOpenChange,
    updateMutation,
  } = useDeliveryManager()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            Dostava
          </h2>
          <p className="text-muted-foreground">Upravljanje dostavnih naročil</p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vsi statusi</SelectItem>
              <SelectItem value="pending">Čaka</SelectItem>
              <SelectItem value="preparing">V pripravi</SelectItem>
              <SelectItem value="ready">Pripravljeno</SelectItem>
              <SelectItem value="picked_up">Prevzeto</SelectItem>
              <SelectItem value="delivered">Dostavljeno</SelectItem>
              <SelectItem value="failed">Neuspešno</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : (
        <>
          {ordersLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
          ) : (
            <DeliveryTable
              onlineOrders={onlineOrders}
              onlineFilter={onlineFilter}
              setOnlineFilter={setOnlineFilter}
              activeDeliveries={activeDeliveries}
              completedDeliveries={completedDeliveries}
              handleOnlineNextStatus={handleOnlineNextStatus}
              handleShowDetail={handleShowDetail}
              advanceStatus={advanceStatus}
              openEdit={openEdit}
            />
          )}

          {safeDeliveries.length === 0 && onlineOrders.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Ni dostavnih naročil</p>
              <p className="text-sm">Ustvarite dostavno naročilo v modulu Prodaja</p>
            </div>
          )}
        </>
      )}

      {/* Dialog za urejanje dostave */}
      <DeliveryEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        formData={formData}
        onFormDataChange={setFormData}
        onUpdate={handleUpdate}
        isPending={updateMutation.isPending}
      />

      {/* Detail dialog za online naročilo */}
      <OnlineOrderDetailDialog
        open={!!detailOrder}
        onOpenChange={handleDetailOpenChange}
        order={detailOrder}
      />
    </div>
  )
})
