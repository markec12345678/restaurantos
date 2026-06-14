'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Pencil } from 'lucide-react'
import { type GiftCard, statusConfig, formatCurrency } from './constants'

// --- Props ---

interface EditCardForm {
  status: string
  expiresAt: string
}

interface EditCardDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  target: GiftCard | null
  form: EditCardForm
  onFormChange: (_form: EditCardForm) => void
  onSubmit: () => void
  isPending: boolean
}

// --- Komponenta ---

export const EditCardDialog = memo(function EditCardDialog({
  open,
  onOpenChange,
  target,
  form,
  onFormChange,
  onSubmit,
  isPending,
}: EditCardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(openVal) => { if (!openVal) { onOpenChange(false) } onOpenChange(openVal) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Uredi darilno kartico
          </DialogTitle>
          <DialogDescription>
            Spremenite status ali podaljšajte veljavnost kartice {target?.cardNumber}.
          </DialogDescription>
        </DialogHeader>

        {target && (
          <div className="space-y-4">
            {/* Info o kartici */}
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
              <Label htmlFor="gc-edit-status" className="text-sm font-semibold">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => onFormChange({ ...form, status: v })}
              >
                <SelectTrigger id="gc-edit-status" autoFocus>
                  <SelectValue placeholder="Izberite status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${cfg.dotColor}`} aria-hidden="true" />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gc-edit-expires" className="text-sm font-semibold">Datum poteka</Label>
              <Input
                id="gc-edit-expires"
                type="date"
                value={form.expiresAt}
                onChange={(e) => onFormChange({ ...form, expiresAt: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Pustite prazno za kartico brez roka veljavnosti</p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => { onOpenChange(false) }}>
            Prekliči
          </Button>
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Shranjujem...
              </>
            ) : (
              'Shrani spremembe'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
