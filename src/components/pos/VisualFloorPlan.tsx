'use client'
// ============================================
// VIZUALNI TLORIS RESTAVRACIJE (Visual Floor Plan)
// Drag-and-drop postavitev miz — kar imata Toast in TouchBistro
// ============================================
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { useFloorPlanState } from './floorplan/useFloorPlanState'

// Lazy-loaded podkomponente
const FloorPlanHeader = dynamic(() => import('./floorplan/FloorPlanHeader').then(m => ({ default: m.FloorPlanHeader })), { ssr: false })
const FloorPlanCanvas = dynamic(() => import('./floorplan/FloorPlanCanvas').then(m => ({ default: m.FloorPlanCanvas })), { ssr: false })
const SelectedTableFooter = dynamic(() => import('./floorplan/SelectedTableFooter').then(m => ({ default: m.SelectedTableFooter })), { ssr: false })
const TableDialog = dynamic(() => import('./floorplan/TableDialog').then(m => ({ default: m.TableDialog })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA VIZUALNEGA TLORISA
// ============================================
export const VisualFloorPlan = memo(function VisualFloorPlan() {
  const {
    editingTable,
    dialogOpen,
    formData,
    dragState,
    selectedTableId,
    zoom,
    containerRef,
    tables,
    isLoading,
    groupedByArea,
    tableCounts,
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
  } = useFloorPlanState()

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* GLAVA */}
      <FloorPlanHeader
        availableCount={tableCounts.available}
        occupiedCount={tableCounts.occupied}
        reservedCount={tableCounts.reserved}
        onAutoArrange={autoArrange}
        onOpenCreate={openCreate}
      />

      {/* TLORIS */}
      <FloorPlanCanvas
        tables={tables}
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
        tables={tables}
        selectedTableId={selectedTableId}
        onOpenEdit={openEdit}
        onRotateTable={handleRotateTable}
        onDeleteTable={handleDeleteTable}
        onDeselect={handleDeselect}
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
