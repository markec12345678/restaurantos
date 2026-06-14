'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { memo } from 'react'

// ============================================
// SKUPNI TIPI
// ============================================
interface FormFieldProps {
  formData: Record<string, unknown>
  update: (_key: string, _value: unknown) => void
}

// ============================================
// ENOSTAVNI OBRAZCI (ime + koda + aktivno)
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

export const DiningOptionForm = memo(function DiningOptionForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Ime</Label>
        <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Hrana na licu mesta" aria-label="npr. Hrana na licu mesta" autoFocus/>
      </div>
      <div>
        <Label>Vrsta</Label>
        <Select value={String(formData.type || 'dine-in')} onValueChange={v => update('type', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="dine-in">Na licu mesta</SelectItem>
            <SelectItem value="takeout">Za s seboj</SelectItem>
            <SelectItem value="delivery">Dostava</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Pripravljalni čas (min)</Label>
        <Input type="number" value={String(formData.prepTimeMinutes ?? '')} onChange={e => update('prepTimeMinutes', e.target.value)} placeholder="15" aria-label="15"/>
      </div>
      <div>
        <Label>Povezani servisni strošek</Label>
        <Input value={String(formData.linkedServiceCharge || '')} onChange={e => update('linkedServiceCharge', e.target.value)} placeholder="Opcijsko" aria-label="Opcijsko"/>
      </div>
    </div>
  )
})

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

export const PriceGroupForm = memo(function PriceGroupForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Ime</Label>
        <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Redna cena" aria-label="npr. Redna cena" autoFocus/>
      </div>
      <div>
        <Label>Opis</Label>
        <Textarea value={String(formData.description || '')} onChange={e => update('description', e.target.value)} placeholder="Opis cenika..." aria-label="Opis cenika"/>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
        <Label>Aktiven</Label>
      </div>
    </div>
  )
})

export const ServiceChargeForm = memo(function ServiceChargeForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Ime</Label>
        <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Pribitki za postrežbo" aria-label="npr. Pribitki za postrežbo" autoFocus/>
      </div>
      <div>
        <Label>Vrsta</Label>
        <Select value={String(formData.type || 'percentage')} onValueChange={v => update('type', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="percentage">Odstotek</SelectItem>
            <SelectItem value="fixed">Fiksni znesek</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Znesek {formData.type === 'percentage' ? '(%)' : '(€)'}</Label>
        <Input type="number" step="0.01" value={String(formData.amount ?? '')} onChange={e => update('amount', e.target.value)} placeholder="10" aria-label="10"/>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={Boolean(formData.isAutoApply)} onCheckedChange={c => update('isAutoApply', c)} />
        <Label>Samodejno dodaj</Label>
      </div>
    </div>
  )
})

export const PrepStationForm = memo(function PrepStationForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Ime</Label>
        <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Vroča kuhinja" aria-label="npr. Vroča kuhinja" autoFocus/>
      </div>
      <div>
        <Label>Vrsta</Label>
        <Select value={String(formData.type || 'kitchen')} onValueChange={v => update('type', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="kitchen">Kuhinja</SelectItem>
            <SelectItem value="bar">Bar</SelectItem>
            <SelectItem value="grill">Žar</SelectItem>
            <SelectItem value="pastry">Slaščičarna</SelectItem>
            <SelectItem value="cold">Hladna kuhinja</SelectItem>
            <SelectItem value="other">Drugo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Povprečni čas priprave (min)</Label>
        <Input type="number" value={String(formData.avgPrepTime ?? '')} onChange={e => update('avgPrepTime', e.target.value)} placeholder="12" aria-label="12"/>
      </div>
    </div>
  )
})

// ============================================
// ENOSTAVNI OBRAZCI (ime + aktivno)
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
