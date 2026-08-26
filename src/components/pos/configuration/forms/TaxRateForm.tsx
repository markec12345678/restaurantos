'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { memo } from 'react'

// ============================================
// SKUPNI TIPI
// ============================================
export interface FormFieldProps {
  formData: Record<string, unknown>
  update: (_key: string, _value: unknown) => void
}

// ============================================
// DAVČNA STOPNJA — Ime + Stopnja + Koda + Aktivno
// ============================================
export const TaxRateForm = memo(function TaxRateForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Ime</Label>
        <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. DDV 22%" aria-label="npr. DDV 22%" autoFocus/>
      </div>
      <div>
        <Label>Stopnja (%)</Label>
        <Input type="number" step="0.01" value={String(formData.rate ?? '')} onChange={e => update('rate', e.target.value)} placeholder="22" aria-label="22"/>
      </div>
      <div>
        <Label>Koda</Label>
        <Input value={String(formData.code || '')} onChange={e => update('code', e.target.value)} placeholder="npr. S" aria-label="npr. S"/>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
        <Label>Aktivna</Label>
      </div>
    </div>
  )
})
