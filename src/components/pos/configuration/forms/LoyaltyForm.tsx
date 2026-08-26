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
// LOYALTY FORM - Obrazec za zvestobo
// ============================================
export const LoyaltyForm = memo(function LoyaltyForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="loyalty-name">Ime stranke</Label>
        <Input id="loyalty-name" value={String(formData.customerName || '')} onChange={e => update('customerName', e.target.value)} placeholder="Ime Priimek" aria-label="Ime stranke" autoFocus/>
      </div>
      <div>
        <Label htmlFor="loyalty-phone">Telefon</Label>
        <Input id="loyalty-phone" value={String(formData.phone || '')} onChange={e => update('phone', e.target.value)} placeholder="+386..." aria-label="Telefonska številka"/>
      </div>
      <div>
        <Label htmlFor="loyalty-email">E-pošta</Label>
        <Input id="loyalty-email" type="email" value={String(formData.email || '')} onChange={e => update('email', e.target.value)} placeholder="ime@primer.si" aria-label="E-poštni naslov"/>
      </div>
      <div>
        <Label htmlFor="loyalty-points">Stanje točk</Label>
        <Input id="loyalty-points" type="number" value={String(formData.pointsBalance ?? '0')} onChange={e => update('pointsBalance', e.target.value)} />
      </div>
      <div>
        <Label htmlFor="loyalty-tier">Raven</Label>
        <Select value={String(formData.tier || 'bronze')} onValueChange={v => update('tier', v)}>
          <SelectTrigger id="loyalty-tier"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="bronze">Bronasta</SelectItem>
            <SelectItem value="silver">Srebrna</SelectItem>
            <SelectItem value="gold">Zlata</SelectItem>
            <SelectItem value="platinum">Platinasta</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
})
