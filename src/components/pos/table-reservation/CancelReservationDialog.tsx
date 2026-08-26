'use client'

import { memo } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import type { CancelReservationDialogProps } from './constants'

// ============================================
// PREKLIC REZERVACIJE — ALERT DIALOG
// ============================================
export const CancelReservationDialog = memo(function CancelReservationDialog({
  cancelTarget,
  onOpenChange,
  onConfirm,
}: CancelReservationDialogProps) {
  return (
    <AlertDialog open={!!cancelTarget} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Prekliči rezervacijo</AlertDialogTitle>
          <AlertDialogDescription>
            Ali ste prepričani, da želite preklicati rezervacijo za {cancelTarget?.name || ''}? Tega dejanja ni mogoče razveljaviti.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Ne, obdrži</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Da, prekliči
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
})
