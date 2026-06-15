'use client'

import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type LocationData } from '../constants'

export function useLocationQueries(showZones: boolean) {
  const { data: zonesData, isLoading: zonesLoading } = useQuery({
    queryKey: queryKeys.delivery.zones,
    queryFn: async () => {
      const res = await authFetch('/api/delivery-zones')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
    enabled: showZones,
  })

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

  return { zonesData, zonesLoading, locations, stats, isLoading }
}
