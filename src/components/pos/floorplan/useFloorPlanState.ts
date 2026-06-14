'use client'
// ============================================
// HOOK: Stanje in logika za vizualni tloris
// Izvleče poslovno logiko iz glavne komponente
// ============================================

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type FloorTable, type TableFormState, defaultTableForm } from './constants'
import { useFloorPlanDrag } from './useFloorPlanDrag'

export function useFloorPlanState() {
  const queryClient = useQueryClient()
  const [editingTable, setEditingTable] = useState<FloorTable | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState<TableFormState>({ ...defaultTableForm })
  const [zoom, _setZoom] = useState(1)

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

  const allTables = tables || []

  // ============================================
  // DRAG HOOK (iz useFloorPlanDrag)
  // ============================================

  const {
    dragState,
    selectedTableId,
    setSelectedTableId,
    containerRef,
    handleDragStart,
    handleDragEnd,
    handleDrag,
    updateMutation,
  } = useFloorPlanDrag(allTables)

  // ============================================
  // DODATNE MUTACIJE
  // ============================================

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
  }, [setSelectedTableId])

  // Samodejna razporeditev miz v mrežo
  const autoArrange = useCallback(() => {
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
  }, [allTables, updateMutation])

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
  }, [deleteMutation, setSelectedTableId])

  const handleDeselect = useCallback(() => {
    setSelectedTableId(null)
  }, [setSelectedTableId])

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

  return {
    // Stanja
    editingTable,
    dialogOpen,
    formData,
    dragState,
    selectedTableId,
    zoom,
    containerRef,
    tables: allTables,
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
