'use client'

import { Button } from '@/components/ui/button'
import { Plus, Printer } from 'lucide-react'
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { usePrinterManager } from './printer/usePrinterManager'

// Lazy-loaded pod-komponente
const StatsCards = dynamic(() => import('./printer/StatsCards').then(m => ({ default: m.StatsCards })), { ssr: false })
const PrinterGrid = dynamic(() => import('./printer/PrinterGrid').then(m => ({ default: m.PrinterGrid })), { ssr: false })
const PrinterDialog = dynamic(() => import('./printer/PrinterDialog').then(m => ({ default: m.PrinterDialog })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const PrinterManager = memo(function PrinterManager() {
  const {
    search, setSearch,
    dialogOpen,
    editingPrinter,
    formData, setFormData,
    printerStatus,
    printers, isLoading,
    stats,
    createMutation, updateMutation, deleteMutation,
    testConnectivity, openCreate, openEdit,
    handleSubmit, toggleActive, handleDialogOpenChange,
  } = usePrinterManager()

  return (
    <div className="space-y-6">
      {/* Glava */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Printer className="h-6 w-6" />
            Tiskalniki
          </h2>
          <p className="text-muted-foreground">Upravljajte omrežne tiskalnike in pravila tiskanja</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj tiskalnik
        </Button>
      </div>

      {/* Povzetek kartice */}
      <StatsCards
        total={stats.total}
        active={stats.active}
        kitchen={stats.kitchen}
        receipt={stats.receipt}
      />

      {/* Iskanje in seznam tiskalnikov */}
      <PrinterGrid
        printers={printers || []}
        search={search}
        isLoading={isLoading}
        printerStatus={printerStatus}
        onSearchChange={setSearch}
        onEdit={openEdit}
        onDelete={(id) => deleteMutation.mutate(id)}
        onTestConnectivity={testConnectivity}
        onToggleActive={toggleActive}
      />

      {/* Dijalog za dodajanje/urejanje */}
      <PrinterDialog
        open={dialogOpen}
        editingPrinter={editingPrinter}
        formData={formData}
        onOpenChange={handleDialogOpenChange}
        onFormDataChange={setFormData}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  )
})
