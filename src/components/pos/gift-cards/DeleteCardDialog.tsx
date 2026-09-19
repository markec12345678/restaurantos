'use client'

import { memo } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ShieldAlert } from 'lucide-react'
import { canDeleteGiftCard } from '@/lib/gift-card-guard'
import { type GiftCard } from './constants'

// --- Props ---

interface DeleteCardDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  target: GiftCard | null
  onConfirm: () => void
  isPending: boolean
}

// --- Komponenta ---
// RUNDA 69: client-side guard iz ISTEGA lib-a kot API (ENOTEN VIR, vzorec
// R66–R68). Kartica z transakcijami ali stanjem > 0 → onemogočen gumb + razlaga
// (prej: gumb vedno "delal", ampak API je vrnil 405/409 — mrtvi tok).

export const DeleteCardDialog = memo(function DeleteCardDialog({
  open,
  onOpenChange,
  target,
  onConfirm,
  isPending,
}: DeleteCardDialogProps) {
  const decision = target
    ? canDeleteGiftCard(target.transactions?.length ?? 0, target.balance)
    : null
  const blocked = !!decision && !decision.allowed

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Izbriši darilno kartico</AlertDialogTitle>
          <AlertDialogDescription>
            Ali ste prepričani, da želite izbrisati kartico
            <strong> &bdquo;{target?.cardNumber}&ldquo;</strong>
            {target?.ownerName ? ` (${target.ownerName})` : ''}?
            {target && target.balance > 0 && !blocked && (
              <span className="block mt-2 text-amber-600 dark:text-amber-400 font-medium">
                Opozorilo: Kartica ima še {target.balance.toFixed(2)} € stanja!
              </span>
            )}
            {blocked && decision && (
              <span className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive dark:text-red-300" role="alert">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span className="font-medium">{decision.messageSl}</span>
              </span>
            )}
            {!blocked && 'Tega dejanja ni mogoče razveljaviti.'}
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
