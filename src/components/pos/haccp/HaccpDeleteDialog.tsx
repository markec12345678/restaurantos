'use client'

import { memo } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import type { HaccpEntry } from './types'

interface HaccpDeleteDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  deleteTarget: HaccpEntry | null
  onConfirm: () => void
  isPending: boolean
}

export const HaccpDeleteDialog = memo(function HaccpDeleteDialog({
  open,
  onOpenChange,
  deleteTarget,
  onConfirm,
  isPending,
}: HaccpDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Izbriši HACCP vnos</AlertDialogTitle>
          <AlertDialogDescription>
            Ali ste prepričani, da želite izbrisati vnos
            <strong> &bdquo;{deleteTarget?.title}&ldquo;</strong>?
            Tega dejanja ni mogoče razveljaviti.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Prekliči</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Brišem...' : 'Izbriši'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
})
