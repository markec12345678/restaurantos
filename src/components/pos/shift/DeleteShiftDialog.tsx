'use client'

import { memo } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DeleteShiftDialogProps } from './constants'

// ============================================
// DIJALOG ZA BRISANJE IZMENE
// ============================================

export const DeleteShiftDialog = memo(function DeleteShiftDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: DeleteShiftDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Izbriši izmeno</AlertDialogTitle>
          <AlertDialogDescription>
            Ali ste prepričani, da želite izbrisati to izmeno? Tega dejanja ni mogoče razveljaviti.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Prekliči</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Izbriši
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
})
