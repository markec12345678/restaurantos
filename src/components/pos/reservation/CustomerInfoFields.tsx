'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { sourceLabels } from './constants'

// ============================================
// Customer info fields sub-component
// ============================================
interface CustomerInfoFieldsProps {
  customerName: string
  setCustomerName: (_v: string) => void
  customerPhone: string
  setCustomerPhone: (_v: string) => void
  customerEmail: string
  setCustomerEmail: (_v: string) => void
  source: string
  setSource: (_v: string) => void
}

export const CustomerInfoFields = memo(function CustomerInfoFields({
  customerName, setCustomerName,
  customerPhone, setCustomerPhone,
  customerEmail, setCustomerEmail,
  source, setSource,
}: CustomerInfoFieldsProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Podatki stranke</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="res-customer-name" className="text-xs font-medium">Ime in priimek *</label>
          <Input id="res-customer-name" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Janez Novak" className="h-9 text-sm" aria-label="Janez Novak" autoFocus/>
        </div>
        <div>
          <label htmlFor="res-customer-phone" className="text-xs font-medium">Telefon</label>
          <Input id="res-customer-phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+386 40 123 456" className="h-9 text-sm" aria-label="+386 40 123 456"/>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="res-customer-email" className="text-xs font-medium">E-pošta</label>
          <Input id="res-customer-email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="janez@email.si" className="h-9 text-sm" aria-label="janez@email.si"/>
        </div>
        <div>
          <label htmlFor="res-source" className="text-xs font-medium">Vir</label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger id="res-source" className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(sourceLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
})
