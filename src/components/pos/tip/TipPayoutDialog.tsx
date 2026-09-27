'use client'

// ============================================
// R145-c (epic #115 #32) — TipPayoutDialog
// Potrditveni dialog za izplačilo tip poola (povzetek: datum + skupaj +
// število distribucij). Vzorec po modulu: Dialog, kot TipGenerateDialog
// (modul prej NI uporabljal AlertDialog — hišno pravilo: pattern iz istega
// modula). PII kanon: NIKOLI phone/email — samo ime-free agregati
// (datum/znesek/števec) in število distribucij.
// ============================================

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Banknote } from 'lucide-react'
import { format } from 'date-fns'
import type { TipPoolData } from './constants'
import { formatCurrency } from './constants'

interface TipPayoutDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  pool: TipPoolData | null
  onConfirm: () => void
  isPending: boolean
}

export const TipPayoutDialog = memo(function TipPayoutDialog({
  open,
  onOpenChange,
  pool,
  onConfirm,
  isPending,
}: TipPayoutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Izplačaj napitnine</DialogTitle>
          <DialogDescription>
            Potrdi izplačilo distribuiranih napitnin. Tega dejanja ni mogoče razveljaviti.
          </DialogDescription>
        </DialogHeader>
        {pool && (
          <div className="space-y-1 py-2 text-sm" aria-label="Povzetek izplačila">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Datum:</span>
              <span className="font-medium">{format(new Date(pool.date), 'd. MM. yyyy')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Skupaj:</span>
              <span className="font-medium">{formatCurrency(pool.totalTips)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Distribucij:</span>
              <span className="font-medium">{pool.distributions.length}</span>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onConfirm} disabled={isPending} aria-label="Potrdi izplačilo">
            <Banknote className="h-4 w-4 mr-2" />
            {isPending ? 'Izplačujem...' : 'Izplačaj'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
