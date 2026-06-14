'use client'

import { memo } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { type LoyaltyAccount } from './constants'

// --- Props ---

interface LoyaltyDeleteDialogProps {
  open: boolean
  deleteTarget: LoyaltyAccount | null
  isPending: boolean
  onOpenChange: (_open: boolean) => void
  onConfirm: () => void
}

// --- Komponenta ---

export const LoyaltyDeleteDialog = memo(function LoyaltyDeleteDialog({
  open,
  deleteTarget,
  isPending,
  onOpenChange,
  onConfirm,
}: LoyaltyDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Izbriši zvestobni račun</AlertDialogTitle>
          <AlertDialogDescription>
            Ali ste prepričani, da želite izbrisati račun {deleteTarget?.customerName || 'Brez imena'}? Vse transakcije bodo prav tako izbrisane. Tega dejanja ni mogoče razveljaviti.
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
