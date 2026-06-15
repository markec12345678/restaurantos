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
      return res.json()
    },
  })

  const allIntegrations = Array.isArray(integrations) ? integrations : []

  return { allIntegrations, isLoading }
}
