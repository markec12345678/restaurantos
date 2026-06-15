'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ============================================
// KONTAKT — Kontaktna oseba, telefon, e-pošta
// ============================================

interface ContactFieldsProps {
  contactPerson: string
  onContactPersonChange: (_v: string) => void
  phone: string
  onPhoneChange: (_v: string) => void
  email: string
  onEmailChange: (_v: string) => void
}

export const ContactFields = memo(function ContactFields({
  contactPerson, onContactPersonChange, phone, onPhoneChange, email, onEmailChange,
}: ContactFieldsProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kontakt</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="supplier-contact" className="text-xs font-medium">Kontaktna oseba</Label>
          <Input id="supplier-contact" value={contactPerson} onChange={e => onContactPersonChange(e.target.value)} placeholder="Janez Novak" className="h-9 text-sm" />
        </div>
        <div>
          <Label htmlFor="supplier-phone" className="text-xs font-medium">Telefon</Label>
          <Input id="supplier-phone" value={phone} onChange={e => onPhoneChange(e.target.value)} placeholder="+386 1 234 5678" className="h-9 text-sm" />
        </div>
        <div>
          <Label htmlFor="supplier-email" className="text-xs font-medium">E-pošta</Label>
          <Input id="supplier-email" value={email} onChange={e => onEmailChange(e.target.value)} placeholder="info@novak.si" className="h-9 text-sm" />
        </div>
      </div>
    </div>
  )
})
