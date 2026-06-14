'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { ArrowDownToLine } from 'lucide-react'
import { type GiftCard, formatCurrency } from './constants'

// --- Props ---

interface LoadFundsForm {
  amount: string
  note: string
}

interface LoadFundsDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  target: GiftCard | null
  form: LoadFundsForm
  onFormChange: (_form: LoadFundsForm) => void
  onSubmit: () => void
  isPending: boolean
}

// --- Komponenta ---

export const LoadFundsDialog = memo(function LoadFundsDialog({
  open,
  onOpenChange,
  target,
  form,
  onFormChange,
  onSubmit,
  isPending,
}: LoadFundsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(openVal) => { if (!openVal) { onOpenChange(false) } onOpenChange(openVal) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-primary" />
            Naloži sredstva
          </DialogTitle>
          <DialogDescription>
            Dodajte sredstva na kartico {target?.cardNumber}.
          </DialogDescription>
        </DialogHeader>

        {target && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Številka kartice:</span>
                <span className="font-mono font-medium">{target.cardNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lastnik:</span>
                <span>{target.ownerName || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trenutno stanje:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(target.balance)}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label htmlFor="gc-load-amount" className="text-sm font-semibold">Znesek (€) *</Label>
              <Input
                id="gc-load-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => onFormChange({ ...form, amount: e.target.value })}
                autoFocus
              />
            </div>

            {form.amount && parseFloat(form.amount) > 0 && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-700 dark:text-emerald-400">Novo stanje:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(target.balance + parseFloat(form.amount))}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="gc-load-note" className="text-sm font-semibold">Opomba</Label>
              <Textarea
                id="gc-load-note"
                placeholder="Opomba za transakcijo..."
                value={form.note}
                onChange={(e) => onFormChange({ ...form, note: e.target.value })}
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => { onOpenChange(false) }}>
            Prekliči
          </Button>
          <Button
            onClick={onSubmit}
            disabled={
              !form.amount ||
              parseFloat(form.amount) <= 0 ||
              isPending
            }
          >
            {isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Nalagam...
              </>
            ) : (
              <>
                <ArrowDownToLine className="h-4 w-4 mr-1.5" />
                Naloži sredstva
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
