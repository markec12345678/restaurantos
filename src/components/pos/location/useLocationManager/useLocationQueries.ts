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
      if (!res.ok) return []
      const json = await res.json()
      return Array.isArray(json) ? json : (json.zones ?? [])
    },
    enabled: showZones,
  })

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.locations.all,
    queryFn: async () => {
      const res = await authFetch('/api/locations')
      if (!res.ok) return { locations: [], stats: { total: 0, active: 0, open: 0 } }
      const json = await res.json()
      return Array.isArray(json) ? { locations: json, stats: { total: json.length, active: 0, open: 0 } } : { locations: json.locations ?? [], stats: json.stats ?? { total: 0, active: 0, open: 0 } }
    },
  })

  const locations: LocationData[] = data?.locations || []
  const stats = data?.stats || { total: 0, active: 0, open: 0 }

  return { zonesData, zonesLoading, locations, stats, isLoading }
}
