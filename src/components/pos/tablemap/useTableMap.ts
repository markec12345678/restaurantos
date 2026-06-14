'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { usePOSStore } from '@/lib/store'
import { useState, useMemo, useCallback } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type TableData, type TableFormData } from './constants'

// ============================================
// HOOK: Upravljanje miz
// Združuje poizvedbe, mutacije in handlerje
// ============================================

export function useTableMap() {
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

  const { data: tableOrders } = useQuery({
    queryKey: queryKeys.tables.orders(selectedTableForOrders?.id as string),
    queryFn: async () => {
      if (!selectedTableForOrders) return []
      const res = await authFetch(`/api/orders?tableId=${selectedTableForOrders.id}&status=active`)
      const data = await res.json()
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
      setSelectedTableForOrders(table)
    } else if (table.status === 'available') {
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

  const { totalTables, occupiedTables, availableTables } = useMemo(() => {
    const all = tables || []
    return {
      totalTables: all.length,
      occupiedTables: all.filter((t: { status: string }) => t.status === 'occupied').length,
      availableTables: all.filter((t: { status: string }) => t.status === 'available').length,
    }
  }, [tables])

  return {
    // Stanja
    dialogOpen,
    setDialogOpen,
    editingTable,
    formData,
    setFormData,
    selectedTableForOrders,
    setSelectedTableForOrders,
    deleteConfirm,
    setDeleteConfirm,

    // Nalaganje
    isLoading,

    // Podatki
    groupedTables,
    tableOrders,
    totalTables,
    occupiedTables,
    availableTables,

    // Mutacije
    deleteMutation,

    // Handlerji
    openCreate,
    openEdit,
    handleSubmit,
    handleTableClick,
    handleNewOrderForTable,
    handleAddToOrder,
  }
}
