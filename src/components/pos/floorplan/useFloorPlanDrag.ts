'use client'

// ============================================
// HOOK: Vlečenje miz po tlorisu (drag & drop)
// Izvleče drag logiko iz useFloorPlanState
// ============================================

import { useState, useRef, useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type FloorTable, type DragState } from './constants'

export function useFloorPlanDrag(tables: FloorTable[]) {
  const queryClient = useQueryClient()
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Posodobitev mize (za drag-drop pozicije)
  const updateMutation = useMutationForDrag()

  const handleDragStart = useCallback((id: string, e: React.MouseEvent) => {
    const table = tables.find(t => t.id === id)
    if (!table) return
    setDragState({
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: table.posX,
      origY: table.posY,
    })
    setSelectedTableId(id)
  }, [tables])

  const handleDrag = useCallback((id: string, deltaX: number, deltaY: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const deltaXPercent = (deltaX / rect.width) * 100
    const deltaYPercent = (deltaY / rect.height) * 100
    const table = tables.find(t => t.id === id)
    if (!table || !dragState) return
    const newX = Math.max(0, Math.min(92, dragState.origX + deltaXPercent))
    const newY = Math.max(0, Math.min(90, dragState.origY + deltaYPercent))
    // Optimistic update
    queryClient.setQueryData<FloorTable[]>(queryKeys.tables.all, old => {
      if (!old) return old
      return old.map(t => t.id === id ? { ...t, posX: newX, posY: newY } : t)
    })
  }, [tables, dragState, queryClient])

  const handleDragEnd = useCallback(() => {
    if (!dragState) return
    const table = tables.find(t => t.id === dragState.id)
    if (table) {
      updateMutation.mutate({
        id: table.id,
        number: table.number,
        capacity: table.capacity,
        area: table.area,
        status: table.status,
        posX: table.posX,
        posY: table.posY,
        width: table.width,
        height: table.height,
        shape: table.shape,
        rotation: table.rotation,
      })
    }
    setDragState(null)
  }, [dragState, tables, updateMutation])

  // Globalni mouse move/up za vlečenje
  useEffect(() => {
    if (!dragState) return
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX
      const deltaY = e.clientY - dragState.startY
      handleDrag(dragState.id, deltaX, deltaY)
    }
    const handleMouseUp = () => {
      handleDragEnd()
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState, handleDrag, handleDragEnd])

  return {
    dragState,
    selectedTableId,
    setSelectedTableId,
    containerRef,
    handleDragStart,
    handleDragEnd,
    handleDrag,
    updateMutation,
  }
}

// ============================================
// POMOŽNI HOOK: Mutacija za posodobitev mize
// ============================================

import { useMutation } from '@tanstack/react-query'

function useMutationForDrag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const id = data.id as string
      const res = await authFetch(`/api/tables/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
    },
  })
}
