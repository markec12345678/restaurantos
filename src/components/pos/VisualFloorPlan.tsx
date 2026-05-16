'use client'

// ============================================
// VIZUALNI TLORIS RESTAVRACIJE (Visual Floor Plan)
// Drag-and-drop postavitev miz — kar imata Toast in TouchBistro
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import {
  Plus, Pencil, Trash2, Users, RotateCw, Maximize2,
  ChevronLeft, ChevronRight, Square, Circle, LayoutGrid
} from 'lucide-react'
import { useState, useRef, useCallback, useEffect } from 'react'
import { format } from 'date-fns'

// ============================================
// TIPI
// ============================================

interface FloorTable {
  id: string
  number: number
  capacity: number
  status: string
  area: string
  posX: number
  posY: number
  width: number
  height: number
  shape: string
  rotation: number
  revenueCenterId: string | null
}

// ============================================
// KONSTANTE
// ============================================

const statusColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  available: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-400 dark:border-emerald-600',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  occupied: {
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-400 dark:border-red-600',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
  },
  reserved: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-400 dark:border-amber-600',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  cleaning: {
    bg: 'bg-gray-50 dark:bg-gray-900/40',
    border: 'border-gray-400 dark:border-gray-600',
    text: 'text-gray-600 dark:text-gray-400',
    dot: 'bg-gray-400',
  },
}

const statusLabels: Record<string, string> = {
  available: 'Prosta',
  occupied: 'Zasedena',
  reserved: 'Rezervirana',
  cleaning: 'Čiščenje',
}

const areaLabels: Record<string, string> = {
  main: 'Glavna dvorana',
  patio: 'Terasa',
  bar: 'Bar',
  private: 'Zasebni prostor',
}

const shapeIcons: Record<string, React.ReactNode> = {
  round: <Circle className="h-4 w-4" />,
  square: <Square className="h-4 w-4" />,
  rectangular: <LayoutGrid className="h-4 w-4" />,
  booth: <Users className="h-4 w-4" />,
}

// ============================================
// KOMPONENTA ZA POSAMEZNO MIZO NA TLORISU
// ============================================

