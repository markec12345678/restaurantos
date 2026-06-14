'use client'

// ═══════════════════════════════════════════════════════════════
// DIALOG ZA ZAKLJUČEK DNEVA — potrditev in vnos gotovine
// ═══════════════════════════════════════════════════════════════

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2 } from 'lucide-react'
import { formatCurrency } from './constants'
import type { ZReportCloseDialogProps } from './constants'

export const ZReportCloseDialog = memo(function ZReportCloseDialog({
  open, onOpenChange, report, actualCash, onActualCashChange,
  closeNotes, onCloseNotesChange, onFinalize, isPending,
}: ZReportCloseDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-amber-500" />
            Zaključi dan — Z-Report
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Vnos dejanskega stanja gotovine */}
          <div>
            <label htmlFor="zreport-actual-cash" className="text-sm font-medium">Dejansko stanje gotovine</label>
            <Input
              id="zreport-actual-cash"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={actualCash}
              onChange={(e) => onActualCashChange(e.target.value)}
              className="mt-1"
              autoFocus
            />
            {report && (
              <p className="text-xs text-muted-foreground mt-1">
                Pričakovano: {formatCurrency(report.expectedCash)}
              </p>
            )}
          </div>
          {/* Opombe ob zaključku */}
          <div>
            <label htmlFor="zreport-close-notes" className="text-sm font-medium">Opombe</label>
            <Textarea
              id="zreport-close-notes"
              placeholder="Opombe ob zaključku dneva..."
              value={closeNotes}
              onChange={(e) => onCloseNotesChange(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onFinalize} disabled={isPending} className="bg-amber-600 hover:bg-amber-700">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Potrdi in zaključi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
