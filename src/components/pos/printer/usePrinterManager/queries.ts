'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { API_BASE, parsePrintRules } from '../constants'
import type { PrinterItem } from '../constants'

// ============================================
// HOOK: Poizvedbe za tiskalnike
// ============================================

export function usePrinterQueries() {
  const [search, setSearch] = useState('')
  const { data: printers, isLoading } = useQuery<PrinterItem[]>({
    queryKey: queryKeys.configuration.byTab('printers'),
    queryFn: async () => {
      const res = await authFetch(API_BASE)
      return res.json()
    },
  })

  const stats = useMemo(() => {
    const list = printers || []
    const active = list.filter(p => p.isActive).length
    const kitchen = list.filter(p => {
      const rules = parsePrintRules(p.printRules)
      return rules.some(r => r.type === 'order' || r.type === 'prepStationOrder')
    }).length
    const receipt = list.filter(p => {
      const rules = parsePrintRules(p.printRules)
      return rules.some(r => r.type === 'receipt')
    }).length
    return { total: list.length, active, kitchen, receipt }
  }, [printers])

  return { search, setSearch, printers, isLoading, stats }
}
