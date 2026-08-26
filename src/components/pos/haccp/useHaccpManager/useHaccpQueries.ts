import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { formatDateSI, isToday } from '../utils'
import type { HaccpEntry } from '../types'

export function useHaccpQueries(activeTab: string, dateFrom: string, dateTo: string) {
  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    if (activeTab !== 'all') params.set('category', activeTab)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    return params.toString()
  }, [activeTab, dateFrom, dateTo])

  const { data: entries, isLoading } = useQuery<HaccpEntry[]>({
    queryKey: [...queryKeys.haccp.all, activeTab, dateFrom, dateTo],
    queryFn: async () => {
      const res = await authFetch(`/api/haccp?${queryParams}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      const data = await res.json(); return Array.isArray(data) ? data : (data.items || data.employees || data.jobs || data.shifts || data.entries || data.recipes || data.menuItems || data.transactions || data.suppliers || data.giftCards || data.locations || data.categories || data.menus || data.accounts || data.invoices || data.logs || data.haccpEntries || data.orders || data.payments || data.receipts || data.tables || data.loyaltyAccounts || [])
    },
  })

  const allEntries = Array.isArray(entries) ? entries : []

  const filteredEntries = useMemo(() => allEntries.filter((entry) =>
    entry.title.toLowerCase().includes('') ||
    entry.description.toLowerCase().includes('') ||
    entry.employeeName.toLowerCase().includes('')
  ), [allEntries]) // search filter applied at handler level

  const todayEntries = useMemo(() => allEntries.filter((e) => isToday(e.date)), [allEntries])
  const warningCount = useMemo(() => allEntries.filter((e) => e.status === 'warning').length, [allEntries])
  const criticalCount = useMemo(() => allEntries.filter((e) => e.status === 'critical').length, [allEntries])
  const lastEntryTime = allEntries.length > 0
    ? formatDateSI(allEntries[0].createdAt)
    : 'Ni vnosov'

  return {
    allEntries,
    filteredEntries,
    todayEntries,
    warningCount,
    criticalCount,
    lastEntryTime,
    isLoading,
  }
}
