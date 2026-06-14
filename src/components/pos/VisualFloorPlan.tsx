'use client'
// ============================================
// VIZUALNI TLORIS RESTAVRACIJE (Visual Floor Plan)
// Drag-and-drop postavitev miz — kar imata Toast in TouchBistro
// ============================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { Plus, LayoutGrid } from 'lucide-react'
import { useState, useRef, useCallback, useEffect, memo, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { FloorTable, DragState, TableFormState } from './floorplan/constants'
import { defaultTableForm } from './floorplan/constants'

// Lenčasično nalaganje podkomponent — izboljša začetni čas nalaganja
const FloorPlanCanvas = dynamic(() => import('./floorplan/FloorPlanCanvas').then(m => m.FloorPlanCanvas), { ssr: false })
const SelectedTableFooter = dynamic(() => import('./floorplan/SelectedTableFooter').then(m => m.SelectedTableFooter), { ssr: false })
const TableDialog = dynamic(() => import('./floorplan/TableDialog').then(m => m.TableDialog), { ssr: false })

export const VisualFloorPlan = memo(function VisualFloorPlan() {
  const queryClient = useQueryClient()
  const [editingTable, setEditingTable] = useState<FloorTable | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState<TableFormState>(defaultTableForm)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [zoom, _setZoom] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  // Pridobivanje miz
  const { data: tables, isLoading } = useQuery<FloorTable[]>({
    queryKey: queryKeys.tables.all,
    queryFn: async () => {
      const res = await authFetch('/api/tables')
      return res.json()
    },
  })

  // Posodobitev mize (za drag-drop posodobitve pozicije)
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

  // Ustvarjanje mize
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

  // Brisanje mize
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

  // Upravljanje vlečenja — začetek
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

  // Upravljanje vlečenja — premikanje
  const handleDrag = useCallback((id: string, deltaX: number, deltaY: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const deltaXPercent = (deltaX / rect.width) * 100
    const deltaYPercent = (deltaY / rect.height) * 100
    const table = (tables || []).find(t => t.id === id)
    if (!table || !dragState) return
    const newX = Math.max(0, Math.min(92, dragState.origX + deltaXPercent))
    const newY = Math.max(0, Math.min(90, dragState.origY + deltaYPercent))
    // Optimistična posodobitev
    queryClient.setQueryData<FloorTable[]>(queryKeys.tables.all, old => {
      if (!old) return old
      return old.map(t => t.id === id ? { ...t, posX: newX, posY: newY } : t)
    })
  }, [tables, dragState, queryClient])

  // Upravljanje vlečenja — konec
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

  // Globalni miškin premik/spust za vlečenje
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

  // Odpre dialog za ustvarjanje
  const openCreate = () => {
    setEditingTable(null)
    setFormData(defaultTableForm)
    setDialogOpen(true)
  }

  // Odpre dialog za urejanje
  const openEdit = (table: FloorTable) => {
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
  }

  // Pošiljanje obrazca mize
  const handleSubmit = () => {
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
  }

  // Klik na mizo
  const handleTableClick = (table: FloorTable) => {
    setSelectedTableId(table.id)
  }

  // Samodejna razporeditev miz v mrežo
  const autoArrange = () => {
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
  }

  // Vrtenje mize
  const handleRotateTable = useCallback((table: FloorTable) => {
    updateMutation.mutate({
      id: table.id, number: table.number, capacity: table.capacity, area: table.area,
      status: table.status, posX: table.posX, posY: table.posY, width: table.width,
      height: table.height, shape: table.shape, rotation: (table.rotation + 45) % 360,
    })
  }, [updateMutation])

  // Brisanje mize
  const handleDeleteTable = useCallback((id: string) => {
    deleteMutation.mutate(id)
  }, [deleteMutation])

  // Memoizirano grupiranje po območjih — ne prerčunava na vsakem renderju
  const groupedByArea = useMemo(() => (tables || []).reduce((acc: Record<string, FloorTable[]>, table) => {
    const area = table.area || 'main'
    if (!acc[area]) acc[area] = []
    acc[area].push(table)
    return acc
  }, {}), [tables])

  // Memoizirani števci — prepreči ponavljajoče filtriranje na vsakem renderju
  const tableCounts = useMemo(() => {
    const all = tables || []
    return {
      total: all.length,
      occupied: all.filter(t => t.status === 'occupied').length,
      available: all.filter(t => t.status === 'available').length,
      reserved: all.filter(t => t.status === 'reserved').length,
    }
  }, [tables])

  const _totalTables = tableCounts.total
  const occupiedCount = tableCounts.occupied
  const availableCount = tableCounts.available
  const reservedCount = tableCounts.reserved

  // Upravljanje dialoga — onOpenChange namesto setState v useEffect
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

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* GLAVA */}
      <div className="flex-shrink-0 border-b bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutGrid className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Tloris restavracije</h2>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs h-6">
                <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5" />
                {availableCount} prostih
              </Badge>
              <Badge variant="outline" className="text-xs h-6">
                <span className="h-2 w-2 rounded-full bg-red-500 mr-1.5" />
                {occupiedCount} zasedenih
              </Badge>
              <Badge variant="outline" className="text-xs h-6">
                <span className="h-2 w-2 rounded-full bg-amber-500 mr-1.5" />
                {reservedCount} rezerviranih
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={autoArrange}>
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
              Samodejna postavitev
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Dodaj mizo
            </Button>
          </div>
        </div>
      </div>

      {/* TLORIS */}
      <FloorPlanCanvas
        tables={tables || []}
        isLoading={isLoading}
        dragState={dragState}
        selectedTableId={selectedTableId}
        zoom={zoom}
        groupedByArea={groupedByArea}
        containerRef={containerRef}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDrag={handleDrag}
        onTableClick={handleTableClick}
        onOpenCreate={openCreate}
      />

      {/* NOGA — Dejanja za izbrano mizo */}
      <SelectedTableFooter
        tables={tables || []}
        selectedTableId={selectedTableId}
        onOpenEdit={openEdit}
        onRotateTable={handleRotateTable}
        onDeleteTable={handleDeleteTable}
        onDeselect={() => setSelectedTableId(null)}
      />

      {/* DIALOG ZA DODAJANJE/UREJANJE MIZE */}
      <TableDialog
        dialogOpen={dialogOpen}
        editingTable={editingTable}
        formData={formData}
        onOpenChange={handleDialogOpenChange}
        onSetFormData={setFormData}
        onSubmit={handleSubmit}
        onAreaChange={handleAreaChange}
        onShapeChange={handleShapeChange}
        onStatusChange={handleStatusChange}
      />
    </div>
  )
})
