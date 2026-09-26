'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

// =====================================================================
// Dialog zaključka dostave (R137-c): mode 'delivered' (opomba + gotovina)
// in 'failed' (razlog). podNotes max 500 znakov (server kontrakt),
// izbirna. Checkbox "Gotovina prevzeta" SAMO za delivered na neplačanem
// (gotovinskem) naročilu — cashCollected gre v POST samo ko potrdi.
// Stanje se resetira prek remounta (DriverApp ga montira pogojno z
// key=deliveryInfoId:mode — react.dev "reset with key"; brez
// setState-v-effect, ki ga prepoveduje hišni eslint kanon).
// =====================================================================

export const POD_NOTES_MAX = 500

export interface DeliverDialogResult {
  podNotes: string
  cashCollected: boolean
}

interface DeliverDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'delivered' | 'failed'
  orderNumber: string
  /** gotovinsko naročilo → pokaži checkbox (relevantno samo za delivered) */
  cash: boolean
  busy: boolean
  error: string
  onSubmit: (result: DeliverDialogResult) => void
}

export function DeliverDialog({
  open,
  onOpenChange,
  mode,
  orderNumber,
  cash,
  busy,
  error,
  onSubmit,
}: DeliverDialogProps) {
  // Začetni vnos je prazen — DriverApp montira dialog pogojno (key), zato
  // je vsak odprtje svež vnos (brez setState-v-effect kanona)
  const [notes, setNotes] = useState('')
  const [cashCollected, setCashCollected] = useState(false)

  const isDelivered = mode === 'delivered'

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isDelivered ? 'Zaključi dostavo' : 'Prijava težave'}</DialogTitle>
          <DialogDescription>
            Naročilo #{orderNumber} —{' '}
            {isDelivered ? 'potrdi predajo (opomba izbirna)' : 'naročila ni mogoče dostaviti'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="driver-pod-notes">{isDelivered ? 'Opomba (izbirna)' : 'Razlog (izbiren)'}</Label>
            <Textarea
              id="driver-pod-notes"
              value={notes}
              rows={3}
              maxLength={POD_NOTES_MAX}
              disabled={busy}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isDelivered ? 'npr. predano osebno prejemniku' : 'npr. prejemnik ni dosegljiv na naslovu'}
            />
            <p className="text-right text-xs text-muted-foreground" aria-live="polite">
              {notes.length}/{POD_NOTES_MAX}
            </p>
          </div>

          {/* Gotovina prevzeta — SAMO delivered + neplačano (gotovinsko) naročilo */}
          {isDelivered && cash && (
            <label
              htmlFor="driver-cash-collected"
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3"
            >
              <Checkbox
                id="driver-cash-collected"
                checked={cashCollected}
                onCheckedChange={(checked) => setCashCollected(checked === true)}
                disabled={busy}
              />
              <span className="text-sm font-medium">Gotovina prevzeta</span>
            </label>
          )}

          {error !== '' && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="min-h-12 flex-1"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Prekliči
          </Button>
          <Button
            variant={isDelivered ? 'default' : 'destructive'}
            className="min-h-12 flex-1"
            disabled={busy}
            onClick={() => onSubmit({ podNotes: notes.trim(), cashCollected: isDelivered && cash && cashCollected })}
          >
            {busy ? 'Pošiljanje ...' : isDelivered ? 'Potrdi dostavo' : 'Prijavi težavo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
