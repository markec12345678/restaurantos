'use client'

// ============================================
// DIALOG ZA DOBAVITELJA — Ustvari/uredi
// ============================================

import { memo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Truck, Star } from 'lucide-react'
import { toast } from 'sonner'
import type { SupplierType } from './constants'

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
      setName(supplier.name)
      setCode(supplier.code)
      setContactPerson(supplier.contactPerson)
      setEmail(supplier.email)
      setPhone(supplier.phone)
      setAddress(supplier.address)
      setCity(supplier.city)
      setPostCode(supplier.postCode)
      setCountry(supplier.country)
      setBusinessId(supplier.businessId)
      setTaxId(supplier.taxId)
      setIban(supplier.iban)
      setBank(supplier.bank)
      setPaymentTerms(supplier.paymentTerms)
      setMinOrderAmount(supplier.minOrderAmount)
      setRating(supplier.rating)
      setIsActive(supplier.isActive)
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
          {/* Osnovni podatki */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Osnovni podatki</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label htmlFor="supplier-name" className="text-xs font-medium">Naziv podjetja *</label>
                <Input id="supplier-name" value={name} onChange={e => setName(e.target.value)} placeholder="Mesarija Novak d.o.o." className="h-9 text-sm" autoFocus/>
              </div>
              <div>
                <label htmlFor="supplier-code" className="text-xs font-medium">Koda</label>
                <Input id="supplier-code" value={code} onChange={e => setCode(e.target.value)} placeholder="MN" className="h-9 text-sm font-mono"/>
              </div>
            </div>
          </div>

          {/* Kontakt */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kontakt</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="supplier-contact" className="text-xs font-medium">Kontaktna oseba</label>
                <Input id="supplier-contact" value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Janez Novak" className="h-9 text-sm"/>
              </div>
              <div>
                <label htmlFor="supplier-phone" className="text-xs font-medium">Telefon</label>
                <Input id="supplier-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+386 1 234 5678" className="h-9 text-sm"/>
              </div>
              <div>
                <label htmlFor="supplier-email" className="text-xs font-medium">E-pošta</label>
                <Input id="supplier-email" value={email} onChange={e => setEmail(e.target.value)} placeholder="info@novak.si" className="h-9 text-sm"/>
              </div>
            </div>
          </div>

          {/* Naslov */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Naslov</p>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2">
                <label htmlFor="supplier-address" className="text-xs font-medium">Ulica in hišna št.</label>
                <Input id="supplier-address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Slovenska 15" className="h-9 text-sm"/>
              </div>
              <div>
                <label htmlFor="supplier-postcode" className="text-xs font-medium">Poštna št.</label>
                <Input id="supplier-postcode" value={postCode} onChange={e => setPostCode(e.target.value)} placeholder="1000" className="h-9 text-sm"/>
              </div>
              <div>
                <label htmlFor="supplier-city" className="text-xs font-medium">Mesto</label>
                <Input id="supplier-city" value={city} onChange={e => setCity(e.target.value)} placeholder="Ljubljana" className="h-9 text-sm"/>
              </div>
            </div>
          </div>

          {/* Poslovni podatki */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Poslovni podatki</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="supplier-bizid" className="text-xs font-medium">Matična številka</label>
                <Input id="supplier-bizid" value={businessId} onChange={e => setBusinessId(e.target.value)} placeholder="12345678" className="h-9 text-sm font-mono"/>
              </div>
              <div>
                <label htmlFor="supplier-taxid" className="text-xs font-medium">ID za DDV</label>
                <Input id="supplier-taxid" value={taxId} onChange={e => setTaxId(e.target.value)} placeholder="SI12345678" className="h-9 text-sm font-mono"/>
              </div>
              <div>
                <label htmlFor="supplier-payment" className="text-xs font-medium">Plačilni pogoji</label>
                <Select value={paymentTerms} onValueChange={setPaymentTerms}>
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
                <label htmlFor="supplier-iban" className="text-xs font-medium">IBAN</label>
                <Input id="supplier-iban" value={iban} onChange={e => setIban(e.target.value)} placeholder="SI56 0123 4567 8901 234" className="h-9 text-sm font-mono"/>
              </div>
              <div>
                <label htmlFor="supplier-bank" className="text-xs font-medium">Banka</label>
                <Input id="supplier-bank" value={bank} onChange={e => setBank(e.target.value)} placeholder="NLB d.d." className="h-9 text-sm"/>
              </div>
              <div>
                <label htmlFor="supplier-minorder" className="text-xs font-medium">Min. znesek naročila</label>
                <Input id="supplier-minorder" type="number" value={minOrderAmount} onChange={e => setMinOrderAmount(parseFloat(e.target.value) || 0)} className="h-9 text-sm" />
              </div>
            </div>
          </div>

          {/* Ocena */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ocena dobavitelja</p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} type="button" onClick={() => setRating(star)} className="transition-transform hover:scale-110" aria-label={star <= rating ? `${star} od 5 zvezdic` : `Izberi ${star} zvezdic`}>
                  <Star className={`h-6 w-6 ${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
                </button>
              ))}
              <span className="text-xs text-muted-foreground ml-2">{rating > 0 ? `${rating}/5` : 'Ni ocene'}</span>
            </div>
          </div>
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
