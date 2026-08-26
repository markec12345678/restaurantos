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
// PRINTER FORM - Obrazec za tiskalnike
// ============================================
export const PrinterForm = memo(function PrinterForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="printer-name">Ime</Label>
        <Input id="printer-name" value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Kuhinjski tiskalnik" aria-label="Ime tiskalnika" autoFocus/>
      </div>
      <div>
        <Label htmlFor="printer-type">Vrsta</Label>
        <Select value={String(formData.type || 'thermal')} onValueChange={v => update('type', v)}>
          <SelectTrigger id="printer-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="thermal">Termični</SelectItem>
            <SelectItem value="impact">Iglični</SelectItem>
            <SelectItem value="label">Etiketni</SelectItem>
            <SelectItem value="receipt">Blagajniški</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="printer-location">Lokacija</Label>
        <Input id="printer-location" value={String(formData.location || '')} onChange={e => update('location', e.target.value)} placeholder="npr. Kuhinja" aria-label="Lokacija tiskalnika"/>
      </div>
      <div>
        <Label htmlFor="printer-ip">IP naslov</Label>
        <Input id="printer-ip" value={String(formData.ipAddress || '')} onChange={e => update('ipAddress', e.target.value)} placeholder="192.168.1.100" aria-label="IP naslov tiskalnika"/>
      </div>
    </div>
  )
})
