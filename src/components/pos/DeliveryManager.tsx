'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Truck, MapPin, Clock, Phone, Navigation, RefreshCw, Globe, ShoppingCart } from 'lucide-react'
import { useState, memo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'

interface DeliveryInfoData {
  id: string
  address: string
  city: string
  postCode: string
  recipientName: string
  recipientPhone: string
  deliveryInstructions: string
  promisedTime: string | null
  estimatedTime: string | null
  actualTime: string | null
  courierName: string
  courierPhone: string
  status: string
  packagingFee: number
  deliveryFee: number
  latitude: number | null
  longitude: number | null
  order?: { id: string; orderNumber: number; customerName: string; total: number } | null
  createdAt: string
}

const statusLabels: Record<string, string> = {
  pending: 'Čaka',
  preparing: 'V pripravi',
  ready: 'Pripravljeno',
  picked_up: 'Prevzeto',
  delivered: 'Dostavljeno',
  failed: 'Neuspešno',
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  preparing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  picked_up: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  delivered: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

export const DeliveryManager = memo(function DeliveryManager() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDelivery, setEditingDelivery] = useState<DeliveryInfoData | null>(null)
  const [formData, setFormData] = useState({
    address: '', city: '', postCode: '', recipientName: '', recipientPhone: '',
    deliveryInstructions: '', courierName: '', courierPhone: '', status: 'pending',
    packagingFee: '0', deliveryFee: '0',
  })

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

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/delivery/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Napaka pri posodobitvi dostave')
      return res.json()
    },
    onSuccess: () => { toast.success('Dostava posodobljena'); queryClient.invalidateQueries({ queryKey: queryKeys.delivery.tracking }); setDialogOpen(false) },
    onError: () => toast.error('Napaka pri posodobitvi'),
  })

  const openEdit = (delivery: DeliveryInfoData) => {
    setEditingDelivery(delivery)
    setFormData({
      address: delivery.address, city: delivery.city, postCode: delivery.postCode,
      recipientName: delivery.recipientName, recipientPhone: delivery.recipientPhone,
      deliveryInstructions: delivery.deliveryInstructions,
      courierName: delivery.courierName, courierPhone: delivery.courierPhone,
      status: delivery.status,
      packagingFee: String(delivery.packagingFee), deliveryFee: String(delivery.deliveryFee),
    })
    setDialogOpen(true)
  }

  const handleUpdate = () => {
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
  }

  const advanceStatus = (delivery: DeliveryInfoData) => {
    const nextStatuses: Record<string, string> = {
      pending: 'preparing', preparing: 'ready', ready: 'picked_up', picked_up: 'delivered',
    }
    const next = nextStatuses[delivery.status]
    if (next) {
      updateMutation.mutate({ id: delivery.id, status: next })
    }
  }

  const safeDeliveries = Array.isArray(deliveries) ? deliveries : []
  const activeDeliveries = safeDeliveries.filter(d => !['delivered', 'failed'].includes(d.status))
  const completedDeliveries = safeDeliveries.filter(d => ['delivered', 'failed'].includes(d.status))

  return (
    <div className="space-y-6">
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
          <OnlineOrdersSection />

          {/* Aktivne dostave */}
          {activeDeliveries.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Aktivne dostave ({activeDeliveries.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeDeliveries.map((delivery) => (
                  <Card key={delivery.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            <p className="font-medium text-sm">{delivery.address}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">{delivery.city} {delivery.postCode}</p>
                        </div>
                        <Badge className={statusColors[delivery.status] || ''}>{statusLabels[delivery.status] || delivery.status}</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span>{delivery.recipientName || 'Brez imena'}</span>
                        </div>
                        {delivery.courierName && (
                          <div className="flex items-center gap-1">
                            <Navigation className="h-3 w-3 text-muted-foreground" />
                            <span>{delivery.courierName}</span>
                          </div>
                        )}
                        {delivery.promisedTime && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span>{new Date(delivery.promisedTime).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        )}
                      </div>

                      {delivery.deliveryInstructions && (
                        <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">{delivery.deliveryInstructions}</p>
                      )}

                      <div className="flex items-center justify-between text-xs">
                        <span>Dostava: €{(delivery.deliveryFee ?? 0).toFixed(2)} | Embalaža: €{(delivery.packagingFee ?? 0).toFixed(2)}</span>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => advanceStatus(delivery)}>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          {delivery.status === 'pending' ? 'Pripravi' : delivery.status === 'preparing' ? 'Pripravljeno' : delivery.status === 'ready' ? 'Prevzeto' : 'Dostavljeno'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEdit(delivery)}>Uredi</Button>
                      </div>
                    </CardContent>
                  </Card>
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
                  <Card key={delivery.id} className="opacity-75">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <p className="font-medium text-sm">{delivery.address}, {delivery.city}</p>
                        <Badge className={statusColors[delivery.status] || ''}>{statusLabels[delivery.status] || delivery.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{delivery.recipientName} | €{(delivery.deliveryFee ?? 0).toFixed(2)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {safeDeliveries.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Ni dostavnih naročil</p>
              <p className="text-sm">Ustvarite dostavno naročilo v modulu Prodaja</p>
            </div>
          )}
        </>
      )}

      {/* Dialog za urejanje dostave */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Uredi dostavo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label htmlFor="dlv-address">Naslov *</Label><Input id="dlv-address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} autoFocus /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="dlv-city">Mesto</Label><Input id="dlv-city" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} /></div>
              <div><Label htmlFor="dlv-postcode">Poštna številka</Label><Input id="dlv-postcode" value={formData.postCode} onChange={(e) => setFormData({ ...formData, postCode: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="dlv-recipient">Prejemnik</Label><Input id="dlv-recipient" value={formData.recipientName} onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })} /></div>
              <div><Label htmlFor="dlv-phone">Telefon</Label><Input id="dlv-phone" value={formData.recipientPhone} onChange={(e) => setFormData({ ...formData, recipientPhone: e.target.value })} /></div>
            </div>
            <div><Label>Navodila za dostavo</Label><Textarea value={formData.deliveryInstructions} onChange={(e) => setFormData({ ...formData, deliveryInstructions: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="dlv-courier">Kurir</Label><Input id="dlv-courier" value={formData.courierName} onChange={(e) => setFormData({ ...formData, courierName: e.target.value })} /></div>
              <div><Label htmlFor="dlv-courier-phone">Telefon kurirja</Label><Input id="dlv-courier-phone" value={formData.courierPhone} onChange={(e) => setFormData({ ...formData, courierPhone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="dlv-fee">Dostavna cena (€)</Label><Input id="dlv-fee" type="number" step="0.01" value={formData.deliveryFee} onChange={(e) => setFormData({ ...formData, deliveryFee: e.target.value })} /></div>
              <div><Label htmlFor="dlv-pkg-fee">Embalaža (€)</Label><Input id="dlv-pkg-fee" type="number" step="0.01" value={formData.packagingFee} onChange={(e) => setFormData({ ...formData, packagingFee: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Prekliči</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>Posodobi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})

// ============================================
// ONLINE NAROČILA — Seznam naročil iz /order
// ============================================

interface OnlineOrder {
  id: string
  orderNumber: number
  type: string
  status: string
  customerName: string
  customerPhone: string
  customerEmail: string
  subtotal: number
  tax: number
  discount: number
  total: number
  paymentMethod: string
  paymentStatus: string
  notes: string
  createdAt: string
  orderItems: Array<{ id: string; menuItemId: string; quantity: number; price: number; notes: string }>
}

const onlineStatusLabels: Record<string, string> = {
  pending: 'Čaka', confirmed: 'Potrjeno', 'in-progress': 'V pripravi',
  ready: 'Pripravljeno', completed: 'Zaključeno', cancelled: 'Preklicano',
}

const onlineStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800', confirmed: 'bg-blue-100 text-blue-800',
  'in-progress': 'bg-orange-100 text-orange-800', ready: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-600', cancelled: 'bg-red-100 text-red-800',
}

function OnlineOrdersSection() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('pending,in-progress,ready')
  const [detailOrder, setDetailOrder] = useState<OnlineOrder | null>(null)

  const { data: ordersData, isLoading } = useQuery<{ orders: OnlineOrder[] }>({
    queryKey: [...queryKeys.delivery.onlineOrders, filter],
    queryFn: async () => {
      const res = await authFetch(`/api/orders?status=${filter}&type=delivery,takeout&limit=20&source=online`)
      if (!res.ok) return { orders: [] }
      const data = await res.json()
      return { orders: Array.isArray(data) ? data : data.orders || [] }
    },
    refetchInterval: 15000, // Auto-refresh vsakih 15s
  })

  const updateStatusMutation = useMutation({
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

  const orders = ordersData?.orders || []
  const onlineOrders = orders.filter(o => o.notes?.includes('ONLINE'))

  if (isLoading) return <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>

  if (onlineOrders.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground bg-muted/30 rounded-xl border border-dashed">
        <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm font-medium">Ni novih online naročil</p>
        <p className="text-xs">Naročila iz /order bodo prikazana tukaj</p>
      </div>
    )
  }

  const getNextStatus = (current: string) => {
    const flow: Record<string, string> = { pending: 'confirmed', confirmed: 'in-progress', 'in-progress': 'ready', ready: 'completed' }
    return flow[current]
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-500" />
          Online naročila ({onlineOrders.length})
        </h3>
        <Select value={filter} onValueChange={setFilter}>
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
          <Card key={order.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-bold text-sm">
                    #{order.orderNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{order.customerName || 'Gost'}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {order.type === 'delivery' ? '🚗 Dostava' : '🛍 Prevzem'}
                      </Badge>
                      <Badge className={onlineStatusColors[order.status] || ''}>
                        {onlineStatusLabels[order.status] || order.status}
                      </Badge>
                      <Badge variant={order.paymentStatus === 'paid' ? 'default' : 'secondary'} className={order.paymentStatus === 'paid' ? 'bg-green-600' : ''}>
                        {order.paymentStatus === 'paid' ? 'Plačano' : 'Čaka plačilo'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{order.customerPhone}</span>
                      <span>{order.orderItems?.length || 0} artiklov</span>
                      <span className="font-semibold text-blue-700">€{order.total.toFixed(2)}</span>
                      <span>{new Date(order.createdAt).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getNextStatus(order.status) && (
                    <Button size="sm" onClick={() => updateStatusMutation.mutate({ id: order.id, status: getNextStatus(order.status) })}>
                      {order.status === 'pending' ? 'Potrdi' : order.status === 'confirmed' ? 'Začni pripravo' : order.status === 'in-progress' ? 'Pripravljeno' : 'Zaključi'}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setDetailOrder(order)}>
                    <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Podrobnosti
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail dialog za online naročilo */}
      <Dialog open={!!detailOrder} onOpenChange={(open) => { if (!open) setDetailOrder(null) }}>
        <DialogContent tabIndex={-1}>
          <DialogHeader>
            <DialogTitle>Naročilo #{detailOrder?.orderNumber}</DialogTitle>
          </DialogHeader>
          {detailOrder && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge className={onlineStatusColors[detailOrder.status] || 'bg-gray-100 text-gray-600'}>
                  {onlineStatusLabels[detailOrder.status] || detailOrder.status}
                </Badge>
                <span className="text-muted-foreground">{new Date(detailOrder.createdAt).toLocaleString('sl-SI')}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="font-medium">Stranka:</span> {detailOrder.customerName || '—'}</div>
                <div><span className="font-medium">Telefon:</span> {detailOrder.customerPhone || '—'}</div>
                <div><span className="font-medium">Tip:</span> {detailOrder.type}</div>
                <div><span className="font-medium">Plačilo:</span> {detailOrder.paymentMethod} ({detailOrder.paymentStatus})</div>
              </div>
              {detailOrder.orderItems.length > 0 && (
                <div>
                  <span className="font-medium">Artikli:</span>
                  <ul className="mt-1 space-y-1">
                    {detailOrder.orderItems.map((item) => (
                      <li key={item.id} className="flex justify-between">
                        <span>{item.quantity}× {item.menuItemId}</span>
                        <span>€{(item.price * item.quantity).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-medium">
                <span>Skupaj:</span>
                <span>€{detailOrder.total.toFixed(2)}</span>
              </div>
              {detailOrder.notes && (
                <div className="bg-muted p-2 rounded text-xs">{detailOrder.notes}</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
