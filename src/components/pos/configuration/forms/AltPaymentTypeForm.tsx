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
// ALT PAYMENT TYPE FORM - Obrazec za alternativne vrste plačil
// ============================================
export const AltPaymentTypeForm = memo(function AltPaymentTypeForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="alt-name">Ime</Label>
        <Input id="alt-name" value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Boni" aria-label="Ime alternativnega plačila" autoFocus/>
      </div>
      <div>
        <Label htmlFor="alt-code">Koda</Label>
        <Input id="alt-code" value={String(formData.code || '')} onChange={e => update('code', e.target.value)} placeholder="npr. VOUCHER" aria-label="Koda plačila"/>
      </div>
      <div>
        <Label htmlFor="alt-type">Vrsta</Label>
        <Select value={String(formData.type || 'voucher')} onValueChange={v => update('type', v)}>
          <SelectTrigger id="alt-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="voucher">Vavčer</SelectItem>
            <SelectItem value="coupon">Kupon</SelectItem>
            <SelectItem value="crypto">Kriptovaluta</SelectItem>
            <SelectItem value="mobile">Mobilno plačilo</SelectItem>
            <SelectItem value="other">Drugo</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
})
