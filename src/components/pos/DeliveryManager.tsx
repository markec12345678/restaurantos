'use client'

// ============================================
// DOSTAVNI SISTEM — Profesionalen upravitelj
// Toast POS + TouchBistro standard
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Truck, Globe } from 'lucide-react'
import { useState, memo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import {
  type DeliveryInfoData,
  type DeliveryFormData,
  type OnlineOrder,
  emptyFormData,
  deliveryToFormData,
  getNextDeliveryStatus,
} from './delivery/constants'

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
  const queryClient = useQueryClient()

  // --- Dostave stanje ---
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDelivery, setEditingDelivery] = useState<DeliveryInfoData | null>(null)
  const [formData, setFormData] = useState<DeliveryFormData>(emptyFormData)

  // --- Online naročila stanje ---
  const [onlineFilter, setOnlineFilter] = useState('pending,in-progress,ready')
  const [detailOrder, setDetailOrder] = useState<OnlineOrder | null>(null)

  // --- Poizvedbe: dostave ---
  const { data: deliveries, isLoading } = useQuery<DeliveryInfoData[]>({
    queryKey: [...queryKeys.delivery.tracking, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await authFetch(`/api/delivery?${params}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju dostav')
      return res.json()
    },
  })

  // --- Poizvedbe: online naročila ---
  const { data: ordersData, isLoading: ordersLoading } = useQuery<{ orders: OnlineOrder[] }>({
    queryKey: [...queryKeys.delivery.onlineOrders, onlineFilter],
    queryFn: async () => {
      const res = await authFetch(`/api/orders?status=${onlineFilter}&type=delivery,takeout&limit=20&source=online`)
      if (!res.ok) return { orders: [] }
      const data = await res.json()
      return { orders: Array.isArray(data) ? data : data.orders || [] }
    },
    refetchInterval: 15000, // Auto-refresh vsakih 15s
  })

  // --- Mutacije: posodobi dostavo ---
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/delivery/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Napaka pri posodobitvi dostave')
      return res.json()
    },
    onSuccess: () => { toast.success('Dostava posodobljena'); queryClient.invalidateQueries({ queryKey: queryKeys.delivery.tracking }); setDialogOpen(false) },
    onError: () => toast.error('Napaka pri posodobitvi'),
  })

  // --- Mutacije: posodobi status online naročila ---
  const updateOnlineStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await authFetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Status posodobljen')
      queryClient.invalidateQueries({ queryKey: queryKeys.delivery.onlineOrders })
    },
    onError: () => toast.error('Napaka pri posodobitvi'),
  })

  // --- Handlerji: dostave ---
  const openEdit = useCallback((delivery: DeliveryInfoData) => {
    setEditingDelivery(delivery)
    setFormData(deliveryToFormData(delivery))
    setDialogOpen(true)
  }, [])

  const handleUpdate = useCallback(() => {
    if (!editingDelivery) return
    if (!formData.address.trim()) {
      toast.error('Naslov je obvezen')
      return
    }
    updateMutation.mutate({
      id: editingDelivery.id,
      ...formData,
      packagingFee: parseFloat(formData.packagingFee) || 0,
      deliveryFee: parseFloat(formData.deliveryFee) || 0,
    })
  }, [editingDelivery, formData, updateMutation])

  const advanceStatus = useCallback((delivery: DeliveryInfoData) => {
    const next = getNextDeliveryStatus(delivery.status)
    if (next) {
      updateMutation.mutate({ id: delivery.id, status: next })
    }
  }, [updateMutation])

  // --- Handlerji: online naročila ---
  const handleOnlineNextStatus = useCallback((id: string, status: string) => {
    updateOnlineStatusMutation.mutate({ id, status })
  }, [updateOnlineStatusMutation])

  const handleShowDetail = useCallback((order: OnlineOrder) => {
    setDetailOrder(order)
  }, [])

  const handleDetailOpenChange = useCallback((open: boolean) => {
    if (!open) setDetailOrder(null)
  }, [])

  // --- Izpeljani podatki ---
  const safeDeliveries = Array.isArray(deliveries) ? deliveries : []
  const activeDeliveries = safeDeliveries.filter(d => !['delivered', 'failed'].includes(d.status))
  const completedDeliveries = safeDeliveries.filter(d => ['delivered', 'failed'].includes(d.status))

  const orders = ordersData?.orders || []
  const onlineOrders = orders.filter(o => o.notes?.includes('ONLINE'))

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
