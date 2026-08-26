'use client'

import { useState } from 'react'
import { type TableData, type TableFormData } from '../constants'
import { useTableQueries } from './queries'
import { useTableMutations } from './mutations'
import { useTableHandlers } from './handlers'
import { useTableComputed } from './computed'

// ============================================
// HOOK: Upravljanje miz — Barrel export
// Združuje poizvedbe, mutacije in handlerje
// ============================================

export function useTableMap() {
  // --- Stanja ---
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTable, setEditingTable] = useState<Record<string, unknown> | null>(null)
  const [formData, setFormData] = useState<TableFormData>({ number: '', capacity: '4', area: 'main', status: 'available' })
  const [selectedTableForOrders, setSelectedTableForOrders] = useState<TableData | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<TableData | null>(null)

  // --- Queries ---
  const { tables, isLoading, tableOrders } = useTableQueries(selectedTableForOrders)

  // --- Mutations ---
  const { createMutation, updateMutation, deleteMutation } = useTableMutations(setDialogOpen, setEditingTable)

  // --- Handlers ---
  const { openCreate, openEdit, handleSubmit, handleTableClick, handleNewOrderForTable, handleAddToOrder } = useTableHandlers({
    setEditingTable, setFormData, setDialogOpen, setSelectedTableForOrders,
    editingTable, formData,
    createMutate: createMutation.mutate,
    updateMutate: updateMutation.mutate,
  })

  // --- Computed ---
  const { groupedTables, totalTables, occupiedTables, availableTables } = useTableComputed(tables)

  return {
    // Stanja
    dialogOpen, setDialogOpen,
    editingTable,
    formData, setFormData,
    selectedTableForOrders, setSelectedTableForOrders,
    deleteConfirm, setDeleteConfirm,
    // Nalaganje
    isLoading,
    // Podatki
    groupedTables, tableOrders, totalTables, occupiedTables, availableTables,
    // Mutacije
    deleteMutation,
    // Handlerji
    openCreate, openEdit, handleSubmit, handleTableClick, handleNewOrderForTable, handleAddToOrder,
  }
}
