'use client'

import { memo } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { type InventoryItemData } from './constants'

// --- Props ---

interface DeleteConfirmDialogProps {
  deleteTarget: InventoryItemData | null
  onOpenChange: (_open: boolean) => void
  onConfirm: () => void
}

// --- Komponenta ---

export const DeleteConfirmDialog = memo(function DeleteConfirmDialog({
  deleteTarget,
  onOpenChange,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={!!deleteTarget} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Izbriši artikel zaloge</AlertDialogTitle>
          <AlertDialogDescription>
            Ali ste prepričani, da želite izbrisati <strong>{deleteTarget?.name}</strong>? Ta operacija je nepovratna in bo trajno odstranila artikel iz zaloge.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Prekliči</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Izbriši
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
})
