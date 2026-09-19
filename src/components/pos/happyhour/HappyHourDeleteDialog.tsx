'use client'

import { memo } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { type HappyHourSchedule } from './types'

// --- Props ---

interface HappyHourDeleteDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  target: HappyHourSchedule | null
  onConfirm: () => void
  isPending: boolean
}

// --- Komponenta ---
// RUNDA 69: potrditveni dialog za izbris Happy Hour urnika. Prej je izbris
// tekel TAKO ob kliku (brez potrditve) — in je bil poleg tega tih lažen
// uspeh (200 HTML). Leaf model → hard delete je varen, potrditev pa je
// hišni standard za vsak destruktiven klik.

export const HappyHourDeleteDialog = memo(function HappyHourDeleteDialog({
  open,
  onOpenChange,
  target,
  onConfirm,
  isPending,
}: HappyHourDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Izbriši Happy Hour urnik</AlertDialogTitle>
          <AlertDialogDescription>
            Ali ste prepričani, da želite izbrisati urnik
            <strong> &bdquo;{target?.name}&ldquo;</strong>
            {target?.priceGroup ? ` (cenik: ${target.priceGroup.name})` : ''}?
            Artikli in ceniki ostanejo nespremenjeni — izbriše se samo urnik avtomatskih popustov.
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
