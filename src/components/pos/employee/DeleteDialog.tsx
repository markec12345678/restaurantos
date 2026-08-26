'use client'

import { memo } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import type { DeleteDialogProps } from './constants'

// ============================================
// DIJALOG BRISANJA — Potrditev brisanja zaposlenega
// FIX A11Y: AlertDialog namesto window.confirm() — dostopno tudi za bralnike zaslona
// ============================================

export const DeleteDialog = memo(function DeleteDialog({ open, deleteTarget, onOpenChange, onConfirm }: DeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Izbriši zaposlenega</AlertDialogTitle>
          <AlertDialogDescription>
            Ali ste prepričani, da želite izbrisati zaposlenega {deleteTarget?.name ? String(deleteTarget.name) : ''}? Tega dejanja ni mogoče razveljaviti.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Prekliči</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Izbriši
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
})
