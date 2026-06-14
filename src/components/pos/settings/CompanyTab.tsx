'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Building2, FileText, Phone, Mail, MapPin, Hash, CreditCard, Globe,
} from 'lucide-react'
import type { CompanyTabProps } from './constants'

// --- Komponenta ---

export const CompanyTab = memo(function CompanyTab({
  form,
  updateField,
}: CompanyTabProps) {
  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Podatki podjetja
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Ti podatki se izpisujejo na vsakem računu in so obvezni po zakonu (ZDDV-1).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Naziv podjetja *</Label>
              <Input value={form.name || ''} onChange={e => updateField('name', e.target.value)} placeholder="npr. Restavracija Pri Ani d.o.o."  aria-label="npr. Restavracija Pri Ani d.o.o"/>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Naslov *</Label>
              <Input value={form.address || ''} onChange={e => updateField('address', e.target.value)} placeholder="npr. Ljubljanska 15"  aria-label="npr. Ljubljanska 15"/>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Poštna številka</Label>
              <Input value={form.postCode || ''} onChange={e => updateField('postCode', e.target.value)} placeholder="npr. 1000"  aria-label="npr. 1000"/>
            </div>
            <div className="space-y-2">
              <Label>Kraj</Label>
              <Input value={form.city || ''} onChange={e => updateField('city', e.target.value)} placeholder="npr. Ljubljana"  aria-label="npr. Ljubljana"/>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Telefon</Label>
              <Input value={form.phone || ''} onChange={e => updateField('phone', e.target.value)} placeholder="npr. +386 1 234 56 78"  aria-label="npr. +386 1 234 56 78"/>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> E-pošta</Label>
              <Input type="email" value={form.email || ''} onChange={e => updateField('email', e.target.value)} placeholder="npr. info@restavracija.si"  aria-label="npr. info@restavracija.si"/>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Spletna stran</Label>
              <Input value={form.web || ''} onChange={e => updateField('web', e.target.value)} placeholder="npr. www.restavracija.si"  aria-label="npr. www.restavracija.si"/>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> Matična številka *</Label>
              <Input value={form.businessId || ''} onChange={e => updateField('businessId', e.target.value)} placeholder="npr. 12345678"  aria-label="npr. 12345678"/>
              <p className="text-xs text-muted-foreground">Enotna matična številka poslovnega subjekta (8 mest)</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> ID za DDV *</Label>
              <Input value={form.taxId || ''} onChange={e => updateField('taxId', e.target.value)} placeholder="npr. SI12345678"  aria-label="npr. SI12345678"/>
              <p className="text-xs text-muted-foreground">Identifikacijska številka za DDV (SI + 8 mest)</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Številka blagajne *</Label>
              <Input value={form.registerNumber || ''} onChange={e => updateField('registerNumber', e.target.value)} placeholder="npr. BLG-001"  aria-label="npr. BLG-001"/>
              <p className="text-xs text-muted-foreground">Oznaka poslovnega prostora/blagajne (za FURS)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Predogled podatkov na računu */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            Predogled glave računa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="font-mono text-xs bg-muted/50 p-4 rounded-lg space-y-1 text-center max-w-xs mx-auto border">
            <p className="font-bold text-sm">{form.name || 'Naziv podjetja'}</p>
            <p className="text-muted-foreground">{form.address || 'Naslov'}</p>
            <p className="text-muted-foreground">{form.postCode} {form.city}</p>
            {form.phone && <p className="text-muted-foreground">{form.phone}</p>}
            <Separator className="my-1" />
            <div className="flex justify-between text-[10px]">
              <span>MAT: {form.businessId || '--------'}</span>
              <span>ID DDV: {form.taxId || 'SI--------'}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Blagajna: {form.registerNumber || 'BLG-001'}</p>
          </div>
        </CardContent>
      </Card>
    </>
  )
})
