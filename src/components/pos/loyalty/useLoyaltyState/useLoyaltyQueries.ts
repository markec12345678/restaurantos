'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type LoyaltyAccount } from '../constants'

export function useLoyaltyQueries(tierFilter: string, showInactive: boolean, historyAccount: LoyaltyAccount | null, historyDialogOpen: boolean) {
  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    if (tierFilter !== 'all') params.set('tier', tierFilter)
    if (!showInactive) params.set('isActive', 'true')
    return params.toString()
  }, [tierFilter, showInactive])

  const { data: accounts, isLoading } = useQuery<LoyaltyAccount[]>({
    queryKey: [...queryKeys.loyalty.all, tierFilter, showInactive],
    queryFn: async () => {
      const res = await authFetch(`/api/loyalty?${queryParams}`)
      if (!res.ok) throw new Error('Napaka pri pridobivanju podatkov')
      return res.json()
    },
  })

  const { data: accountDetail, isLoading: isLoadingDetail } = useQuery<LoyaltyAccount>({
    queryKey: [...queryKeys.loyalty.all, historyAccount?.id],
    queryFn: async () => {
      if (!historyAccount) return null
      const res = await authFetch(`/api/loyalty/${historyAccount.id}`)
      if (!res.ok) throw new Error('Napaka pri pridobivanju podatkov')
      return res.json()
    },
    enabled: !!historyAccount && historyDialogOpen,
  })

  return { accounts, isLoading, accountDetail, isLoadingDetail }
}
