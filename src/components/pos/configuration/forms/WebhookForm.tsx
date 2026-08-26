'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

// ============================================
// TIPI
// ============================================
interface FormFieldProps {
  formData: Record<string, unknown>
  update: (_key: string, _value: unknown) => void
}

// ============================================
// WEBHOOK FORM - Obrazec za webhook
// ============================================
export const WebhookForm = memo(function WebhookForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="webhook-name">Ime</Label>
        <Input id="webhook-name" value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Slack obvestila" aria-label="Ime webhooka" autoFocus/>
      </div>
      <div>
        <Label htmlFor="webhook-url">URL</Label>
        <Input id="webhook-url" value={String(formData.url || '')} onChange={e => update('url', e.target.value)} placeholder="https://..." aria-label="URL webhooka"/>
      </div>
      <div>
        <Label htmlFor="webhook-events">Dogodki (ločeni z vejico)</Label>
        <Input
          id="webhook-events"
          value={String(formData.events || '')}
          onChange={e => update('events', e.target.value)}
          placeholder="order.created,order.paid,order.cancelled"
          aria-label="Dogodki webhook"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Na voljo: order.created, order.paid, order.cancelled, order.refunded, inventory.low, shift.opened, shift.closed
        </p>
      </div>
      <div>
        <Label htmlFor="webhook-secret">Skrivnost</Label>
        <Input id="webhook-secret" value={String(formData.secret || '')} onChange={e => update('secret', e.target.value)} placeholder="Podpisovalni ključ" aria-label="Skrivnost webhooka"/>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="webhook-active" checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
        <Label htmlFor="webhook-active">Aktiven</Label>
      </div>
    </div>
  )
})
