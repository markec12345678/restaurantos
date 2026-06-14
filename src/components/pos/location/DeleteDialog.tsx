'use client'

import { memo } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import type { DeleteDialogProps } from './constants'

// Potrditveno okno za brisanje — dostopno za bralnike zaslona
export const DeleteDialog = memo(function DeleteDialog({
  deleteConfirm,
  onOpenChange,
  onConfirmDelete,
}: DeleteDialogProps) {
  return (
    <AlertDialog open={!!deleteConfirm} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{deleteConfirm?.type === 'zone' ? 'Izbriši cono' : 'Izbriši lokacijo'}</AlertDialogTitle>
          <AlertDialogDescription>
            Ali ste prepričani, da želite izbrisati {deleteConfirm?.type === 'zone' ? 'cono' : 'lokacijo'} &quot;{deleteConfirm?.name || ''}&quot;? Tega dejanja ni mogoče razveljaviti.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Prekliči</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirmDelete}
          >
            Izbriši
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
})
