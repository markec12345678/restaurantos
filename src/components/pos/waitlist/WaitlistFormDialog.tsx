'use client'

import { memo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/ui/decimal-input'
import { type WaitlistFormDialogProps, AREA_OPTIONS } from './constants'

// Dialog za dodajanje v čakalno vrsto — Radix Dialog za dostopnost (focus trap, Escape, aria)
export const WaitlistFormDialog = memo(function WaitlistFormDialog({
  open,
  form,
  onOpenChange,
  onUpdateForm,
  onAddEntry,
  onCancel,
}: WaitlistFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dodaj v čakalno vrsto</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label htmlFor="waitlist-guest-name" className="text-xs font-medium text-muted-foreground">Ime gosta *</label>
            <Input
              id="waitlist-guest-name"
              value={(form.guestName as string) || ''}
              onChange={e => onUpdateForm('guestName', e.target.value)}
              className="mt-1 pointer-coarse:h-11 touch-manipulation"
              placeholder="Ime in priimek"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="waitlist-party-size" className="text-xs font-medium text-muted-foreground">Št. oseb *</label>
              <DecimalInput
                id="waitlist-party-size"
                value={(form.partySize as number) || 2}
                onValueChange={n => onUpdateForm('partySize', n || 1)}
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="waitlist-wait-time" className="text-xs font-medium text-muted-foreground">Obljubljen čakalni čas (min)</label>
              <DecimalInput
                id="waitlist-wait-time"
                value={(form.quotedWaitMinutes as number) || 15}
                onValueChange={n => onUpdateForm('quotedWaitMinutes', n)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <label htmlFor="waitlist-phone" className="text-xs font-medium text-muted-foreground">Telefon</label>
            <Input
              id="waitlist-phone"
              value={(form.guestPhone as string) || ''}
              onChange={e => onUpdateForm('guestPhone', e.target.value)}
              className="mt-1 pointer-coarse:h-11 touch-manipulation"
              placeholder="+386 ..."
            />
          </div>
          <div>
            <label htmlFor="waitlist-area" className="text-xs font-medium text-muted-foreground">Preferirano območje</label>
            <select
              id="waitlist-area"
              value={(form.preferredArea as string) || ''}
              onChange={e => onUpdateForm('preferredArea', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1 pointer-coarse:py-2.5 pointer-coarse:text-base touch-manipulation"
            >
              {AREA_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="waitlist-special" className="text-xs font-medium text-muted-foreground">Posebne potrebe</label>
            <Input
              id="waitlist-special"
              value={(form.specialNeeds as string) || ''}
              onChange={e => onUpdateForm('specialNeeds', e.target.value)}
              className="mt-1 pointer-coarse:h-11 touch-manipulation"
              placeholder="Otroški stol, invalidski dostop..."
            />
          </div>
          <div>
            <label htmlFor="waitlist-notes" className="text-xs font-medium text-muted-foreground">Opombe</label>
            <Input
              id="waitlist-notes"
              value={(form.notes as string) || ''}
              onChange={e => onUpdateForm('notes', e.target.value)}
              className="mt-1 pointer-coarse:h-11 touch-manipulation"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="ghost" onClick={onCancel} className="pointer-coarse:h-11 pointer-coarse:text-base">Prekliči</Button>
          </DialogClose>
          <Button
            onClick={onAddEntry}
            disabled={!form.guestName}
            className="bg-orange-500 hover:bg-orange-600 text-white pointer-coarse:h-11 pointer-coarse:text-base"
          >
            Dodaj v čakalno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
