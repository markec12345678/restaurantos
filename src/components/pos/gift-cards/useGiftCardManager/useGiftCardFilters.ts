'use client'

import { useState, useCallback } from 'react'

// ============================================
// Filtri in sortiranje za darilne kartice
// ============================================

export type SortField = 'purchasedAt' | 'balance' | 'cardNumber'
export type SortDir = 'asc' | 'desc'

export interface UseGiftCardFiltersReturn {
  search: string
  statusFilter: string
  sortField: SortField
  sortDir: SortDir
  setSearch: (_v: string) => void
  setStatusFilter: (_v: string) => void
  handleSort: (_field: SortField) => void
}

export function useGiftCardFilters(): UseGiftCardFiltersReturn {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortField, setSortField] = useState<SortField>('purchasedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }, [sortField, sortDir])

  return { search, statusFilter, sortField, sortDir, setSearch, setStatusFilter, handleSort }
}
