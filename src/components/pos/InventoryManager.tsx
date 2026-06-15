'use client'

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { useInventoryState } from './inventory/useInventoryState'

// Lazy-loaded podkomponente
const LowStockAlerts = dynamic(() => import('./inventory/LowStockAlerts').then(m => ({ default: m.LowStockAlerts })), { ssr: false })
const InventoryTabs = dynamic(() => import('./inventory/InventoryTabs').then(m => ({ default: m.InventoryTabs })), { ssr: false })
const ItemDialog = dynamic(() => import('./inventory/ItemDialog').then(m => ({ default: m.ItemDialog })), { ssr: false })
const RestockDialog = dynamic(() => import('./inventory/RestockDialog').then(m => ({ default: m.RestockDialog })), { ssr: false })
const WriteOffDialog = dynamic(() => import('./inventory/WriteOffDialog').then(m => ({ default: m.WriteOffDialog })), { ssr: false })
const DeleteConfirmDialog = dynamic(() => import('./inventory/DeleteConfirmDialog').then(m => ({ default: m.DeleteConfirmDialog })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const InventoryManager = memo(function InventoryManager() {
  const s = useInventoryState()

  return (
    <div className="space-y-6">
      {/* Glava */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Zaloga</h2>
          <p className="text-muted-foreground">Upravljanje zalog, nabave in razknjižbe</p>
        </div>
        <Button onClick={s.openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj artikel
        </Button>
      </div>

      {/* Opozorila nizke zaloge */}
      <LowStockAlerts
        lowStockItems={s.lowStockItems}
        onRestock={s.openRestock}
      />

      {/* GLAVNI ZAVIHKI */}
      <InventoryTabs s={s} />

      {/* DIALOG: UREDI ARTIKEL */}
      <ItemDialog
        open={s.dialogOpen}
        onOpenChange={s.setDialogOpen}
        editingItem={s.editingItem}
        formData={s.formData}
        onFormDataChange={s.setFormData}
        onSubmit={s.handleSubmit}
        menuItems={s.menuItems}
      />

      {/* DIALOG: NABAVA (hitra) */}
      <RestockDialog
        open={s.restockDialogOpen}
        onOpenChange={s.setRestockDialogOpen}
        restockItemId={s.restockItemId}
        items={s.items}
        restockData={s.restockData}
        onRestockDataChange={s.setRestockData}
        onSubmit={s.handleRestock}
        isPending={s.isRestockPending}
      />

      {/* DIALOG: RAZKNJIŽBA (hitra) */}
      <WriteOffDialog
        open={s.writeOffDialogOpen}
        onOpenChange={s.setWriteOffDialogOpen}
        writeOffItemId={s.writeOffItemId}
        items={s.items}
        writeOffData={s.writeOffData}
        onWriteOffDataChange={s.setWriteOffData}
        onSubmit={s.handleWriteOff}
        isPending={s.isWriteOffPending}
      />

      {/* AlertDialog za potrditev brisanja */}
      <DeleteConfirmDialog
        deleteTarget={s.deleteTarget}
        onOpenChange={s.handleDeleteDialogOpenChange}
        onConfirm={s.handleConfirmDelete}
      />
    </div>
  )
})
