'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

// ============================================
// TIPI
// ============================================
interface FormFieldProps {
  formData: Record<string, unknown>
  update: (_key: string, _value: unknown) => void
}

// ============================================
// GIFT CARD FORM - Obrazec za darilne kartice
// ============================================
export const GiftCardForm = memo(function GiftCardForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="gc-number">Številka kartice</Label>
        <Input id="gc-number" value={String(formData.cardNumber || '')} onChange={e => update('cardNumber', e.target.value)} placeholder="GC-000001" aria-label="Številka kartice" autoFocus/>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="gc-balance">Stanje (€)</Label>
          <Input id="gc-balance" type="number" step="0.01" value={String(formData.balance ?? '')} onChange={e => update('balance', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="gc-initial">Začetno stanje (€)</Label>
          <Input id="gc-initial" type="number" step="0.01" value={String(formData.initialBalance ?? '')} onChange={e => update('initialBalance', e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="gc-owner">Ime lastnika</Label>
        <Input id="gc-owner" value={String(formData.ownerName || '')} onChange={e => update('ownerName', e.target.value)} placeholder="Ime Priimek" aria-label="Ime lastnika"/>
      </div>
      <div>
        <Label htmlFor="gc-expires">Datum poteka</Label>
        <Input id="gc-expires" type="date" value={String(formData.expiresAt || '')} onChange={e => update('expiresAt', e.target.value)} />
      </div>
      <div>
        <Label htmlFor="gc-status">Status</Label>
        <Select value={String(formData.status || 'active')} onValueChange={v => update('status', v)}>
          <SelectTrigger id="gc-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Aktivna</SelectItem>
            <SelectItem value="expired">Potekla</SelectItem>
            <SelectItem value="used">Porabljena</SelectItem>
            <SelectItem value="disabled">Onemogočena</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
})
