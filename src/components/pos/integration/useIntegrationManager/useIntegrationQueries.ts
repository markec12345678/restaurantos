import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { IntegrationItem } from '../constants'

export function useIntegrationQueries() {
  const { data: integrations, isLoading } = useQuery<IntegrationItem[]>({
    queryKey: queryKeys.integrations.all,
    queryFn: async () => {
      const res = await authFetch('/api/integrations')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      const data = await res.json(); return Array.isArray(data) ? data : (data.items || data.employees || data.jobs || data.shifts || data.entries || data.recipes || data.menuItems || data.transactions || data.suppliers || data.giftCards || data.locations || data.categories || data.menus || data.accounts || data.invoices || data.logs || data.haccpEntries || data.orders || data.payments || data.receipts || data.tables || data.loyaltyAccounts || [])
    },
  })

  const allIntegrations = Array.isArray(integrations) ? integrations : []

  return { allIntegrations, isLoading }
}
