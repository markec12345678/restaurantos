'use client'

import { useState } from 'react'
import { type FloorTable, type TableFormState, defaultTableForm } from '../constants'
import { useFloorPlanQueries } from './queries'
import { useFloorPlanDrag } from '../useFloorPlanDrag'
import { useFloorPlanMutations } from '../useFloorPlanMutations'
import { useFloorPlanFormActions } from './form-actions'
import { useFloorPlanComputed } from './computed'

// ============================================
// HOOK: Stanje in logika za vizualni tloris — Barrel export
// Izvleče poslovno logiko iz glavne komponente
// ============================================

export function useFloorPlanState() {
  const [editingTable, setEditingTable] = useState<FloorTable | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState<TableFormState>({ ...defaultTableForm })
  const [zoom, _setZoom] = useState(1)

  // --- Queries ---
  const { tables: allTables, isLoading } = useFloorPlanQueries()

  // --- Drag hook ---
  const {
    dragState, selectedTableId, setSelectedTableId, containerRef,
    handleDragStart, handleDragEnd, handleDrag, updateMutation,
  } = useFloorPlanDrag(allTables)

  // --- Mutations ---
  const { createMutation, handleDeleteTable } = useFloorPlanMutations({
    onDialogClose: () => setDialogOpen(false),
    onClearSelectedTableId: () => setSelectedTableId(null),
  })

  // --- Form actions ---
  const {
    openCreate, openEdit, handleSubmit, autoArrange, handleRotateTable,
    handleTableClick, handleDeselect, handleDialogOpenChange,
    handleAreaChange, handleShapeChange, handleStatusChange,
  } = useFloorPlanFormActions({
    editingTable, formData, setEditingTable, setFormData, setDialogOpen,
    setSelectedTableId, updateMutation, createMutation, allTables,
  })

  // --- Computed ---
  const { groupedByArea, tableCounts } = useFloorPlanComputed(allTables)

  return {
    editingTable, dialogOpen, formData, dragState, selectedTableId,
    zoom, containerRef, tables: allTables, isLoading, groupedByArea, tableCounts,
    handleDragStart, handleDragEnd, handleDrag, handleTableClick,
    openCreate, openEdit, handleSubmit, autoArrange, handleRotateTable,
    handleDeleteTable, handleDeselect, handleDialogOpenChange,
    setFormData, handleAreaChange, handleShapeChange, handleStatusChange,
  }
}
