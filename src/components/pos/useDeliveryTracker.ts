'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useState, useCallback, useMemo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { DeliveryTrackingData } from './delivery-tracker/constants'
import { STATUS_FLOW } from './delivery-tracker/constants'

// ============================================
// HOOK: Sledenje dostav — Poizvedbe in mutacije
// ============================================

export function useDeliveryTracker() {
  const queryClient = useQueryClient()
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryTrackingData | null>(null)
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [vehicleInfo, setVehicleInfo] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('active')

  const { data: trackings, isLoading } = useQuery({
    queryKey: [...queryKeys.delivery.tracking, filterStatus],
    queryFn: async () => {
      const params = filterStatus !== 'all' ? `?status=${filterStatus}` : ''
      const res = await authFetch(`/api/delivery-tracking${params}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju sledenja dostav')
      return res.json()
    },
    refetchInterval: 15000,
  })

  const { data: _unassigned } = useQuery({
    queryKey: ['unassigned-deliveries'],
    queryFn: async () => {
      const res = await authFetch('/api/delivery?status=ready')
      if (!res.ok) return []
      return res.json()
    },
  })

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDelivery) return
      const res = await authFetch('/api/delivery-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryInfoId: selectedDelivery.deliveryInfoId,
          driverName, driverPhone, vehicleInfo,
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

  const handleDriverNameChange = useCallback((v: string) => setDriverName(v), [])
  const handleDriverPhoneChange = useCallback((v: string) => setDriverPhone(v), [])
  const handleVehicleInfoChange = useCallback((v: string) => setVehicleInfo(v), [])
  const handleAssignDialogOpenChange = useCallback((open: boolean) => setShowAssignDialog(open), [])
  const handleAssignDriver = useCallback(() => assignMutation.mutate(), [assignMutation])
  const handleUpdateStatus = useCallback((params: { deliveryInfoId: string; status: string }) => updateStatusMutation.mutate(params), [updateStatusMutation])

  return {
    showAssignDialog, setShowAssignDialog,
    selectedDelivery, setSelectedDelivery,
    driverName, driverPhone, vehicleInfo,
    filterStatus, setFilterStatus,
    trackings, isLoading,
    assignMutation, updateStatusMutation,
    getNextStatus,
    activeCount, deliveredCount, avgDeliveryTime,
    handleDriverNameChange, handleDriverPhoneChange, handleVehicleInfoChange,
    handleAssignDialogOpenChange, handleAssignDriver, handleUpdateStatus,
  }
}
