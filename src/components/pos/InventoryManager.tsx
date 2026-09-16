'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, AlertTriangle, Wallet } from 'lucide-react'
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { useInventoryState } from './inventory/useInventoryState'
import { safeToFixed } from '@/lib/safe-format'

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
      {/* Glava — NOVO (QA 2026-09-17): responsive wrap + hitri filter nizkih
          zalog + KPI vrednost zaloge za upravitelja */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Zaloga</h2>
          <p className="text-muted-foreground">Upravljanje zalog, nabave in razknjižbe</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="gap-1.5 border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-semibold tabular-nums"
            title="Skupna vrednost zaloge (količina × nabavna cena)"
          >
            <Wallet className="h-4 w-4 text-primary" />
            Vrednost zaloge: €{safeToFixed(s.inventoryValue, 2)}
          </Badge>
          <Button
            variant={s.lowStockOnly ? 'destructive' : 'outline'}
            size="sm"
            className="gap-1.5"
            aria-pressed={s.lowStockOnly}
            title={s.lowStockOnly ? 'Prikaži vse artikle' : 'Prikaži samo artikle pod/naj min. zalogo'}
            onClick={() => s.setLowStockOnly(!s.lowStockOnly)}
          >
            <AlertTriangle className="h-4 w-4" />
            Nizke zaloge
            {s.lowStockItems.length > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-destructive-foreground">
                {s.lowStockItems.length}
              </span>
            )}
          </Button>
          <Button onClick={s.openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Dodaj artikel
          </Button>
        </div>
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
