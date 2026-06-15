'use client'

import { useMemo } from 'react'
import { type TableData } from '../constants'

// ============================================
// IZRAČUNI: Gručenje in statistika miz
// ============================================

export function useTableComputed(tables: TableData[] | undefined): { groupedTables: Record<string, TableData[]>; totalTables: number; occupiedTables: number; availableTables: number } {
  const groupedTables = useMemo(() => (tables || []).reduce((acc: Record<string, TableData[]>, table: TableData) => {
    const area = table.area || 'main'
    if (!acc[area]) acc[area] = []
    acc[area].push(table as TableData)
    return acc
  }, {} as Record<string, TableData[]>), [tables])

  const { totalTables, occupiedTables, availableTables } = useMemo(() => {
    const all = tables || []
    return {
      totalTables: all.length,
      occupiedTables: all.filter((t: { status: string }) => t.status === 'occupied').length,
      availableTables: all.filter((t: { status: string }) => t.status === 'available').length,
    }
  }, [tables])

  return { groupedTables, totalTables, occupiedTables, availableTables }
}
