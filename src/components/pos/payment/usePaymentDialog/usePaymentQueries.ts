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
      const data = await res.json(); return Array.isArray(data) ? data : (data.items || data.employees || data.jobs || data.shifts || data.entries || data.recipes || data.menuItems || data.transactions || data.suppliers || data.giftCards || data.locations || data.categories || data.menus || data.accounts || data.invoices || data.logs || data.haccpEntries || data.orders || data.payments || data.receipts || data.tables || data.loyaltyAccounts || [])
    },
    enabled: open,
  })

  // Naloži darilne kartice
  const { data: giftCards } = useQuery({
    queryKey: queryKeys.giftCards.all,
    queryFn: async () => {
      const res = await authFetch('/api/gift-cards')
      if (!res.ok) return []
      const data = await res.json(); return Array.isArray(data) ? data : (data.items || data.employees || data.jobs || data.shifts || data.entries || data.recipes || data.menuItems || data.transactions || data.suppliers || data.giftCards || data.locations || data.categories || data.menus || data.accounts || data.invoices || data.logs || data.haccpEntries || data.orders || data.payments || data.receipts || data.tables || data.loyaltyAccounts || [])
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
      const data = await res.json(); return Array.isArray(data) ? data : (data.items || data.employees || data.jobs || data.shifts || data.entries || data.recipes || data.menuItems || data.transactions || data.suppliers || data.giftCards || data.locations || data.categories || data.menus || data.accounts || data.invoices || data.logs || data.haccpEntries || data.orders || data.payments || data.receipts || data.tables || data.loyaltyAccounts || [])
    },
    enabled: open && loyaltySearch.length >= 2, // RUNDA 42: search živ v VSIH tabih (earn attach)
  })

  // RUNDA 42: loyalty konfiguracija (global — Location override rešuje backend
  // ob plačilu; tukaj samo za UI preview in točen pointsUsed izračun)
  const { data: loyaltyConfig } = useQuery({
    queryKey: ['settings', 'loyalty-config'],
    queryFn: async () => {
      const res = await authFetch('/api/settings')
      if (!res.ok) return null
      const d = await res.json()
      return {
        enabled: !!d.loyaltyEnabled,
        pointsPerEuro: Number(d.loyaltyPointsPerEuro) > 0 ? Number(d.loyaltyPointsPerEuro) : 1,
        pointsValue: Number(d.loyaltyPointsValue) > 0 ? Number(d.loyaltyPointsValue) : 0.01,
      }
    },
    enabled: open,
    staleTime: 60_000,
  })

  return {
    altPayments: altPayments || [],
    giftCards: giftCards || [],
    loyaltyResults: loyaltyResults || [],
    // RUNDA 42: loyalty konfiguracija — earn-preview (+N točk) v plačilnem
    // dialogu in točen izračun loyaltyPointsUsed (pointsValue). 60s staleTime:
    // settings se redko spreminjajo, dialog se odpira pogosto.
    loyaltyConfig,
  }
}
