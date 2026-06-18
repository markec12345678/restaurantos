'use client'

// ============================================
// DIALOG ZA ZAPRTJE IZMENE
// ============================================

import { memo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Lock, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { CloseShiftFormType, LiveStatsType } from './constants'

interface CloseShiftDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  form: CloseShiftFormType
  onFormChange: (_form: CloseShiftFormType) => void
  liveStats: LiveStatsType | undefined
  onSubmit: () => void
  isPending: boolean
}

export const CloseShiftDialog = memo(function CloseShiftDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  liveStats,
  onSubmit,
  isPending,
}: CloseShiftDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Zapri izmeno
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Povzetek pred zaprtjem */}
          {liveStats && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Prodaja v gotovini:</span>
                <span className="font-semibold">&euro;{safeToFixed(liveStats.cashSales, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Kartična prodaja:</span>
                <span className="font-semibold">&euro;{safeToFixed(liveStats.cardSales, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Mobilna prodaja:</span>
                <span className="font-semibold">&euro;{safeToFixed(liveStats.mobileSales, 2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Skupna prodaja:</span>
                <span>&euro;{safeToFixed(liveStats.totalSales, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Skupaj naročil:</span>
                <span>{liveStats.totalOrders}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>Pričakovana gotovina:</span>
                <span className="font-bold">&euro;{safeToFixed(liveStats.expectedCash, 2)}</span>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="cash-closing" className="text-sm font-medium">Dejanska gotovina v blagajni (&euro;)</label>
            <Input
              id="cash-closing"
              type="number"
              step="0.01"
              value={form.closingCash}
              onChange={e => onFormChange({ ...form, closingCash: e.target.value })}
              placeholder={String(liveStats?.expectedCash?.toFixed(2) || '0.00')}
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">
              Vnesite znesek štete gotovine ob zaprtju izmene
            </p>
            {form.closingCash && liveStats && (
              <div className={`mt-2 flex items-center gap-2 text-sm font-medium ${
                parseFloat(form.closingCash) - liveStats.expectedCash > 0.01
                  ? 'text-emerald-600'
                  : parseFloat(form.closingCash) - liveStats.expectedCash < -0.01
                  ? 'text-red-600'
                  : 'text-muted-foreground'
              }`}>
                {parseFloat(form.closingCash) - liveStats.expectedCash > 0.01 ? (
                  <><TrendingUp className="h-4 w-4" /> Prihranek: &euro;{(parseFloat(form.closingCash) - liveStats.expectedCash).toFixed(2)}</>
                ) : parseFloat(form.closingCash) - liveStats.expectedCash < -0.01 ? (
                  <><AlertTriangle className="h-4 w-4" /> Manjka: &euro;{(liveStats.expectedCash - parseFloat(form.closingCash)).toFixed(2)}</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> Gotovina se ujema</>
                )}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="cash-close-notes" className="text-sm font-medium">Opombe</label>
            <Textarea
              id="cash-close-notes"
              value={form.notes}
              onChange={e => onFormChange({ ...form, notes: e.target.value })}
              placeholder="Opombe ob zaključku izmene..."
              className="h-20"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} aria-label="Prekliči">Prekliči</Button>
          <Button
            variant="destructive"
            onClick={onSubmit}
            disabled={isPending}
            aria-label="Zapri izmeno"
          >
            {isPending ? 'Zapiram...' : 'Zapri izmeno'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
