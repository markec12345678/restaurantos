'use client'

import { memo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Lock, AlertTriangle } from 'lucide-react'
import type { CloseDayDialogProps } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// ============================================
// CLOSE DAY DIALOG - Potrditev zaključka dneva
// ============================================
export const CloseDayDialog = memo(function CloseDayDialog({
  open,
  onOpenChange,
  actualCash,
  onActualCashChange,
  eodNotes,
  onEodNotesChange,
  expectedCash,
  startingCash,
  cashSales,
  isPending,
  onConfirm,
}: CloseDayDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="h-5 w-5" />Zaključi dan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              To dejanje ni mogoče razveljaviti. Prepričajte se, da so vsa naročila zaključena in gotovina prešteta.
            </p>
          </div>
          <div>
            <label htmlFor="eod-actual-cash" className="text-sm font-medium mb-1 block">Dejanska gotovina v blagajni (&euro;)</label>
            <Input id="eod-actual-cash" type="number" step="0.01" value={actualCash} onChange={(e) => onActualCashChange(e.target.value)} placeholder="0.00" aria-label="Dejanska gotovina v blagajni" autoFocus />
            {startingCash > 0 || cashSales > 0 ? (
              <p className="text-xs text-muted-foreground mt-1">
                Pričakovano: &euro;{safeToFixed(expectedCash, 2)}
                {' '}(začetna &euro;{safeToFixed(startingCash, 2)} + prodaja &euro;{safeToFixed(cashSales, 2)})
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="eod-notes" className="text-sm font-medium mb-1 block">Opombe</label>
            <Textarea id="eod-notes" value={eodNotes} onChange={(e) => onEodNotesChange(e.target.value)} placeholder="Opombe za zaključek dneva..." rows={3} aria-label="Opombe za zaključek dneva" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onConfirm} disabled={isPending} className="gap-1">
            <Lock className="h-3 w-3" /> Potrdi zaključek
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
