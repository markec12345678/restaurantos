'use client'

import { memo } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { type GiftCard, formatCurrency } from './constants'

// --- Props ---

interface DeleteCardDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  target: GiftCard | null
  onConfirm: () => void
  isPending: boolean
}

// --- Komponenta ---

export const DeleteCardDialog = memo(function DeleteCardDialog({
  open,
  onOpenChange,
  target,
  onConfirm,
  isPending,
}: DeleteCardDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Izbriši darilno kartico</AlertDialogTitle>
          <AlertDialogDescription>
            Ali ste prepričani, da želite izbrisati kartico
            <strong> &bdquo;{target?.cardNumber}&ldquo;</strong>
            {target?.ownerName ? ` (${target.ownerName})` : ''}?
            {target && target.balance > 0 && (
              <span className="block mt-2 text-amber-600 dark:text-amber-400 font-medium">
                Opozorilo: Kartica ima še {formatCurrency(target.balance)} stanja!
              </span>
            )}
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
