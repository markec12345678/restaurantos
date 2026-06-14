'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { LocationFormProps } from './constants'
import { typeLabels } from './constants'

// Obrazec za ustvarjanje nove lokacije
export const LocationForm = memo(function LocationForm({
  showForm,
  form,
  createPending,
  onSetForm,
  onFormTypeChange,
  onSubmit,
  onCancel,
}: LocationFormProps) {
  if (!showForm) return null

  return (
    <Card className="border-blue-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Nova lokacija</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input aria-label="Ime lokacije" placeholder="Ime lokacije *" value={form.name} onChange={e => onSetForm(p => ({ ...p, name: e.target.value }))} />
          <Input aria-label="Koda lokacije" placeholder="Koda (npr. LJU) *" value={form.code} onChange={e => onSetForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
          <select value={form.type} onChange={onFormTypeChange} className="col-span-2 px-3 py-2 rounded-lg border bg-background text-sm">
            {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Input aria-label="Naslov" placeholder="Naslov" value={form.address} onChange={e => onSetForm(p => ({ ...p, address: e.target.value }))} />
          <div className="flex gap-2">
            <Input aria-label="Mesto" placeholder="Mesto" value={form.city} onChange={e => onSetForm(p => ({ ...p, city: e.target.value }))} className="flex-1" />
            <Input aria-label="Poštna številka" placeholder="PT" value={form.postCode} onChange={e => onSetForm(p => ({ ...p, postCode: e.target.value }))} className="w-20" />
          </div>
          <Input aria-label="Telefon" placeholder="Telefon" value={form.phone} onChange={e => onSetForm(p => ({ ...p, phone: e.target.value }))} />
          <Input aria-label="E-pošta" placeholder="E-pošta" value={form.email} onChange={e => onSetForm(p => ({ ...p, email: e.target.value }))} />
          <Input aria-label="Matična številka" placeholder="Matična št." value={form.businessId} onChange={e => onSetForm(p => ({ ...p, businessId: e.target.value }))} />
          <Input aria-label="DDV identifikacija" placeholder="DDV ID" value={form.taxId} onChange={e => onSetForm(p => ({ ...p, taxId: e.target.value }))} />
          <Input aria-label="Številka blagajne" placeholder="Blagajna št." value={form.registerNumber} onChange={e => onSetForm(p => ({ ...p, registerNumber: e.target.value }))} />
          <Input aria-label="ID poslovnega prostora" placeholder="ID posl. prostora" value={form.premisesId} onChange={e => onSetForm(p => ({ ...p, premisesId: e.target.value }))} />
        </div>
        <div className="flex gap-2">
          <Button onClick={onSubmit} disabled={!form.name || !form.code || createPending} className="flex-1">
            {createPending ? 'Ustvarjam...' : 'Ustvari lokacijo'}
          </Button>
          <Button variant="outline" onClick={onCancel}>Prekliči</Button>
        </div>
      </CardContent>
    </Card>
  )
})
