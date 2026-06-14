'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
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
// DISCOUNT FORM - Obrazec za popuste
// ============================================
export const DiscountForm = memo(function DiscountForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="discount-name">Ime</Label>
        <Input id="discount-name" value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Zgodnja ptica" aria-label="Ime popusta" autoFocus/>
      </div>
      <div>
        <Label htmlFor="discount-type">Vrsta popusta</Label>
        <Select value={String(formData.type || 'percentage')} onValueChange={v => update('type', v)}>
          <SelectTrigger id="discount-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="percentage">Odstotek</SelectItem>
            <SelectItem value="fixed">Fiksni znesek</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="discount-amount">Znesek {formData.type === 'percentage' ? '(%)' : '(€)'}</Label>
        <Input id="discount-amount" type="number" step="0.01" value={String(formData.amount ?? '')} onChange={e => update('amount', e.target.value)} placeholder="10" aria-label="Znesek popusta"/>
      </div>
      <div>
        <Label htmlFor="discount-applies">Velja za</Label>
        <Select value={String(formData.appliesTo || 'all')} onValueChange={v => update('appliesTo', v)}>
          <SelectTrigger id="discount-applies"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vse</SelectItem>
            <SelectItem value="items">Artikli</SelectItem>
            <SelectItem value="categories">Kategorije</SelectItem>
            <SelectItem value="order">Celotno naročilo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="discount-trigger">Sprožilec</Label>
        <Select value={String(formData.triggerType || 'manual')} onValueChange={v => update('triggerType', v)}>
          <SelectTrigger id="discount-trigger"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Ročno</SelectItem>
            <SelectItem value="auto">Samodejno</SelectItem>
            <SelectItem value="promo-code">Promocijska koda</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="discount-promo">Promocijska koda</Label>
        <Input id="discount-promo" value={String(formData.promoCode || '')} onChange={e => update('promoCode', e.target.value)} placeholder="Opcijsko" aria-label="Promocijska koda"/>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="discount-from">Veljavno od</Label>
          <Input id="discount-from" type="date" value={String(formData.validFrom || '')} onChange={e => update('validFrom', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="discount-to">Veljavno do</Label>
          <Input id="discount-to" type="date" value={String(formData.validTo || '')} onChange={e => update('validTo', e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="discount-max">Največ uporab</Label>
        <Input id="discount-max" type="number" value={String(formData.maxUses ?? '0')} onChange={e => update('maxUses', e.target.value)} placeholder="0 = neomejeno" aria-label="Največ uporab"/>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="discount-active" checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
        <Label htmlFor="discount-active">Aktiven</Label>
      </div>
    </div>
  )
})
