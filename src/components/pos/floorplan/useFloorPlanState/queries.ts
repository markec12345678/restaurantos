'use client'

import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type FloorTable } from '../constants'

// ============================================
// QUERIES: Pridobivanje podatkov o mizah za tloris
// ============================================

export function useFloorPlanQueries() {
  const { data: tables, isLoading } = useQuery<FloorTable[]>({
    queryKey: queryKeys.tables.all,
    queryFn: async () => {
      const res = await authFetch('/api/tables')
      if (!res.ok) return []
      const json = await res.json()
      return Array.isArray(json) ? json : (json.tables ?? [])
    },
  })

  return { tables: tables || [], isLoading }
}
