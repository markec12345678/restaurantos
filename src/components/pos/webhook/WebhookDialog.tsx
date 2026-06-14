'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Plus, Webhook } from 'lucide-react'
import type { WebhookDialogProps } from './constants'
import { eventOptions } from './constants'

// ============================================
// DIJALOG ZA USTVARJANJE/UREJANJE SPLETNE KLJUKE
// ============================================

export const WebhookDialog = memo(function WebhookDialog({
  open,
  editingItem,
  formData,
  onOpenChange,
  onFormDataChange,
  onSubmit,
  onToggleEvent,
  isPending,
}: WebhookDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            {editingItem ? 'Uredi spletno kljuko' : 'Dodaj webhook'}
          </DialogTitle>
          <DialogDescription>
            {editingItem ? 'Posodobite nastavitve spletne kljuke.' : 'Ustvarite novo spletno kljuko za obvestila v realnem času.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Ime */}
          <div className="space-y-1.5">
            <Label htmlFor="webhook-name" className="text-sm font-semibold">Ime *</Label>
            <Input
              id="webhook-name"
              placeholder="npr. Obvestilo kuhinji"
              value={formData.name}
              onChange={e => onFormDataChange({ ...formData, name: e.target.value })}
              autoFocus
            />
          </div>

          {/* URL končne točke */}
          <div className="space-y-1.5">
            <Label htmlFor="webhook-url" className="text-sm font-semibold">URL končne točke *</Label>
            <Input
              id="webhook-url"
              placeholder="https://primer.si/api/webhook"
              value={formData.url}
              onChange={e => onFormDataChange({ ...formData, url: e.target.value })}
            />
          </div>

          {/* Dogodki */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Dogodki *</Label>
            <div className="grid grid-cols-2 gap-2">
              {eventOptions.map(ev => (
                <label
                  key={ev.value}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors text-sm ${
                    formData.events.includes(ev.value)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.events.includes(ev.value)}
                    onChange={() => onToggleEvent(ev.value)}
                    className="rounded"
                  />
                  <span>{ev.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Skrivnost */}
          <div className="space-y-1.5">
            <Label htmlFor="webhook-secret" className="text-sm font-semibold">Skrivnost</Label>
            <Input
              id="webhook-secret"
              placeholder="Skrivnost za podpisovanje payloada"
              value={formData.secret}
              onChange={e => onFormDataChange({ ...formData, secret: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Uporablja se za HMAC podpisovanje payloada</p>
          </div>

          {/* Aktivno stikalo */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">Aktiven</Label>
              <p className="text-xs text-muted-foreground">Nedejavne kljuke ne bodo sprožene</p>
            </div>
            <Switch checked={formData.isActive} onCheckedChange={checked => onFormDataChange({ ...formData, isActive: checked })} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending ? (
              <><span className="animate-spin mr-2">⏳</span>Shranjujem...</>
            ) : editingItem ? 'Posodobi' : <><Plus className="h-4 w-4 mr-1.5" />Ustvari</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
