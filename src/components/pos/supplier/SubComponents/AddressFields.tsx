'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ============================================
// NASLOV — Ulica, poštna št., mesto
// ============================================

interface AddressFieldsProps {
  address: string
  onAddressChange: (_v: string) => void
  postCode: string
  onPostCodeChange: (_v: string) => void
  city: string
  onCityChange: (_v: string) => void
}

export const AddressFields = memo(function AddressFields({
  address, onAddressChange, postCode, onPostCodeChange, city, onCityChange,
}: AddressFieldsProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Naslov</p>
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-2">
          <Label htmlFor="supplier-address" className="text-xs font-medium">Ulica in hišna št.</Label>
          <Input id="supplier-address" value={address} onChange={e => onAddressChange(e.target.value)} placeholder="Slovenska 15" className="h-9 text-sm" />
        </div>
        <div>
          <Label htmlFor="supplier-postcode" className="text-xs font-medium">Poštna št.</Label>
          <Input id="supplier-postcode" value={postCode} onChange={e => onPostCodeChange(e.target.value)} placeholder="1000" className="h-9 text-sm" />
        </div>
        <div>
          <Label htmlFor="supplier-city" className="text-xs font-medium">Mesto</Label>
          <Input id="supplier-city" value={city} onChange={e => onCityChange(e.target.value)} placeholder="Ljubljana" className="h-9 text-sm" />
        </div>
      </div>
    </div>
  )
})
