'use client'

import { memo } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { type TableData } from './constants'

// --- Props ---

interface TableDeleteDialogProps {
  table: TableData | null
  onOpenChange: (_open: boolean) => void
  onConfirm: () => void
}

// --- Komponenta: AlertDialog za brisanje mize ---

export const TableDeleteDialog = memo(function TableDeleteDialog({
  table,
  onOpenChange,
  onConfirm,
}: TableDeleteDialogProps) {
  return (
    <AlertDialog open={!!table} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Izbriši mizo</AlertDialogTitle>
          <AlertDialogDescription>
            Ali ste prepričani, da želite izbrisati mizo {String(table?.number)}?
            {table?.status === 'occupied' && (
              <span className="block mt-1 text-destructive font-medium">Miza je zasedena!</span>
            )}
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
