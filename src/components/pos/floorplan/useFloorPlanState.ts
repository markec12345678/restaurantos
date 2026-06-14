'use client'
// ============================================
// HOOK: Stanje in logika za vizualni tloris
// Izvleče poslovno logiko iz glavne komponente
// ============================================

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type FloorTable, type DragState, type TableFormState, defaultTableForm } from './constants'

export function useFloorPlanState() {
  const queryClient = useQueryClient()
  const [editingTable, setEditingTable] = useState<FloorTable | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState<TableFormState>({ ...defaultTableForm })
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [zoom, _setZoom] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  // ============================================
  // QUERIES
  // ============================================

  const { data: tables, isLoading } = useQuery<FloorTable[]>({
    queryKey: queryKeys.tables.all,
    queryFn: async () => {
      const res = await authFetch('/api/tables')
      return res.json()
    },
  })

  // ============================================
  // MUTATIONS
  // ============================================

  // Posodobitev mize (za drag-drop pozicije)
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Record<string, unknown>) => {
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

  // Ustvari mizo
  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/tables', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Miza ustvarjena')
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
      setDialogOpen(false)
    },
  })

  // Izbriši mizo
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/tables/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Miza izbrisana')
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
    },
  })

  // ============================================
  // DRAG HANDLERJI
  // ============================================

  const handleDragStart = useCallback((id: string, e: React.MouseEvent) => {
    const table = (tables || []).find(t => t.id === id)
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
    const table = (tables || []).find(t => t.id === id)
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
    const table = (tables || []).find(t => t.id === dragState.id)
    if (table) {
      // Shrani novo pozicijo
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

  // ============================================
  // OBRAZEC IN DEJANJA
  // ============================================

  const openCreate = useCallback(() => {
    setEditingTable(null)
    setFormData({ ...defaultTableForm })
    setDialogOpen(true)
  }, [])

  const openEdit = useCallback((table: FloorTable) => {
    setEditingTable(table)
    setFormData({
      number: String(table.number),
      capacity: String(table.capacity),
      area: table.area,
      status: table.status,
      shape: table.shape,
      width: String(table.width),
      height: String(table.height),
    })
    setDialogOpen(true)
  }, [])

  const handleSubmit = useCallback(() => {
    const payload = {
      number: parseInt(formData.number),
      capacity: parseInt(formData.capacity),
      area: formData.area,
      status: formData.status,
      shape: formData.shape,
      width: parseFloat(formData.width),
      height: parseFloat(formData.height),
      posX: editingTable?.posX || Math.random() * 70 + 5,
      posY: editingTable?.posY || Math.random() * 70 + 5,
      rotation: editingTable?.rotation || 0,
    }
    if (editingTable) {
      updateMutation.mutate({ id: editingTable.id, ...payload })
      setDialogOpen(false)
    } else {
      createMutation.mutate(payload)
    }
  }, [formData, editingTable, updateMutation, createMutation])

  const handleTableClick = useCallback((table: FloorTable) => {
    setSelectedTableId(table.id)
  }, [])

  // Samodejna razporeditev miz v mrežo
  const autoArrange = useCallback(() => {
    const allTables = tables || []
    const cols = Math.ceil(Math.sqrt(allTables.length))
    allTables.forEach((table, i) => {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = col * (90 / cols) + 2
      const y = row * (85 / Math.ceil(allTables.length / cols)) + 2
      updateMutation.mutate({
        id: table.id,
        number: table.number,
        capacity: table.capacity,
        area: table.area,
        status: table.status,
        posX: x,
        posY: y,
        width: table.width,
        height: table.height,
        shape: table.shape,
        rotation: table.rotation,
      })
    })
    toast.success('Mize samodejno razporejene')
  }, [tables, updateMutation])

  const handleRotateTable = useCallback((table: FloorTable) => {
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
      rotation: (table.rotation + 45) % 360,
    })
  }, [updateMutation])

  const handleDeleteTable = useCallback((id: string) => {
    deleteMutation.mutate(id)
    setSelectedTableId(null)
  }, [deleteMutation])

  const handleDeselect = useCallback(() => {
    setSelectedTableId(null)
  }, [])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setEditingTable(null)
    setDialogOpen(open)
  }, [])

  const handleAreaChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, area: value }))
  }, [])

  const handleShapeChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, shape: value }))
  }, [])

  const handleStatusChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, status: value }))
  }, [])

  // ============================================
  // IZRAČUNI
  // ============================================

  // Memoizirano grupiranje po območjih
  const groupedByArea = useMemo(() => (tables || []).reduce((acc: Record<string, FloorTable[]>, table) => {
    const area = table.area || 'main'
    if (!acc[area]) acc[area] = []
    acc[area].push(table)
    return acc
  }, {}), [tables])

  // Memoizirani števci
  const tableCounts = useMemo(() => {
    const all = tables || []
    return {
      total: all.length,
      occupied: all.filter(t => t.status === 'occupied').length,
      available: all.filter(t => t.status === 'available').length,
      reserved: all.filter(t => t.status === 'reserved').length,
    }
  }, [tables])

  return {
    // Stanja
    editingTable,
    dialogOpen,
    formData,
    dragState,
    selectedTableId,
    zoom,
    containerRef,
    tables: tables || [],
    isLoading,
    groupedByArea,
    tableCounts,
    // Handlerji
    handleDragStart,
    handleDragEnd,
    handleDrag,
    handleTableClick,
    openCreate,
    openEdit,
    handleSubmit,
    autoArrange,
    handleRotateTable,
    handleDeleteTable,
    handleDeselect,
    handleDialogOpenChange,
    setFormData,
    handleAreaChange,
    handleShapeChange,
    handleStatusChange,
  }
}
