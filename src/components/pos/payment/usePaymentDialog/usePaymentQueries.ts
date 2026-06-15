'use client'

import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'

export function usePaymentQueries(open: boolean, paymentMethod: string, loyaltySearch: string) {
  // Naloži alternativna plačila
  const { data: altPayments } = useQuery({
    queryKey: ['alt-payment-types'],
    queryFn: async () => {
      const res = await authFetch('/api/configuration/alt-payment-types')
      if (!res.ok) return []
      return res.json()
    },
    enabled: open,
  })

  // Naloži darilne kartice
  const { data: giftCards } = useQuery({
    queryKey: queryKeys.giftCards.all,
    queryFn: async () => {
      const res = await authFetch('/api/gift-cards')
      if (!res.ok) return []
      return res.json()
    },
    enabled: open && paymentMethod === 'giftcard',
  })

  // Išči zvestobni račun
  const { data: loyaltyResults } = useQuery({
    queryKey: queryKeys.loyalty.search(loyaltySearch),
    queryFn: async () => {
      if (!loyaltySearch || loyaltySearch.length < 2) return []
      const res = await authFetch(`/api/loyalty?search=${encodeURIComponent(loyaltySearch)}`)
      if (!res.ok) return []
      return res.json()
    },
    enabled: open && paymentMethod === 'loyalty' && loyaltySearch.length >= 2,
  })

  return {
    altPayments: altPayments || [],
    giftCards: giftCards || [],
    loyaltyResults: loyaltyResults || [],
  }
}
