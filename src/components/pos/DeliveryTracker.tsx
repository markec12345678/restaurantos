'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Delivery Tracker / Sledenje dostav
// Toast + DoorDash standard — GPS sledenje, statusi, ETA
// Koordinator — poizvedbe, mutacije, delegiranje pod-komponentam
// ═══════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { Truck } from 'lucide-react'
import { useState, useCallback, useMemo, memo } from 'react'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { STATUS_FLOW } from './delivery-tracker/constants'
import type { DeliveryTrackingData } from './delivery-tracker/constants'

// Lazy-loaded pod-komponente
const DeliveryStatsCards = dynamic(() => import('./delivery-tracker/DeliveryStatsCards').then(m => ({ default: m.DeliveryStatsCards })), { ssr: false })
const DeliveryCard = dynamic(() => import('./delivery-tracker/DeliveryCard').then(m => ({ default: m.DeliveryCard })), { ssr: false })
const AssignDriverDialog = dynamic(() => import('./delivery-tracker/AssignDriverDialog').then(m => ({ default: m.AssignDriverDialog })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA - Koordinator
// ============================================
export const DeliveryTracker = memo(function DeliveryTracker() {
  const queryClient = useQueryClient()
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryTrackingData | null>(null)
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [vehicleInfo, setVehicleInfo] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('active')

  // Pridobi dostave s sledenjem
  const { data: trackings, isLoading } = useQuery({
    queryKey: [...queryKeys.delivery.tracking, filterStatus],
    queryFn: async () => {
      const params = filterStatus !== 'all' ? `?status=${filterStatus}` : ''
      const res = await authFetch(`/api/delivery-tracking${params}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju sledenja dostav')
      return res.json()
    },
    refetchInterval: 15000, // Osvežuj vsakih 15s
  })

  // Pridobi dostave brez voznika
  const { data: _unassigned } = useQuery({
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
      queryClient.invalidateQueries({ queryKey: queryKeys.delivery.tracking })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.delivery.tracking })
      toast.success('Status posodobljen!')
    },
    onError: () => toast.error('Napaka pri posodabljanju statusa'),
  })

  const getNextStatus = useCallback((currentStatus: string): string | null => {
    const idx = STATUS_FLOW.indexOf(currentStatus as typeof STATUS_FLOW[number])
    return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null
  }, [])

  // Vsi hooki morajo biti klicani PRED pogojnim return-om (React pravila hookov)
  const activeCount = useMemo(() => (trackings || []).filter((t: DeliveryTrackingData) => t.status !== 'delivered' && t.status !== 'failed').length, [trackings])
  const deliveredCount = useMemo(() => (trackings || []).filter((t: DeliveryTrackingData) => t.status === 'delivered').length, [trackings])

  const avgDeliveryTime = useMemo(() => {
    if (!trackings?.length) return '0m'
    const avg = Math.round(
      trackings
        .filter((t: DeliveryTrackingData) => t.status === 'delivered' && t.deliveredAt && t.assignedAt)
        .reduce((sum: number, t: DeliveryTrackingData) => {
          const mins = (new Date(t.deliveredAt!).getTime() - new Date(t.assignedAt!).getTime()) / 60000
          return sum + mins
        }, 0) / Math.max(deliveredCount, 1)
    )
    return `${avg}m`
  }, [trackings, deliveredCount])

  // Stabilni callbacki
  const handleDriverNameChange = useCallback((v: string) => setDriverName(v), [])
  const handleDriverPhoneChange = useCallback((v: string) => setDriverPhone(v), [])
  const handleVehicleInfoChange = useCallback((v: string) => setVehicleInfo(v), [])
  const handleAssignDialogOpenChange = useCallback((open: boolean) => setShowAssignDialog(open), [])
  const handleAssignDriver = useCallback(() => assignMutation.mutate(), [assignMutation])
  const handleUpdateStatus = useCallback((params: { deliveryInfoId: string; status: string }) => updateStatusMutation.mutate(params), [updateStatusMutation])

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
      </div>
    )
  }

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
      <DeliveryStatsCards
        activeCount={activeCount}
        deliveredCount={deliveredCount}
        avgDeliveryTime={avgDeliveryTime}
      />

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
