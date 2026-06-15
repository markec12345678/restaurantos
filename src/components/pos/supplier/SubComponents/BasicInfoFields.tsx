'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ============================================
// OSNOVNI PODATKI — Ime, koda dobavitelja
// ============================================

interface BasicInfoFieldsProps {
  name: string
  onNameChange: (_v: string) => void
  code: string
  onCodeChange: (_v: string) => void
}

export const BasicInfoFields = memo(function BasicInfoFields({
  name, onNameChange, code, onCodeChange,
}: BasicInfoFieldsProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Osnovni podatki</p>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Label htmlFor="supplier-name" className="text-xs font-medium">Naziv podjetja *</Label>
          <Input id="supplier-name" value={name} onChange={e => onNameChange(e.target.value)} placeholder="Mesarija Novak d.o.o." className="h-9 text-sm" autoFocus />
        </div>
        <div>
          <Label htmlFor="supplier-code" className="text-xs font-medium">Koda</Label>
          <Input id="supplier-code" value={code} onChange={e => onCodeChange(e.target.value)} placeholder="MN" className="h-9 text-sm font-mono" />
        </div>
      </div>
    </div>
  )
})
