'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Plus, Gift, RefreshCw } from 'lucide-react'
import { generateCardNumber } from './constants'

// --- Props ---

interface NewCardForm {
  cardNumber: string
  ownerName: string
  initialBalance: string
  expiresAt: string
}

interface NewCardDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  form: NewCardForm
  onFormChange: (_form: NewCardForm) => void
  onSubmit: () => void
  isPending: boolean
}

// --- Komponenta ---

export const NewCardDialog = memo(function NewCardDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSubmit,
  isPending,
}: NewCardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Nova darilna kartica
          </DialogTitle>
          <DialogDescription>
            Ustvarite novo darilno kartico za stranko.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="gc-card-number" className="text-sm font-semibold">Številka kartice</Label>
            <div className="flex gap-2">
              <Input
                id="gc-card-number"
                placeholder="Samodejno generirano"
                value={form.cardNumber}
                onChange={(e) => onFormChange({ ...form, cardNumber: e.target.value })}
                className="font-mono"
                autoFocus
              />
              <Button
                variant="outline"
                size="icon"
                aria-label="Generiraj številko"
                className="flex-shrink-0"
                title="Generiraj novo številko"
                onClick={() => onFormChange({ ...form, cardNumber: generateCardNumber() })}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Pustite prazno za samodejno generiranje</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gc-owner-name" className="text-sm font-semibold">Lastnik</Label>
            <Input
              id="gc-owner-name"
              placeholder="Ime in priimek lastnika"
              value={form.ownerName}
              onChange={(e) => onFormChange({ ...form, ownerName: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gc-initial-balance" className="text-sm font-semibold">Začetno stanje (€) *</Label>
            <Input
              id="gc-initial-balance"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={form.initialBalance}
              onChange={(e) => onFormChange({ ...form, initialBalance: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gc-new-expires" className="text-sm font-semibold">Datum poteka</Label>
            <Input
              id="gc-new-expires"
              type="date"
              value={form.expiresAt}
              onChange={(e) => onFormChange({ ...form, expiresAt: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Pustite prazno za kartico brez roka veljavnosti</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Prekliči
          </Button>
          <Button
            onClick={onSubmit}
            disabled={
              !form.initialBalance ||
              parseFloat(form.initialBalance) <= 0 ||
              isPending
            }
          >
            {isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Ustvarjam...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1.5" />
                Ustvari kartico
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
