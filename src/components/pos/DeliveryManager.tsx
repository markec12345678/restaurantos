'use client'

// ============================================
// DOSTAVNI SISTEM — Profesionalen upravitelj
// Toast POS + TouchBistro standard
// ============================================

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Truck, Globe } from 'lucide-react'
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { useDeliveryManager } from './delivery/useDeliveryManager'

// Lazy-loaded podkomponente
const DeliveryCard = dynamic(() => import('./delivery/DeliveryCard').then(m => ({ default: m.DeliveryCard })), { ssr: false })
const CompletedDeliveryCard = dynamic(() => import('./delivery/CompletedDeliveryCard').then(m => ({ default: m.CompletedDeliveryCard })), { ssr: false })
const DeliveryEditDialog = dynamic(() => import('./delivery/DeliveryEditDialog').then(m => ({ default: m.DeliveryEditDialog })), { ssr: false })
const OnlineOrderCard = dynamic(() => import('./delivery/OnlineOrderCard').then(m => ({ default: m.OnlineOrderCard })), { ssr: false })
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
          {/* Online naročila */}
          {ordersLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
          ) : onlineOrders.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground bg-muted/30 rounded-xl border border-dashed">
              <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Ni novih online naročil</p>
              <p className="text-xs">Naročila iz /order bodo prikazana tukaj</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-500" />
                  Online naročila ({onlineOrders.length})
                </h3>
                <Select value={onlineFilter} onValueChange={setOnlineFilter}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending,in-progress,ready">Aktivna</SelectItem>
                    <SelectItem value="pending">Čakajoča</SelectItem>
                    <SelectItem value="in-progress">V pripravi</SelectItem>
                    <SelectItem value="completed">Zaključena</SelectItem>
                    <SelectItem value="cancelled">Preklicana</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                {onlineOrders.map(order => (
                  <OnlineOrderCard
                    key={order.id}
                    order={order}
                    onNextStatus={handleOnlineNextStatus}
                    onShowDetail={handleShowDetail}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Aktivne dostave */}
          {activeDeliveries.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Aktivne dostave ({activeDeliveries.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeDeliveries.map((delivery) => (
                  <DeliveryCard
                    key={delivery.id}
                    delivery={delivery}
                    onAdvanceStatus={advanceStatus}
                    onEdit={openEdit}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Zgodovina */}
          {completedDeliveries.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Zgodovina dostav ({completedDeliveries.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedDeliveries.map((delivery) => (
                  <CompletedDeliveryCard
                    key={delivery.id}
                    delivery={delivery}
                  />
                ))}
              </div>
            </div>
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
