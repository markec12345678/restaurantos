'use client'

// ============================================
// DIALOG ZA DOBAVITELJA — Ustvari/uredi
// ============================================

import { memo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Truck } from 'lucide-react'
import { toast } from 'sonner'
import type { SupplierType } from './constants'
import { BasicInfoFields } from './SubComponents/BasicInfoFields'
import { ContactFields } from './SubComponents/ContactFields'
import { AddressFields } from './SubComponents/AddressFields'
import { BusinessFields } from './SubComponents/BusinessFields'
import { RatingField } from './SubComponents/RatingField'

interface SupplierDialogProps {
  open: boolean
  onClose: () => void
  supplier: SupplierType | null
  onSave: (_data: Record<string, unknown>) => void
}

export const SupplierDialog = memo(function SupplierDialog({
  open,
  onClose,
  supplier,
  onSave,
}: SupplierDialogProps) {
  const isEditing = !!supplier

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [postCode, setPostCode] = useState('')
  const [country, setCountry] = useState('Slovenija')
  const [businessId, setBusinessId] = useState('')
  const [taxId, setTaxId] = useState('')
  const [iban, setIban] = useState('')
  const [bank, setBank] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('30 dni')
  const [minOrderAmount, setMinOrderAmount] = useState(0)
  const [rating, setRating] = useState(0)
  const [isActive, setIsActive] = useState(true)

  const resetForm = () => {
    if (supplier) {
      setName(supplier.name); setCode(supplier.code); setContactPerson(supplier.contactPerson)
      setEmail(supplier.email); setPhone(supplier.phone); setAddress(supplier.address)
      setCity(supplier.city); setPostCode(supplier.postCode); setCountry(supplier.country)
      setBusinessId(supplier.businessId); setTaxId(supplier.taxId); setIban(supplier.iban)
      setBank(supplier.bank); setPaymentTerms(supplier.paymentTerms)
      setMinOrderAmount(supplier.minOrderAmount); setRating(supplier.rating); setIsActive(supplier.isActive)
    } else {
      setName(''); setCode(''); setContactPerson(''); setEmail(''); setPhone('')
      setAddress(''); setCity(''); setPostCode(''); setCountry('Slovenija')
      setBusinessId(''); setTaxId(''); setIban(''); setBank('')
      setPaymentTerms('30 dni'); setMinOrderAmount(0); setRating(0); setIsActive(true)
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) resetForm()
    else onClose()
  }

  const handleSave = () => {
    if (!name) {
      toast.error('Ime dobavitelja je obvezno')
      return
    }
    onSave({
      name, code, contactPerson, email, phone,
      address, city, postCode, country,
      businessId, taxId, iban, bank,
      paymentTerms, minOrderAmount, rating, isActive,
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            {isEditing ? 'Uredi dobavitelja' : 'Nov dobavitelj'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <BasicInfoFields name={name} onNameChange={setName} code={code} onCodeChange={setCode} />
          <ContactFields contactPerson={contactPerson} onContactPersonChange={setContactPerson} phone={phone} onPhoneChange={setPhone} email={email} onEmailChange={setEmail} />
          <AddressFields address={address} onAddressChange={setAddress} postCode={postCode} onPostCodeChange={setPostCode} city={city} onCityChange={setCity} />
          <BusinessFields
            businessId={businessId} onBusinessIdChange={setBusinessId}
            taxId={taxId} onTaxIdChange={setTaxId}
            paymentTerms={paymentTerms} onPaymentTermsChange={setPaymentTerms}
            iban={iban} onIbanChange={setIban}
            bank={bank} onBankChange={setBank}
            minOrderAmount={minOrderAmount} onMinOrderAmountChange={setMinOrderAmount}
          />
          <RatingField rating={rating} onRatingChange={setRating} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Prekliči</Button>
          <Button onClick={handleSave}>
            {isEditing ? 'Shrani spremembe' : 'Ustvari dobavitelja'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
