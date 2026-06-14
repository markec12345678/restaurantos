'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
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
// ALT PAYMENT TYPE FORM - Obrazec za alternativne vrste plačil
// ============================================
export const AltPaymentTypeForm = memo(function AltPaymentTypeForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Ime</Label>
        <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Boni" aria-label="npr. Boni" autoFocus/>
      </div>
      <div>
        <Label>Koda</Label>
        <Input value={String(formData.code || '')} onChange={e => update('code', e.target.value)} placeholder="npr. VOUCHER" aria-label="npr. VOUCHER"/>
      </div>
      <div>
        <Label>Vrsta</Label>
        <Select value={String(formData.type || 'voucher')} onValueChange={v => update('type', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="voucher">Vavčer</SelectItem>
            <SelectItem value="coupon">Kupon</SelectItem>
            <SelectItem value="crypto">Kriptovaluta</SelectItem>
            <SelectItem value="mobile">Mobilno plačilo</SelectItem>
            <SelectItem value="other">Drugo</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
})

// ============================================
// PRINTER FORM - Obrazec za tiskalnike
// ============================================
export const PrinterForm = memo(function PrinterForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Ime</Label>
        <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Kuhinjski tiskalnik" aria-label="npr. Kuhinjski tiskalnik" autoFocus/>
      </div>
      <div>
        <Label>Vrsta</Label>
        <Select value={String(formData.type || 'thermal')} onValueChange={v => update('type', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="thermal">Termični</SelectItem>
            <SelectItem value="impact">Iglični</SelectItem>
            <SelectItem value="label">Etiketni</SelectItem>
            <SelectItem value="receipt">Blagajniški</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Lokacija</Label>
        <Input value={String(formData.location || '')} onChange={e => update('location', e.target.value)} placeholder="npr. Kuhinja" aria-label="npr. Kuhinja"/>
      </div>
      <div>
        <Label>IP naslov</Label>
        <Input value={String(formData.ipAddress || '')} onChange={e => update('ipAddress', e.target.value)} placeholder="192.168.1.100" aria-label="192.168.1.100"/>
      </div>
    </div>
  )
})

// ============================================
// DISCOUNT FORM - Obrazec za popuste
// ============================================
export const DiscountForm = memo(function DiscountForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Ime</Label>
        <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Zgodnja ptica" aria-label="npr. Zgodnja ptica" autoFocus/>
      </div>
      <div>
        <Label>Vrsta popusta</Label>
        <Select value={String(formData.type || 'percentage')} onValueChange={v => update('type', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="percentage">Odstotek</SelectItem>
            <SelectItem value="fixed">Fiksni znesek</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Znesek {formData.type === 'percentage' ? '(%)' : '(€)'}</Label>
        <Input type="number" step="0.01" value={String(formData.amount ?? '')} onChange={e => update('amount', e.target.value)} placeholder="10" aria-label="10"/>
      </div>
      <div>
        <Label>Velja za</Label>
        <Select value={String(formData.appliesTo || 'all')} onValueChange={v => update('appliesTo', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vse</SelectItem>
            <SelectItem value="items">Artikli</SelectItem>
            <SelectItem value="categories">Kategorije</SelectItem>
            <SelectItem value="order">Celotno naročilo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Sprožilec</Label>
        <Select value={String(formData.triggerType || 'manual')} onValueChange={v => update('triggerType', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Ročno</SelectItem>
            <SelectItem value="auto">Samodejno</SelectItem>
            <SelectItem value="promo-code">Promocijska koda</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Promocijska koda</Label>
        <Input value={String(formData.promoCode || '')} onChange={e => update('promoCode', e.target.value)} placeholder="Opcijsko" aria-label="Opcijsko"/>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Veljavno od</Label>
          <Input type="date" value={String(formData.validFrom || '')} onChange={e => update('validFrom', e.target.value)} />
        </div>
        <div>
          <Label>Veljavno do</Label>
          <Input type="date" value={String(formData.validTo || '')} onChange={e => update('validTo', e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Največ uporab</Label>
        <Input type="number" value={String(formData.maxUses ?? '0')} onChange={e => update('maxUses', e.target.value)} placeholder="0 = neomejeno" aria-label="0 = neomejeno"/>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
        <Label>Aktiven</Label>
      </div>
    </div>
  )
})

// ============================================
// GIFT CARD FORM - Obrazec za darilne kartice
// ============================================
export const GiftCardForm = memo(function GiftCardForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Številka kartice</Label>
        <Input value={String(formData.cardNumber || '')} onChange={e => update('cardNumber', e.target.value)} placeholder="GC-000001" aria-label="GC-000001" autoFocus/>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Stanje (€)</Label>
          <Input type="number" step="0.01" value={String(formData.balance ?? '')} onChange={e => update('balance', e.target.value)} />
        </div>
        <div>
          <Label>Začetno stanje (€)</Label>
          <Input type="number" step="0.01" value={String(formData.initialBalance ?? '')} onChange={e => update('initialBalance', e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Ime lastnika</Label>
        <Input value={String(formData.ownerName || '')} onChange={e => update('ownerName', e.target.value)} placeholder="Ime Priimek" aria-label="Ime Priimek"/>
      </div>
      <div>
        <Label>Datum poteka</Label>
        <Input type="date" value={String(formData.expiresAt || '')} onChange={e => update('expiresAt', e.target.value)} />
      </div>
      <div>
        <Label>Status</Label>
        <Select value={String(formData.status || 'active')} onValueChange={v => update('status', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Aktivna</SelectItem>
            <SelectItem value="expired">Potekla</SelectItem>
            <SelectItem value="used">Porabljena</SelectItem>
            <SelectItem value="disabled">Onemogočena</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
})

// ============================================
// LOYALTY FORM - Obrazec za zvestobo
// ============================================
export const LoyaltyForm = memo(function LoyaltyForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Ime stranke</Label>
        <Input value={String(formData.customerName || '')} onChange={e => update('customerName', e.target.value)} placeholder="Ime Priimek" aria-label="Ime Priimek" autoFocus/>
      </div>
      <div>
        <Label>Telefon</Label>
        <Input value={String(formData.phone || '')} onChange={e => update('phone', e.target.value)} placeholder="+386..." aria-label="+386"/>
      </div>
      <div>
        <Label>E-pošta</Label>
        <Input type="email" value={String(formData.email || '')} onChange={e => update('email', e.target.value)} placeholder="ime@primer.si" aria-label="ime@primer.si"/>
      </div>
      <div>
        <Label>Stanje točk</Label>
        <Input type="number" value={String(formData.pointsBalance ?? '0')} onChange={e => update('pointsBalance', e.target.value)} />
      </div>
      <div>
        <Label>Raven</Label>
        <Select value={String(formData.tier || 'bronze')} onValueChange={v => update('tier', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="bronze">Bronasta</SelectItem>
            <SelectItem value="silver">Srebrna</SelectItem>
            <SelectItem value="gold">Zlata</SelectItem>
            <SelectItem value="platinum">Platinasta</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
})

// ============================================
// WEBHOOK FORM - Obrazec za webhook
// ============================================
export const WebhookForm = memo(function WebhookForm({ formData, update }: FormFieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Ime</Label>
        <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Slack obvestila" aria-label="npr. Slack obvestila" autoFocus/>
      </div>
      <div>
        <Label>URL</Label>
        <Input value={String(formData.url || '')} onChange={e => update('url', e.target.value)} placeholder="https://..." aria-label="https://"/>
      </div>
      <div>
        <Label>Dogodki (ločeni z vejico)</Label>
        <Input
          value={String(formData.events || '')}
          onChange={e => update('events', e.target.value)}
          placeholder="order.created,order.paid,order.cancelled"
          aria-label="Dogodki webhook"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Na voljo: order.created, order.paid, order.cancelled, order.refunded, inventory.low, shift.opened, shift.closed
        </p>
      </div>
      <div>
        <Label>Skrivnost</Label>
        <Input value={String(formData.secret || '')} onChange={e => update('secret', e.target.value)} placeholder="Podpisovalni ključ" aria-label="Podpisovalni ključ"/>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
        <Label>Aktiven</Label>
      </div>
    </div>
  )
})
