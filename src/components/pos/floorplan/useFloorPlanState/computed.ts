'use client'

import { useMemo } from 'react'
import { type FloorTable } from '../constants'

// ============================================
// IZRAČUNI: Gručenje po območju, statistika
// ============================================

export function useFloorPlanComputed(allTables: FloorTable[]) {
  const groupedByArea = useMemo(() => allTables.reduce((acc: Record<string, FloorTable[]>, table) => {
    const area = table.area || 'main'
    if (!acc[area]) acc[area] = []
    acc[area].push(table)
    return acc
  }, {}), [allTables])

  const tableCounts = useMemo(() => ({
    total: allTables.length,
    occupied: allTables.filter(t => t.status === 'occupied').length,
    available: allTables.filter(t => t.status === 'available').length,
    reserved: allTables.filter(t => t.status === 'reserved').length,
  }), [allTables])

  return { groupedByArea, tableCounts }
}
