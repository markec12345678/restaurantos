'use client'

import { memo } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import type { DeleteDialogProps } from './constants'

// ============================================
// DIJALOG ZA BRISANJE SPLETNE KLJUKE
// ============================================

export const DeleteDialog = memo(function DeleteDialog({
  open,
  deleteTarget,
  onOpenChange,
  onConfirm,
}: DeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Izbriši spletno kljuko</AlertDialogTitle>
          <AlertDialogDescription>
            Ali ste prepričani, da želite izbrisati spletno kljuko <strong>&bdquo;{deleteTarget?.name}&ldquo;</strong>? Tega dejanja ni mogoče razveljaviti.
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
