'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { memo } from 'react'
import type { FormFieldProps } from './TaxRateForm'

// ============================================
// RAZLOG ZA RAČUN — Ime + Aktivno
// ============================================
export const VoidReasonForm = memo(function VoidReasonForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Ime</Label>
        <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Naročilo po pomoti" aria-label="npr. Naročilo po pomoti" autoFocus/>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
        <Label>Aktiven</Label>
      </div>
    </div>
  )
})

// ============================================
// RAZLOG ZA BREZ PRODAJE — Ime + Aktivno
// ============================================
export const NoSaleReasonForm = memo(function NoSaleReasonForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Ime</Label>
        <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Odprt fižek" aria-label="npr. Odprt fižek" autoFocus/>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
        <Label>Aktiven</Label>
      </div>
    </div>
  )
})
