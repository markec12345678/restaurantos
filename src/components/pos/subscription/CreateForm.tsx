'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CreateFormProps } from './constants'

// ============================================
// OBRAZEC ZA USTVARJANJE — Aktivacija naročnine
// ============================================

export const CreateForm = memo(function CreateForm({ selectedPlan, plans, form, onFormChange, onSubmit, onCancel, isPending }: CreateFormProps) {
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Aktivacija naročnine — {plans[selectedPlan]?.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input aria-label="Ime podjetja" placeholder="Ime podjetja *" value={form.companyName} onChange={e => onFormChange({ ...form, companyName: e.target.value })} className="col-span-2" />
          <Input aria-label="E-pošta" placeholder="E-pošta *" type="email" value={form.email} onChange={e => onFormChange({ ...form, email: e.target.value })} />
          <Input aria-label="Telefon" placeholder="Telefon" value={form.phone} onChange={e => onFormChange({ ...form, phone: e.target.value })} />
          <Input aria-label="Matična številka" placeholder="Matična št." value={form.businessId} onChange={e => onFormChange({ ...form, businessId: e.target.value })} />
          <Input aria-label="DDV identifikacija" placeholder="DDV ID" value={form.taxId} onChange={e => onFormChange({ ...form, taxId: e.target.value })} />
          <div className="flex items-center gap-2">
            <label className="text-sm">Št. lokacij:</label>
            <Input aria-label="Število lokacij" type="number" min={1} max={50} value={form.locationCount} onChange={e => onFormChange({ ...form, locationCount: parseInt(e.target.value) || 1 })} className="w-20" />
          </div>
          <select value={form.paymentMethod} onChange={e => onFormChange({ ...form, paymentMethod: e.target.value })} className="px-3 py-2 rounded-lg border bg-background text-sm">
            <option value="bank_transfer">Bančno nakazilo</option>
            <option value="card">Kartica</option>
            <option value="invoice">Račun</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button onClick={onSubmit} disabled={!form.companyName || !form.email || isPending} className="flex-1">
            {isPending ? 'Ustvarjam...' : `Aktiviraj ${plans[selectedPlan]?.name} (€${plans[selectedPlan]?.price}/mesec)`}
          </Button>
          <Button variant="outline" onClick={onCancel}>Prekliči</Button>
        </div>
      </CardContent>
    </Card>
  )
})
