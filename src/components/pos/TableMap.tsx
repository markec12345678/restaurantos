'use client'

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { useTableMap } from './tablemap/useTableMap'

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
  const {
    dialogOpen, setDialogOpen,
    editingTable,
    formData, setFormData,
    selectedTableForOrders, setSelectedTableForOrders,
    deleteConfirm, setDeleteConfirm,
    isLoading,
    groupedTables, tableOrders,
    totalTables, occupiedTables, availableTables,
    deleteMutation,
    openCreate, openEdit, handleSubmit,
    handleTableClick, handleNewOrderForTable, handleAddToOrder,
  } = useTableMap()

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

      {/* AlertDialog za brisanje mize */}
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
