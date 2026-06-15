'use client'

import React, { useCallback } from 'react'
import { toast } from 'sonner'
import { type FloorTable, type TableFormState } from '../constants'

// ============================================
// OBRAZEC IN DEJANJA: Ustvari, uredi, rotiraj, razporedi
// ============================================

interface FormActionsDeps {
  editingTable: FloorTable | null
  formData: TableFormState
  setEditingTable: (_table: FloorTable | null) => void
  setFormData: React.Dispatch<React.SetStateAction<TableFormState>>
  setDialogOpen: (_open: boolean) => void
  setSelectedTableId: (_id: string | null) => void
  updateMutation: { mutate: (_data: Record<string, unknown>) => void }
  createMutation: { mutate: (_data: Record<string, unknown>) => void }
  allTables: FloorTable[]
}

export function useFloorPlanFormActions(deps: FormActionsDeps) {
  const {
    editingTable, formData, setEditingTable, setFormData, setDialogOpen,
    setSelectedTableId, updateMutation, createMutation, allTables,
  } = deps

  const openCreate = useCallback(() => {
    setEditingTable(null)
    setFormData({ number: '', capacity: '4', area: 'main', status: 'available', shape: 'round', width: '60', height: '60' })
    setDialogOpen(true)
  }, [setEditingTable, setFormData, setDialogOpen])

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
  }, [setEditingTable, setFormData, setDialogOpen])

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
  }, [formData, editingTable, updateMutation, createMutation, setDialogOpen])

  const autoArrange = useCallback(() => {
    const cols = Math.ceil(Math.sqrt(allTables.length))
    allTables.forEach((table, i) => {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = col * (90 / cols) + 2
      const y = row * (85 / Math.ceil(allTables.length / cols)) + 2
      updateMutation.mutate({
        id: table.id, number: table.number, capacity: table.capacity,
        area: table.area, status: table.status, posX: x, posY: y,
        width: table.width, height: table.height, shape: table.shape, rotation: table.rotation,
      })
    })
    toast.success('Mize samodejno razporejene')
  }, [allTables, updateMutation])

  const handleRotateTable = useCallback((table: FloorTable) => {
    updateMutation.mutate({
      id: table.id, number: table.number, capacity: table.capacity,
      area: table.area, status: table.status, posX: table.posX, posY: table.posY,
      width: table.width, height: table.height, shape: table.shape,
      rotation: (table.rotation + 45) % 360,
    })
  }, [updateMutation])

  const handleTableClick = useCallback((table: FloorTable) => {
    setSelectedTableId(table.id)
  }, [setSelectedTableId])

  const handleDeselect = useCallback(() => {
    setSelectedTableId(null)
  }, [setSelectedTableId])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setEditingTable(null)
    setDialogOpen(open)
  }, [setEditingTable, setDialogOpen])

  const handleAreaChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, area: value }))
  }, [setFormData])

  const handleShapeChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, shape: value }))
  }, [setFormData])

  const handleStatusChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, status: value }))
  }, [setFormData])

  return {
    openCreate, openEdit, handleSubmit, autoArrange, handleRotateTable,
    handleTableClick, handleDeselect, handleDialogOpenChange,
    handleAreaChange, handleShapeChange, handleStatusChange,
  }
}
