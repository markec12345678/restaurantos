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
      const data = await res.json(); return Array.isArray(data) ? data : (data.items || data.employees || data.jobs || data.shifts || data.entries || data.recipes || data.menuItems || data.transactions || data.suppliers || data.giftCards || data.locations || data.categories || data.menus || data.accounts || data.invoices || data.logs || data.haccpEntries || data.orders || data.payments || data.receipts || data.tables || data.loyaltyAccounts || [])
    },
    enabled: showZones,
  })

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.locations.all,
    queryFn: async () => {
      const res = await authFetch('/api/locations')
      if (!res.ok) return { locations: [], stats: { total: 0, active: 0, open: 0 } }
      const data = await res.json()
      return Array.isArray(data) ? { locations: data, stats: { total: data.length, active: 0, open: 0 } } : { locations: data.locations || [], stats: data.stats || { total: 0, active: 0, open: 0 } }
    },
  })

  const locations: LocationData[] = data?.locations || []
  const stats = data?.stats || { total: 0, active: 0, open: 0 }

  return { zonesData, zonesLoading, locations, stats, isLoading }
}
