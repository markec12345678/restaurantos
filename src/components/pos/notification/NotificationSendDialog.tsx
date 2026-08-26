'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Send } from 'lucide-react'
import type { NotificationSendDialogProps } from './constants'

// Dijalog za pošiljanje novega obvestila
export const NotificationSendDialog = memo(function NotificationSendDialog({
  open,
  sendForm,
  isPending,
  onOpenChange,
  onFormChange,
  onSend,
}: NotificationSendDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Novo obvestilo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="notif-channel" className="text-sm font-medium mb-1 block">Kanal</label>
            <Select value={sendForm.channel} onValueChange={(v) => onFormChange({ ...sendForm, channel: v })}>
              <SelectTrigger id="notif-channel" autoFocus>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">E-pošta</SelectItem>
                <SelectItem value="push">Push obvestilo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="notif-recipient" className="text-sm font-medium mb-1 block">
              {sendForm.channel === 'email' ? 'E-pošta' : 'Telefonska stevilka'}
            </label>
            <Input
              id="notif-recipient"
              value={sendForm.recipient}
              onChange={(e) => onFormChange({ ...sendForm, recipient: e.target.value })}
              placeholder={sendForm.channel === 'email' ? 'email@primer.si' : '+386 1 234 5678'}
            />
          </div>
          {sendForm.channel === 'email' && (
            <div>
              <label htmlFor="notif-subject" className="text-sm font-medium mb-1 block">Zadeva</label>
              <Input
                id="notif-subject"
                value={sendForm.subject}
                onChange={(e) => onFormChange({ ...sendForm, subject: e.target.value })}
                placeholder="Zadeva e-pošte"
              />
            </div>
          )}
          <div>
            <label htmlFor="notif-message" className="text-sm font-medium mb-1 block">Sporočilo</label>
            <Textarea
              id="notif-message"
              value={sendForm.message}
              onChange={(e) => onFormChange({ ...sendForm, message: e.target.value })}
              placeholder="Vnesite sporočilo..."
              rows={4}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              {'Uporabite {datum}, {ura}, {osebe}, {stevilka}, {restavracija} za dinamicne vrednosti'}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button
            onClick={onSend}
            disabled={!sendForm.recipient || !sendForm.message || isPending}
            className="gap-1"
          >
            <Send className="h-3 w-3" />
            Pošlji
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
