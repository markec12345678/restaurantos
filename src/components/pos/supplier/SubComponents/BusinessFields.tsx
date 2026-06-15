'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

// ============================================
// POSLOVNI PODATKI — Matična št., ID za DDV, plačilni pogoji, IBAN, banka, min. naročilo
// ============================================

interface BusinessFieldsProps {
  businessId: string
  onBusinessIdChange: (_v: string) => void
  taxId: string
  onTaxIdChange: (_v: string) => void
  paymentTerms: string
  onPaymentTermsChange: (_v: string) => void
  iban: string
  onIbanChange: (_v: string) => void
  bank: string
  onBankChange: (_v: string) => void
  minOrderAmount: number
  onMinOrderAmountChange: (_v: number) => void
}

export const BusinessFields = memo(function BusinessFields({
  businessId, onBusinessIdChange, taxId, onTaxIdChange, paymentTerms, onPaymentTermsChange,
  iban, onIbanChange, bank, onBankChange, minOrderAmount, onMinOrderAmountChange,
}: BusinessFieldsProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Poslovni podatki</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="supplier-bizid" className="text-xs font-medium">Matična številka</Label>
          <Input id="supplier-bizid" value={businessId} onChange={e => onBusinessIdChange(e.target.value)} placeholder="12345678" className="h-9 text-sm font-mono" />
        </div>
        <div>
          <Label htmlFor="supplier-taxid" className="text-xs font-medium">ID za DDV</Label>
          <Input id="supplier-taxid" value={taxId} onChange={e => onTaxIdChange(e.target.value)} placeholder="SI12345678" className="h-9 text-sm font-mono" />
        </div>
        <div>
          <Label htmlFor="supplier-payment" className="text-xs font-medium">Plačilni pogoji</Label>
          <Select value={paymentTerms} onValueChange={onPaymentTermsChange}>
            <SelectTrigger className="h-9 text-sm" id="supplier-payment"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="14 dni">14 dni</SelectItem>
              <SelectItem value="30 dni">30 dni</SelectItem>
              <SelectItem value="60 dni">60 dni</SelectItem>
              <SelectItem value="2% popust 10 dni">2% popust 10 dni</SelectItem>
              <SelectItem value="Plačilo ob prevzemu">Plačilo ob prevzemu</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="supplier-iban" className="text-xs font-medium">IBAN</Label>
          <Input id="supplier-iban" value={iban} onChange={e => onIbanChange(e.target.value)} placeholder="SI56 0123 4567 8901 234" className="h-9 text-sm font-mono" />
        </div>
        <div>
          <Label htmlFor="supplier-bank" className="text-xs font-medium">Banka</Label>
          <Input id="supplier-bank" value={bank} onChange={e => onBankChange(e.target.value)} placeholder="NLB d.d." className="h-9 text-sm" />
        </div>
        <div>
          <Label htmlFor="supplier-minorder" className="text-xs font-medium">Min. znesek naročila</Label>
          <Input id="supplier-minorder" type="number" value={minOrderAmount} onChange={e => onMinOrderAmountChange(parseFloat(e.target.value) || 0)} className="h-9 text-sm" />
        </div>
      </div>
    </div>
  )
})
