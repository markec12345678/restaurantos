'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Delivery Tracker / Sledenje dostav
// Toast + DoorDash standard — GPS sledenje, statusi, ETA
// ═══════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { authFetch } from '@/components/pos/PinLogin'
import {
  Truck, MapPin, Clock, Phone, User, Package, CheckCircle2,
  Navigation, AlertTriangle, ChevronRight, Star, Bike,
  Timer, ArrowRight, PhoneCall, MessageSquare,
} from 'lucide-react'
import { useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface DeliveryTrackingData {
  id: string
  deliveryInfoId: string
  driverName: string
  driverPhone: string
  vehicleInfo: string
  currentLat: number | null
  currentLng: number | null
  lastUpdateAt: string | null
  status: string
  estimatedArrival: string | null
  assignedAt: string | null
  pickedUpAt: string | null
  onTheWayAt: string | null
  deliveredAt: string | null
  customerRating: number | null
  customerFeedback: string
  deliveryInfo?: {
    id: string
    address: string
    city: string
    postCode: string
    recipientName: string
    recipientPhone: string
    deliveryInstructions: string
    status: string
    order?: {
      id: string
      orderNumber: number
      total: number
      type: string
      orderItems: { id: string; menuItem: { name: string }; quantity: number }[]
    }
  }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; step: number }> = {
  assigned: { label: 'Dodeljeno', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: User, step: 1 },
  picked_up: { label: 'Prevzeto', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: Package, step: 2 },
  on_the_way: { label: 'Na poti', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: Truck, step: 3 },
  arriving: { label: 'Prihaja', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: Navigation, step: 4 },
  delivered: { label: 'Dostavljeno', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2, step: 5 },
  failed: { label: 'Neuspelo', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle, step: 0 },
}

export function DeliveryTracker() {
  const queryClient = useQueryClient()
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryTrackingData | null>(null)
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [vehicleInfo, setVehicleInfo] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('active')

  // Pridobi dostave s sledenjem
  const { data: trackings, isLoading } = useQuery({
    queryKey: ['delivery-trackings', filterStatus],
    queryFn: async () => {
      const params = filterStatus !== 'all' ? `?status=${filterStatus}` : ''
      const res = await authFetch(`/api/delivery-tracking${params}`)
      return res.json()
    },
    refetchInterval: 15000, // Osvežuj vsakih 15s
  })

  // Pridobi dostave brez voznika
  const { data: unassigned } = useQuery({
    queryKey: ['unassigned-deliveries'],
    queryFn: async () => {
      const res = await authFetch('/api/delivery?status=ready')
      if (!res.ok) return []
      return res.json()
    },
  })

  // Dodeli voznika
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDelivery) return
      const res = await authFetch('/api/delivery-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryInfoId: selectedDelivery.deliveryInfoId,
          driverName,
          driverPhone,
          vehicleInfo,
        }),
      })
      if (!res.ok) throw new Error('Napaka pri dodeljevanju')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-trackings'] })
      toast.success('Voznik dodeljen!')
      setShowAssignDialog(false)
      setSelectedDelivery(null)
    },
    onError: () => toast.error('Napaka pri dodeljevanju voznika'),
  })

  // Posodobi status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ deliveryInfoId, status }: { deliveryInfoId: string; status: string }) => {
      const res = await authFetch('/api/delivery-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryInfoId, status }),
      })
      if (!res.ok) throw new Error('Napaka pri posodabljanju')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-trackings'] })
      toast.success('Status posodobljen!')
    },
    onError: () => toast.error('Napaka pri posodabljanju statusa'),
  })

  const getNextStatus = (currentStatus: string): string | null => {
    const flow = ['assigned', 'picked_up', 'on_the_way', 'arriving', 'delivered']
    const idx = flow.indexOf(currentStatus)
    return idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
      </div>
    )
  }

  const activeCount = (trackings || []).filter((t: DeliveryTrackingData) => t.status !== 'delivered' && t.status !== 'failed').length
  const deliveredCount = (trackings || []).filter((t: DeliveryTrackingData) => t.status === 'delivered').length

  return (
    <div className="space-y-4 p-2 overflow-y-auto h-full custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6 text-amber-500" />
            Sledenje dostav
          </h2>
          <p className="text-muted-foreground">GPS sledenje voznikom v realnem času</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktivne ({activeCount})</SelectItem>
              <SelectItem value="delivered">Dostavljene</SelectItem>
              <SelectItem value="failed">Neuspele</SelectItem>
              <SelectItem value="all">Vse</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistika */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{activeCount}</div>
              <div className="text-xs text-muted-foreground">Aktivne dostave</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{deliveredCount}</div>
              <div className="text-xs text-muted-foreground">Dostavljene</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Timer className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {trackings?.length > 0
                  ? Math.round(trackings.filter((t: DeliveryTrackingData) => t.status === 'delivered' && t.deliveredAt && t.assignedAt)
                      .reduce((sum: number, t: DeliveryTrackingData) => {
                        const mins = (new Date(t.deliveredAt!).getTime() - new Date(t.assignedAt!).getTime()) / 60000
                        return sum + mins
                      }, 0) / Math.max(deliveredCount, 1))
                  : 0}m
              </div>
              <div className="text-xs text-muted-foreground">Povprečen čas</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dostave */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(trackings || []).length === 0 ? (
          <Card className="col-span-full text-center py-16">
            <CardContent>
              <Truck className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Ni aktivnih dostav</h3>
              <p className="text-muted-foreground">Dostave s sledenjem se bodo prikazale tukaj</p>
            </CardContent>
          </Card>
        ) : (
          (trackings || []).map((tracking: DeliveryTrackingData) => {
            const cfg = STATUS_CONFIG[tracking.status] || STATUS_CONFIG.assigned
            const StatusIcon = cfg.icon
            const nextStatus = getNextStatus(tracking.status)
            const nextCfg = nextStatus ? STATUS_CONFIG[nextStatus] : null
            const NextIcon = nextCfg?.icon || ChevronRight
            const order = tracking.deliveryInfo?.order

            return (
              <Card key={tracking.id} className="overflow-hidden">
                {/* Status bar */}
                <div className={`h-1.5 ${
                  tracking.status === 'delivered' ? 'bg-green-500' :
                  tracking.status === 'failed' ? 'bg-red-500' :
                  tracking.status === 'on_the_way' ? 'bg-purple-500' :
                  'bg-blue-500'
                }`} />

                <CardContent className="p-4 space-y-3">
                  {/* Order + Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {order && (
                        <span className="font-bold text-sm">#{order.orderNumber}</span>
                      )}
                      <Badge className={cfg.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {cfg.label}
                      </Badge>
                    </div>
                    {order && (
                      <span className="font-semibold text-green-600">€{(order.total || 0).toFixed(2)}</span>
                    )}
                  </div>

                  {/* Naslov */}
                  {tracking.deliveryInfo && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-medium">{tracking.deliveryInfo.address}</div>
                        <div className="text-muted-foreground">{tracking.deliveryInfo.city} {tracking.deliveryInfo.postCode}</div>
                        {tracking.deliveryInfo.deliveryInstructions && (
                          <div className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {tracking.deliveryInfo.deliveryInstructions}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Voznik */}
                  <div className="flex items-center gap-3 p-2 bg-accent/50 rounded-lg">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                      {tracking.driverName.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{tracking.driverName}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {tracking.driverPhone}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                      <PhoneCall className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Artikli */}
                  {order && order.orderItems.length > 0 && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {order.orderItems.slice(0, 3).map(oi => (
                        <div key={oi.id}>{oi.quantity}x {oi.menuItem.name}</div>
                      ))}
                      {order.orderItems.length > 3 && (
                        <div>+{order.orderItems.length - 3} več</div>
                      )}
                    </div>
                  )}

                  {/* ETA */}
                  {tracking.estimatedArrival && tracking.status !== 'delivered' && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>ETA: {format(new Date(tracking.estimatedArrival), 'HH:mm')}</span>
                      {tracking.lastUpdateAt && (
                        <span className="text-xs text-muted-foreground">
                          (zadnja posodobitev: {format(new Date(tracking.lastUpdateAt), 'HH:mm')})
                        </span>
                      )}
                    </div>
                  )}

                  {/* GPS indikator */}
                  {tracking.currentLat && tracking.currentLng && (
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <Navigation className="h-3 w-3 animate-pulse" />
                      GPS aktivno
                    </div>
                  )}

                  {/* Ocena */}
                  {tracking.status === 'delivered' && tracking.customerRating && (
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Star key={i} className={`h-3 w-3 ${i <= (tracking.customerRating || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                      ))}
                      {tracking.customerFeedback && (
                        <span className="text-xs text-muted-foreground ml-2">"{tracking.customerFeedback}"</span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  {nextStatus && (
                    <Button
                      size="sm"
                      className="w-full"
                      variant={nextStatus === 'delivered' ? 'default' : 'outline'}
                      onClick={() => updateStatusMutation.mutate({
                        deliveryInfoId: tracking.deliveryInfoId,
                        status: nextStatus,
                      })}
                      disabled={updateStatusMutation.isPending}
                    >
                      <NextIcon className="h-3.5 w-3.5 mr-1" />
                      {nextCfg?.label || nextStatus}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Dialog za dodelitev voznika */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodeli voznika</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Ime voznika</label>
              <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Janez Novak" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Telefon</label>
              <Input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} placeholder="+386 31 234 567" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Vozilo</label>
              <Input value={vehicleInfo} onChange={(e) => setVehicleInfo(e.target.value)} placeholder="Rdeč Fiat 500, LJ-123-AB" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Prekliči</Button>
            <Button onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending || !driverName || !driverPhone}>
              <User className="h-4 w-4 mr-2" />
              Dodeli
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
