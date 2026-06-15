'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { usePOSStore } from '@/lib/store'
import { type TableData, type TableFormData } from '../constants'
import type { UseMutateFunction } from '@tanstack/react-query'

// ============================================
// HANDLERJI: Obdelava dogodkov za mize
// ============================================

interface HandlerDeps {
  setEditingTable: (_table: Record<string, unknown> | null) => void
  setFormData: (_data: TableFormData) => void
  setDialogOpen: (_open: boolean) => void
  setSelectedTableForOrders: (_table: TableData | null) => void
  editingTable: Record<string, unknown> | null
  formData: TableFormData
  createMutate: UseMutateFunction<unknown, Error, { number: number; capacity: number; area: string; status: string }>
  updateMutate: UseMutateFunction<unknown, Error, { id: string; number: number; capacity: number; area: string; status: string }>
}

export function useTableHandlers(deps: HandlerDeps) {
  const { setActiveModule, setSelectedTable, setOrderType, setEditingOrderId, setEditingOrderNumber } = usePOSStore()

  const openCreate = useCallback(() => {
    deps.setEditingTable(null)
    deps.setFormData({ number: '', capacity: '4', area: 'main', status: 'available' })
    deps.setDialogOpen(true)
  }, [deps])

  const openEdit = useCallback((table: TableData) => {
    deps.setEditingTable(table)
    deps.setFormData({
      number: String(table.number),
      capacity: String(table.capacity),
      area: String(table.area),
      status: String(table.status),
    })
    deps.setDialogOpen(true)
  }, [deps])

  const handleSubmit = useCallback(() => {
    const parsedNumber = parseInt(deps.formData.number)
    const parsedCapacity = parseInt(deps.formData.capacity)
    if (isNaN(parsedNumber) || isNaN(parsedCapacity)) {
      toast.error('Vnesite veljavno številko mize in kapaciteto')
      return
    }
    const payload = {
      number: parsedNumber,
      capacity: parsedCapacity,
      area: deps.formData.area,
      status: deps.formData.status,
    }
    if (deps.editingTable) {
      deps.updateMutate({ id: deps.editingTable.id as string, ...payload })
    } else {
      deps.createMutate(payload)
    }
  }, [deps])

  const handleTableClick = useCallback((table: TableData) => {
    if (table.status === 'occupied') {
      deps.setSelectedTableForOrders(table)
    } else if (table.status === 'available') {
      setSelectedTable(table.id as string)
      setOrderType('dine-in')
      setActiveModule('orders')
      toast.info(`Miza ${table.number} izbrana za novo naročilo`)
    }
  }, [deps, setSelectedTable, setOrderType, setActiveModule])

  const handleNewOrderForTable = useCallback((tableId: string, tableNumber: number) => {
    setSelectedTable(tableId)
    setOrderType('dine-in')
    setActiveModule('orders')
    deps.setSelectedTableForOrders(null)
    setEditingOrderId(null)
    setEditingOrderNumber(null)
    toast.info(`Miza ${tableNumber} izbrana za novo naročilo`)
  }, [deps, setSelectedTable, setOrderType, setActiveModule, setEditingOrderId, setEditingOrderNumber])

  const handleAddToOrder = useCallback((orderId: string, orderNumber: number, tableId: string) => {
    setSelectedTable(tableId)
    setOrderType('dine-in')
    setEditingOrderId(orderId)
    setEditingOrderNumber(orderNumber)
    setActiveModule('orders')
    deps.setSelectedTableForOrders(null)
    toast.info(`Dodajanje artiklov k naročilu #${orderNumber}`)
  }, [deps, setSelectedTable, setOrderType, setActiveModule, setEditingOrderId, setEditingOrderNumber])

  return { openCreate, openEdit, handleSubmit, handleTableClick, handleNewOrderForTable, handleAddToOrder }
}
