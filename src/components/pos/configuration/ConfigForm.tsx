'use client'
import React from 'react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

// ============================================
// OBRAZEC ZA UREJANJE
// ============================================
export function ConfigForm({
  tabKey,
  formData,
  setFormData,
}: {
  tabKey: string
  formData: Record<string, unknown>
  setFormData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
}) {
  const update = (key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }
  switch (tabKey) {
    case 'tax-rates':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. DDV 22%"  aria-label="npr. DDV 22%" autoFocus/>
          </div>
          <div>
            <Label>Stopnja (%)</Label>
            <Input type="number" step="0.01" value={String(formData.rate ?? '')} onChange={e => update('rate', e.target.value)} placeholder="22"  aria-label="22"/>
          </div>
          <div>
            <Label>Koda</Label>
            <Input value={String(formData.code || '')} onChange={e => update('code', e.target.value)} placeholder="npr. S"  aria-label="npr. S"/>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
            <Label>Aktivna</Label>
          </div>
        </div>
      )
    case 'dining-options':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Hrana na licu mesta"  aria-label="npr. Hrana na licu mesta" autoFocus/>
          </div>
          <div>
            <Label>Vrsta</Label>
            <Select value={String(formData.type || 'dine-in')} onValueChange={v => update('type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dine-in">Na licu mesta</SelectItem>
                <SelectItem value="takeout">Za s seboj</SelectItem>
                <SelectItem value="delivery">Dostava</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Pripravljalni čas (min)</Label>
            <Input type="number" value={String(formData.prepTimeMinutes ?? '')} onChange={e => update('prepTimeMinutes', e.target.value)} placeholder="15"  aria-label="15"/>
          </div>
          <div>
            <Label>Povezani servisni strošek</Label>
            <Input value={String(formData.linkedServiceCharge || '')} onChange={e => update('linkedServiceCharge', e.target.value)} placeholder="Opcijsko"  aria-label="Opcijsko"/>
          </div>
        </div>
      )
    case 'revenue-centers':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Glavni bar"  aria-label="npr. Glavni bar" autoFocus/>
          </div>
          <div>
            <Label>Koda</Label>
            <Input value={String(formData.code || '')} onChange={e => update('code', e.target.value)} placeholder="npr. BAR-01"  aria-label="npr. BAR-01"/>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
            <Label>Aktiven</Label>
          </div>
        </div>
      )
    case 'sales-categories':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Hrana"  aria-label="npr. Hrana" autoFocus/>
          </div>
          <div>
            <Label>Koda</Label>
            <Input value={String(formData.code || '')} onChange={e => update('code', e.target.value)} placeholder="npr. FOOD"  aria-label="npr. FOOD"/>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
            <Label>Aktivna</Label>
          </div>
        </div>
      )
    case 'price-groups':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Redna cena"  aria-label="npr. Redna cena" autoFocus/>
          </div>
          <div>
            <Label>Opis</Label>
            <Textarea value={String(formData.description || '')} onChange={e => update('description', e.target.value)} placeholder="Opis cenika..."  aria-label="Opis cenika"/>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
            <Label>Aktiven</Label>
          </div>
        </div>
      )
    case 'service-charges':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Pribitki za postrežbo"  aria-label="npr. Pribitki za postrežbo" autoFocus/>
          </div>
          <div>
            <Label>Vrsta</Label>
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
            <Input type="number" step="0.01" value={String(formData.amount ?? '')} onChange={e => update('amount', e.target.value)} placeholder="10"  aria-label="10"/>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(formData.isAutoApply)} onCheckedChange={c => update('isAutoApply', c)} />
            <Label>Samodejno dodaj</Label>
          </div>
        </div>
      )
    case 'prep-stations':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Vroča kuhinja"  aria-label="npr. Vroča kuhinja" autoFocus/>
          </div>
          <div>
            <Label>Vrsta</Label>
            <Select value={String(formData.type || 'kitchen')} onValueChange={v => update('type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kitchen">Kuhinja</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="grill">Žar</SelectItem>
                <SelectItem value="pastry">Slaščičarna</SelectItem>
                <SelectItem value="cold">Hladna kuhinja</SelectItem>
                <SelectItem value="other">Drugo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Povprečni čas priprave (min)</Label>
            <Input type="number" value={String(formData.avgPrepTime ?? '')} onChange={e => update('avgPrepTime', e.target.value)} placeholder="12"  aria-label="12"/>
          </div>
        </div>
      )
    case 'void-reasons':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Naročilo po pomoti"  aria-label="npr. Naročilo po pomoti" autoFocus/>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
            <Label>Aktiven</Label>
          </div>
        </div>
      )
    case 'no-sale-reasons':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Odprt fižek"  aria-label="npr. Odprt fižek" autoFocus/>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
            <Label>Aktiven</Label>
          </div>
        </div>
      )
    case 'alt-payment-types':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Boni"  aria-label="npr. Boni" autoFocus/>
          </div>
          <div>
            <Label>Koda</Label>
            <Input value={String(formData.code || '')} onChange={e => update('code', e.target.value)} placeholder="npr. VOUCHER"  aria-label="npr. VOUCHER"/>
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
    case 'printers':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Kuhinjski tiskalnik"  aria-label="npr. Kuhinjski tiskalnik" autoFocus/>
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
            <Input value={String(formData.location || '')} onChange={e => update('location', e.target.value)} placeholder="npr. Kuhinja"  aria-label="npr. Kuhinja"/>
          </div>
          <div>
            <Label>IP naslov</Label>
            <Input value={String(formData.ipAddress || '')} onChange={e => update('ipAddress', e.target.value)} placeholder="192.168.1.100"  aria-label="192.168.1.100"/>
          </div>
        </div>
      )
    case 'discounts':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Zgodnja ptica"  aria-label="npr. Zgodnja ptica" autoFocus/>
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
            <Input type="number" step="0.01" value={String(formData.amount ?? '')} onChange={e => update('amount', e.target.value)} placeholder="10"  aria-label="10"/>
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
            <Input value={String(formData.promoCode || '')} onChange={e => update('promoCode', e.target.value)} placeholder="Opcijsko"  aria-label="Opcijsko"/>
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
            <Input type="number" value={String(formData.maxUses ?? '0')} onChange={e => update('maxUses', e.target.value)} placeholder="0 = neomejeno"  aria-label="0 = neomejeno"/>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
            <Label>Aktiven</Label>
          </div>
        </div>
      )
    case 'gift-cards':
      return (
        <div className="space-y-3">
          <div>
            <Label>Številka kartice</Label>
            <Input value={String(formData.cardNumber || '')} onChange={e => update('cardNumber', e.target.value)} placeholder="GC-000001"  aria-label="GC-000001" autoFocus/>
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
            <Input value={String(formData.ownerName || '')} onChange={e => update('ownerName', e.target.value)} placeholder="Ime Priimek"  aria-label="Ime Priimek"/>
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
    case 'loyalty':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime stranke</Label>
            <Input value={String(formData.customerName || '')} onChange={e => update('customerName', e.target.value)} placeholder="Ime Priimek"  aria-label="Ime Priimek" autoFocus/>
          </div>
          <div>
            <Label>Telefon</Label>
            <Input value={String(formData.phone || '')} onChange={e => update('phone', e.target.value)} placeholder="+386..."  aria-label="+386"/>
          </div>
          <div>
            <Label>E-pošta</Label>
            <Input type="email" value={String(formData.email || '')} onChange={e => update('email', e.target.value)} placeholder="ime@primer.si"  aria-label="ime@primer.si"/>
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
    case 'webhooks':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Slack obvestila"  aria-label="npr. Slack obvestila" autoFocus/>
          </div>
          <div>
            <Label>URL</Label>
            <Input value={String(formData.url || '')} onChange={e => update('url', e.target.value)} placeholder="https://..."  aria-label="https://"/>
          </div>
          <div>
            <Label>Dogodki (ločeni z vejico)</Label>
            <Textarea
              value={String(formData.events || '')}
              onChange={e => update('events', e.target.value)}
              placeholder="order.created,order.paid,order.cancelled"
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Na voljo: order.created, order.paid, order.cancelled, order.refunded, inventory.low, shift.opened, shift.closed
            </p>
          </div>
          <div>
            <Label>Skrivnost</Label>
            <Input value={String(formData.secret || '')} onChange={e => update('secret', e.target.value)} placeholder="Podpisovalni ključ"  aria-label="Podpisovalni ključ"/>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
            <Label>Aktiven</Label>
          </div>
        </div>
      )
    default:
      return <p className="text-muted-foreground">Neznana konfiguracija</p>
  }
}
