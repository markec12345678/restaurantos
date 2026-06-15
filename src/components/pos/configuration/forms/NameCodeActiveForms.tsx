'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { memo } from 'react'
import type { FormFieldProps } from './TaxRateForm'

// ============================================
// PRIHODKOVNI CENTER — Ime + Koda + Aktivno
// ============================================
export const RevenueCenterForm = memo(function RevenueCenterForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Ime</Label>
        <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Glavni bar" aria-label="npr. Glavni bar" autoFocus/>
      </div>
      <div>
        <Label>Koda</Label>
        <Input value={String(formData.code || '')} onChange={e => update('code', e.target.value)} placeholder="npr. BAR-01" aria-label="npr. BAR-01"/>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
        <Label>Aktiven</Label>
      </div>
    </div>
  )
})

// ============================================
// PRODAJNA KATEGORIJA — Ime + Koda + Aktivno
// ============================================
export const SalesCategoryForm = memo(function SalesCategoryForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Ime</Label>
        <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Hrana" aria-label="npr. Hrana" autoFocus/>
      </div>
      <div>
        <Label>Koda</Label>
        <Input value={String(formData.code || '')} onChange={e => update('code', e.target.value)} placeholder="npr. FOOD" aria-label="npr. FOOD"/>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
        <Label>Aktivna</Label>
      </div>
    </div>
  )
})
