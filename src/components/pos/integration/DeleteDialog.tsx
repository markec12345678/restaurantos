'use client'

import { memo } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import type { DeleteDialogProps } from './constants'

// ============================================
// DIJALOG ZA BRISANJE INTEGRACIJE
// ============================================

export const DeleteDialog = memo(function DeleteDialog({
  open,
  onOpenChange,
  deleteTarget,
  onConfirm,
}: DeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Izbriši integracijo</AlertDialogTitle>
          <AlertDialogDescription>
            Ali ste prepričani, da želite izbrisati integracijo <strong>&bdquo;{deleteTarget?.name}&ldquo;</strong>? Vsi povezani dnevniki bodo izbrisani. Tega dejanja ni mogoče razveljaviti.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Prekliči</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Izbriši
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
})