function FloorTableItem({
  table,
  onDragStart,
  onDragEnd,
  onDrag,
  onClick,
  isDragging,
  isSelected,
  zoom,
}: {
  table: FloorTable
  onDragStart: (id: string, e: React.MouseEvent) => void
  onDragEnd: () => void
  onDrag: (id: string, deltaX: number, deltaY: number) => void
  onClick: (table: FloorTable) => void
  isDragging: boolean
  isSelected: boolean
  zoom: number
}) {
  const colors = statusColors[table.status] || statusColors.available
  const shapeClass = table.shape === 'round' ? 'rounded-full' : table.shape === 'booth' ? 'rounded-2xl' : 'rounded-lg'

  return (
    <div
      className={`absolute cursor-move touch-manipulation select-none transition-shadow ${shapeClass} ${colors.bg} border-2 ${colors.border} ${isDragging ? 'shadow-2xl z-50 opacity-90' : 'shadow-md hover:shadow-lg z-10'} ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''} flex flex-col items-center justify-center`}
      style={{
        left: `${table.posX}%`,
        top: `${table.posY}%`,
        width: `${table.width}%`,
        height: `${table.height}%`,
        transform: `rotate(${table.rotation}deg)`,
        minWidth: '60px',
        minHeight: '50px',
      }}
      onMouseDown={(e) => {
        e.preventDefault()
        onDragStart(table.id, e)
      }}
      onMouseUp={onDragEnd}
      onClick={() => onClick(table)}
    >
      {/* Status dot */}
      <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full ${colors.dot} ${table.status === 'occupied' ? 'animate-pulse' : ''} z-20`} />

      {/* Table number */}
      <span className={`text-lg font-bold ${colors.text} leading-none`}>{table.number}</span>

      {/* Capacity */}
      <span className={`text-[10px] ${colors.text} opacity-70 flex items-center gap-0.5`}>
        <Users className="h-2.5 w-2.5" />
        {table.capacity}
      </span>

      {/* Status label for occupied/reserved */}
      {(table.status === 'occupied' || table.status === 'reserved') && (
        <span className={`text-[8px] font-semibold ${colors.text} mt-0.5`}>
          {statusLabels[table.status]}
        </span>
      )}
    </div>
  )
}

// ============================================
// GLAVNA KOMPONENTA VIZUALNEGA TLORISA
// ============================================

export function VisualFloorPlan() {
  const queryClient = useQueryClient()
  const [editingTable, setEditingTable] = useState<FloorTable | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    number: '', capacity: '4', area: 'main', status: 'available',
    shape: 'round', width: '8', height: '10',
  })
  const [dragState, setDragState] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch tables
  const { data: tables, isLoading } = useQuery<FloorTable[]>({
    queryKey: ['tables'],
    queryFn: async () => {
      const res = await authFetch('/api/tables')
      return res.json()
    },
  })

  // Update table mutation (for drag-drop position updates)
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
      queryClient.invalidateQueries({ queryKey: ['tables'] })
    },
  })

  // Create mutation
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
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      setDialogOpen(false)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/tables/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Miza izbrisana')
      queryClient.invalidateQueries({ queryKey: ['tables'] })
    },
  })

  // Drag handlers
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
    queryClient.setQueryData<FloorTable[]>(['tables'], old => {
      if (!old) return old
      return old.map(t => t.id === id ? { ...t, posX: newX, posY: newY } : t)
    })
  }, [tables, dragState, queryClient])

  const handleDragEnd = useCallback(() => {
    if (!dragState) return
    const table = (tables || []).find(t => t.id === dragState.id)
    if (table) {
      // Save new position
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

  // Global mouse move/up for drag
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

  const openCreate = () => {
    setEditingTable(null)
    setFormData({ number: '', capacity: '4', area: 'main', status: 'available', shape: 'round', width: '8', height: '10' })
    setDialogOpen(true)
  }

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

  const handleTableClick = (table: FloorTable) => {
    setSelectedTableId(table.id)
  }

  // Auto-arrange tables in grid
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

  const groupedByArea = (tables || []).reduce((acc: Record<string, FloorTable[]>, table) => {
    const area = table.area || 'main'
    if (!acc[area]) acc[area] = []
    acc[area].push(table)
    return acc
  }, {})

  const totalTables = (tables || []).length
  const occupiedCount = (tables || []).filter(t => t.status === 'occupied').length
  const availableCount = (tables || []).filter(t => t.status === 'available').length
  const reservedCount = (tables || []).filter(t => t.status === 'reserved').length

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* HEADER */}
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

      {/* FLOOR PLAN */}
      <div className="flex-1 overflow-auto p-4">
        <div
          ref={containerRef}
          className="relative w-full bg-muted/30 border-2 border-dashed border-muted-foreground/20 rounded-xl min-h-[500px]"
          style={{ aspectRatio: '16/10' }}
        >
          {/* Grid lines for alignment */}
          <div className="absolute inset-0 opacity-10">
            {[...Array(10)].map((_, i) => (
              <div key={`v${i}`} className="absolute top-0 bottom-0 border-r border-muted-foreground" style={{ left: `${(i + 1) * 10}%` }} />
            ))}
            {[...Array(10)].map((_, i) => (
              <div key={`h${i}`} className="absolute left-0 right-0 border-b border-muted-foreground" style={{ top: `${(i + 1) * 10}%` }} />
            ))}
          </div>

          {/* Area labels */}
          {Object.entries(groupedByArea).map(([area, areaTables]) => {
            if (areaTables.length === 0) return null
            const minX = Math.min(...areaTables.map(t => t.posX))
            const minY = Math.min(...areaTables.map(t => t.posY))
            return (
              <div
                key={area}
                className="absolute text-xs font-semibold text-muted-foreground/40 pointer-events-none z-0"
                style={{ left: `${minX}%`, top: `${Math.max(0, minY - 3)}%` }}
              >
                {areaLabels[area] || area}
              </div>
            )
          })}

          {/* Tables */}
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Nalaganje...</p>
            </div>
          ) : (tables || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
              <LayoutGrid className="h-16 w-16 opacity-20" />
              <div className="text-center">
                <p className="text-lg font-medium">Tloris je prazen</p>
                <p className="text-sm">Dodajte mize in jih razporedite z vlečenjem</p>
              </div>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Dodaj prvo mizo</Button>
            </div>
          ) : (
            (tables || []).map(table => (
              <TooltipProvider key={table.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <FloorTableItem
                        table={table}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDrag={handleDrag}
                        onClick={handleTableClick}
                        isDragging={dragState?.id === table.id}
                        isSelected={selectedTableId === table.id}
                        zoom={zoom}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <p className="font-bold">Miza {table.number}</p>
                      <p>{table.capacity} mest · {statusLabels[table.status]}</p>
                      <p className="text-muted-foreground">{areaLabels[table.area] || table.area} · {table.shape}</p>
                      <p className="text-muted-foreground mt-1">Kliknite za urejanje · Povlecite za premik</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))
          )}
        </div>
      </div>

      {/* FOOTER - Selected table actions */}
      {selectedTableId && (
        <div className="flex-shrink-0 border-t bg-card px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {(() => {
              const sel = (tables || []).find(t => t.id === selectedTableId)
              if (!sel) return null
              const colors = statusColors[sel.status] || statusColors.available
              return (
                <>
                  <Badge className={`${colors.bg} ${colors.border} ${colors.text} border`}>
                    Miza {sel.number}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{sel.capacity} mest · {statusLabels[sel.status]}</span>
                </>
              )
            })()}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const sel = (tables || []).find(t => t.id === selectedTableId)
              if (sel) openEdit(sel)
            }}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Uredi
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const sel = (tables || []).find(t => t.id === selectedTableId)
              if (sel) updateMutation.mutate({
                id: sel.id, number: sel.number, capacity: sel.capacity, area: sel.area,
                status: sel.status, posX: sel.posX, posY: sel.posY, width: sel.width,
                height: sel.height, shape: sel.shape, rotation: (sel.rotation + 45) % 360,
              })
            }}>
              <RotateCw className="h-3.5 w-3.5 mr-1.5" /> Zavrti
            </Button>
            <Button variant="destructive" size="sm" onClick={() => {
              if (selectedTableId) {
                deleteMutation.mutate(selectedTableId)
                setSelectedTableId(null)
              }
            }}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Izbriši
            </Button>
          </div>
        </div>
      )}

      {/* ADD/EDIT DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) setEditingTable(null); setDialogOpen(open) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-primary" />
              {editingTable ? `Uredi mizo ${editingTable.number}` : 'Dodaj mizo'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Številka mize</label>
                <Input type="number" value={formData.number} onChange={e => setFormData({ ...formData, number: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Kapaciteta</label>
                <Input type="number" value={formData.capacity} onChange={e => setFormData({ ...formData, capacity: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Območje</label>
                <Select value={formData.area} onValueChange={v => setFormData({ ...formData, area: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">Glavna dvorana</SelectItem>
                    <SelectItem value="patio">Terasa</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="private">Zasebni prostor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Oblika</label>
                <Select value={formData.shape} onValueChange={v => setFormData({ ...formData, shape: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round">Okrogla</SelectItem>
                    <SelectItem value="square">Kvadratna</SelectItem>
                    <SelectItem value="rectangular">Pravokotna</SelectItem>
                    <SelectItem value="booth">Loža</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Širina (%)</label>
                <Input type="number" value={formData.width} onChange={e => setFormData({ ...formData, width: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Višina (%)</label>
                <Input type="number" value={formData.height} onChange={e => setFormData({ ...formData, height: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Prosta</SelectItem>
                  <SelectItem value="occupied">Zasedena</SelectItem>
                  <SelectItem value="reserved">Rezervirana</SelectItem>
                  <SelectItem value="cleaning">Čiščenje</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Prekliči</Button>
            <Button onClick={handleSubmit} disabled={!formData.number}>
              {editingTable ? 'Posodobi' : <><Plus className="h-4 w-4 mr-1.5" />Ustvari</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
