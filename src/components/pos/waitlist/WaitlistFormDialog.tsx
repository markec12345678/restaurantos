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
            <label htmlFor="waitlist-guest-name" className="text-xs font-medium text-gray-500">Ime gosta *</label>
            <Input
              id="waitlist-guest-name"
              value={(form.guestName as string) || ''}
              onChange={e => onUpdateForm('guestName', e.target.value)}
              className="mt-1"
              placeholder="Ime in priimek"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="waitlist-party-size" className="text-xs font-medium text-gray-500">Št. oseb *</label>
              <Input
                id="waitlist-party-size"
                type="number"
                value={(form.partySize as number) || 2}
                onChange={e => onUpdateForm('partySize', parseInt(e.target.value) || 1)}
                className="mt-1"
                min={1}
              />
            </div>
            <div>
              <label htmlFor="waitlist-wait-time" className="text-xs font-medium text-gray-500">Obljubljen čakalni čas (min)</label>
              <Input
                id="waitlist-wait-time"
                type="number"
                value={(form.quotedWaitMinutes as number) || 15}
                onChange={e => onUpdateForm('quotedWaitMinutes', parseInt(e.target.value) || 0)}
                className="mt-1"
                min={0}
              />
            </div>
          </div>
          <div>
            <label htmlFor="waitlist-phone" className="text-xs font-medium text-gray-500">Telefon</label>
            <Input
              id="waitlist-phone"
              value={(form.guestPhone as string) || ''}
              onChange={e => onUpdateForm('guestPhone', e.target.value)}
              className="mt-1"
              placeholder="+386 ..."
            />
          </div>
          <div>
            <label htmlFor="waitlist-area" className="text-xs font-medium text-gray-500">Preferirano območje</label>
            <select
              id="waitlist-area"
              value={(form.preferredArea as string) || ''}
              onChange={e => onUpdateForm('preferredArea', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
            >
              {AREA_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="waitlist-special" className="text-xs font-medium text-gray-500">Posebne potrebe</label>
            <Input
              id="waitlist-special"
              value={(form.specialNeeds as string) || ''}
              onChange={e => onUpdateForm('specialNeeds', e.target.value)}
              className="mt-1"
              placeholder="Otroški stol, invalidski dostop..."
            />
          </div>
          <div>
            <label htmlFor="waitlist-notes" className="text-xs font-medium text-gray-500">Opombe</label>
            <Input
              id="waitlist-notes"
              value={(form.notes as string) || ''}
              onChange={e => onUpdateForm('notes', e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="ghost" onClick={onCancel}>Prekliči</Button>
          </DialogClose>
          <Button
            onClick={onAddEntry}
            disabled={!form.guestName}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            Dodaj v čakalno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
