'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { usePOSStore } from '@/lib/store'
import { useState, useMemo, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type TableData, type TableFormData } from './tablemap/constants'

// Lazy-loaded podkomponente
const TableSummaryStats = dynamic(() => import('./tablemap/TableSummaryStats').then(m => ({ default: m.TableSummaryStats })), { ssr: false })
const TableLegend = dynamic(() => import('./tablemap/TableLegend').then(m => ({ default: m.TableLegend })), { ssr: false })
const TableGrid = dynamic(() => import('./tablemap/TableGrid').then(m => ({ default: m.TableGrid })), { ssr: false })
const TableOrdersDialog = dynamic(() => import('./tablemap/TableOrdersDialog').then(m => ({ default: m.TableOrdersDialog })), { ssr: false })
const TableFormDialog = dynamic(() => import('./tablemap/TableFormDialog').then(m => ({ default: m.TableFormDialog })), { ssr: false })
const TableDeleteDialog = dynamic(() => import('./tablemap/TableDeleteDialog').then(m => ({ default: m.TableDeleteDialog })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const TableMap = memo(function TableMap() {
  const queryClient = useQueryClient()
  const { setActiveModule, setSelectedTable, setOrderType, setEditingOrderId, setEditingOrderNumber } = usePOSStore()

  // --- Stanja ---
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTable, setEditingTable] = useState<Record<string, unknown> | null>(null)
  const [formData, setFormData] = useState<TableFormData>({ number: '', capacity: '4', area: 'main', status: 'available' })
  const [selectedTableForOrders, setSelectedTableForOrders] = useState<TableData | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<TableData | null>(null)

  // ============================================
  // QUERIES
  // ============================================

  const { data: tables, isLoading } = useQuery({
    queryKey: queryKeys.tables.all,
    queryFn: async () => {
      const res = await authFetch('/api/tables')
      return res.json()
    },
  })

  // Fetch orders for selected table
  // FIX MEDIUM: Server-side filtering namesto client-side (prepreči nalaganje vseh naročil)
  const { data: tableOrders } = useQuery({
    queryKey: queryKeys.tables.orders(selectedTableForOrders?.id as string),
    queryFn: async () => {
      if (!selectedTableForOrders) return []
      const res = await authFetch(`/api/orders?tableId=${selectedTableForOrders.id}&status=active`)
      const data = await res.json()
      // API lahko vrne array ali objekt z orders poljem
      return Array.isArray(data) ? data : (data.orders || [])
    },
    enabled: !!selectedTableForOrders,
  })

  // ============================================
  // MUTATIONS
  // ============================================

  const createMutation = useMutation({
    mutationFn: async (data: { number: number; capacity: number; area: string; status: string }) => {
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; number: number; capacity: number; area: string; status: string }) => {
      const res = await authFetch(`/api/tables/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Miza posodobljena')
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
      setDialogOpen(false)
      setEditingTable(null)
    },
  })

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
  // OBDELAVA DOGODKOV
  // ============================================

  const openCreate = () => {
    setEditingTable(null)
    setFormData({ number: '', capacity: '4', area: 'main', status: 'available' })
    setDialogOpen(true)
  }

  const openEdit = (table: TableData) => {
    setEditingTable(table)
    setFormData({
      number: String(table.number),
      capacity: String(table.capacity),
      area: String(table.area),
      status: String(table.status),
    })
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    const parsedNumber = parseInt(formData.number)
    const parsedCapacity = parseInt(formData.capacity)
    if (isNaN(parsedNumber) || isNaN(parsedCapacity)) {
      toast.error('Vnesite veljavno številko mize in kapaciteto')
      return
    }
    const payload = {
      number: parsedNumber,
      capacity: parsedCapacity,
      area: formData.area,
      status: formData.status,
    }
    if (editingTable) {
      updateMutation.mutate({ id: editingTable.id as string, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleTableClick = useCallback((table: TableData) => {
    if (table.status === 'occupied') {
      // Show orders for this table
      setSelectedTableForOrders(table)
    } else if (table.status === 'available') {
      // Start new order for this table
      setSelectedTable(table.id as string)
      setOrderType('dine-in')
      setActiveModule('orders')
      toast.info(`Miza ${table.number} izbrana za novo naročilo`)
    }
  }, [setSelectedTable, setOrderType, setActiveModule])

  const handleNewOrderForTable = useCallback((tableId: string, tableNumber: number) => {
    setSelectedTable(tableId)
    setOrderType('dine-in')
    setActiveModule('orders')
    setSelectedTableForOrders(null)
    setEditingOrderId(null)
    setEditingOrderNumber(null)
    toast.info(`Miza ${tableNumber} izbrana za novo naročilo`)
  }, [setSelectedTable, setOrderType, setActiveModule, setEditingOrderId, setEditingOrderNumber])

  const handleAddToOrder = useCallback((orderId: string, orderNumber: number, tableId: string) => {
    setSelectedTable(tableId)
    setOrderType('dine-in')
    setEditingOrderId(orderId)
    setEditingOrderNumber(orderNumber)
    setActiveModule('orders')
    setSelectedTableForOrders(null)
    toast.info(`Dodajanje artiklov k naročilu #${orderNumber}`)
  }, [setSelectedTable, setOrderType, setActiveModule, setEditingOrderId, setEditingOrderNumber])

  // ============================================
  // IZRAČUNI
  // ============================================

  const groupedTables = useMemo(() => (tables || []).reduce((acc: Record<string, TableData[]>, table: Record<string, unknown>) => {
    const area = (table.area as string) || 'main'
    if (!acc[area]) acc[area] = []
    acc[area].push(table as TableData)
    return acc
  }, {} as Record<string, TableData[]>), [tables])

  // Calculate summary stats — memoiziraj, da se ne preračuna ob vsakem renderju
  const { totalTables, occupiedTables, availableTables } = useMemo(() => {
    const all = tables || []
    return {
      totalTables: all.length,
      occupiedTables: all.filter((t: { status: string }) => t.status === 'occupied').length,
      availableTables: all.filter((t: { status: string }) => t.status === 'available').length,
    }
  }, [tables])

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Mize</h2>
          <p className="text-muted-foreground">Upravljajte mize in sedežni red</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj mizo
        </Button>
      </div>

      {/* Povzetek statistike */}
      <TableSummaryStats
        availableTables={availableTables}
        occupiedTables={occupiedTables}
        totalTables={totalTables}
      />

      {/* Legenda statusov */}
      <TableLegend />

      {/* Mreža miz */}
      <TableGrid
        isLoading={isLoading}
        groupedTables={groupedTables}
        onTableClick={handleTableClick}
        onEdit={openEdit}
        onDelete={setDeleteConfirm}
      />

      {/* Dijalog z naročili za mizo */}
      <TableOrdersDialog
        table={selectedTableForOrders}
        orders={tableOrders}
        onOpenChange={() => setSelectedTableForOrders(null)}
        onAddToOrder={handleAddToOrder}
        onNewOrderForTable={handleNewOrderForTable}
      />

      {/* Dijalog za dodajanje/urejanje mize */}
      <TableFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingTable={editingTable}
        formData={formData}
        onFormDataChange={setFormData}
        onSubmit={handleSubmit}
      />

      {/* AlertDialog za brisanje mize — nadomesti window.confirm() */}
      <TableDeleteDialog
        table={deleteConfirm}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null) }}
        onConfirm={() => {
          if (deleteConfirm?.id) {
            deleteMutation.mutate(deleteConfirm.id as string)
          }
          setDeleteConfirm(null)
        }}
      />
    </div>
  )
})
