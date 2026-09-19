'use client'

import { memo } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ShieldAlert } from 'lucide-react'
import { canDeleteLoyaltyAccount } from '@/lib/loyalty-guard'
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
// RUNDA 69: client-side guard iz ISTEGA lib-a kot API (ENOTEN VIR). Račun z
// transakcijami ali točkami → onemogočen gumb + razlaga "deaktivirajte
// namesto brisanja". POPRAVLJEN LAŽEN TEXT: prej je dialog trdil, da "bodo
// vse transakcije izbrisane" — resnica: transakcije so fiskalna zgodovina
// (FK Restrict) in brisanje je prav zato blokirano.

export const LoyaltyDeleteDialog = memo(function LoyaltyDeleteDialog({
  open,
  deleteTarget,
  isPending,
  onOpenChange,
  onConfirm,
}: LoyaltyDeleteDialogProps) {
  const decision = deleteTarget
    ? canDeleteLoyaltyAccount(deleteTarget.transactions?.length ?? 0, deleteTarget.pointsBalance)
    : null
  const blocked = !!decision && !decision.allowed

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Izbriši zvestobni račun</AlertDialogTitle>
          <AlertDialogDescription>
            Ali ste prepričani, da želite izbrisati račun {deleteTarget?.customerName || 'Brez imena'}?
            {!blocked && ' Račun je brez zgodovine točk, zato je izbris varen.'}
            {' '}Tega dejanja ni mogoče razveljaviti.
            {blocked && decision && (
              <span className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive dark:text-red-300" role="alert">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span className="font-medium">{decision.messageSl}</span>
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Prekliči</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
            disabled={isPending || blocked}
            aria-disabled={blocked || undefined}
          >
            {isPending ? 'Brišem...' : blocked ? 'Brisanje blokirano' : 'Izbriši'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
})
