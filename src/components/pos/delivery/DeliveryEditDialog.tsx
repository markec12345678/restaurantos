'use client'

// ============================================
// DIALOG ZA UREJANJE DOSTAVE
// ============================================

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { statusLabels } from './constants'
import type { DeliveryEditDialogProps } from './constants'

export const DeliveryEditDialog = memo(function DeliveryEditDialog({
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  onUpdate,
  isPending,
}: DeliveryEditDialogProps) {
  const set = (field: string, value: string) => onFormDataChange({ ...formData, [field]: value })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Uredi dostavo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label htmlFor="dlv-address">Naslov *</Label><Input id="dlv-address" value={formData.address} onChange={(e) => set('address', e.target.value)} autoFocus /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="dlv-city">Mesto</Label><Input id="dlv-city" value={formData.city} onChange={(e) => set('city', e.target.value)} /></div>
            <div><Label htmlFor="dlv-postcode">Poštna številka</Label><Input id="dlv-postcode" value={formData.postCode} onChange={(e) => set('postCode', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="dlv-recipient">Prejemnik</Label><Input id="dlv-recipient" value={formData.recipientName} onChange={(e) => set('recipientName', e.target.value)} /></div>
            <div><Label htmlFor="dlv-phone">Telefon</Label><Input id="dlv-phone" value={formData.recipientPhone} onChange={(e) => set('recipientPhone', e.target.value)} /></div>
          </div>
          <div><Label htmlFor="dlv-instructions">Navodila za dostavo</Label><Textarea id="dlv-instructions" value={formData.deliveryInstructions} onChange={(e) => set('deliveryInstructions', e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="dlv-courier">Kurir</Label><Input id="dlv-courier" value={formData.courierName} onChange={(e) => set('courierName', e.target.value)} /></div>
            <div><Label htmlFor="dlv-courier-phone">Telefon kurirja</Label><Input id="dlv-courier-phone" value={formData.courierPhone} onChange={(e) => set('courierPhone', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label htmlFor="dlv-status">Status</Label>
              <Select value={formData.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger id="dlv-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor="dlv-fee">Dostavna cena (€)</Label><Input id="dlv-fee" type="number" step="0.01" value={formData.deliveryFee} onChange={(e) => set('deliveryFee', e.target.value)} /></div>
            <div><Label htmlFor="dlv-pkg-fee">Embalaža (€)</Label><Input id="dlv-pkg-fee" type="number" step="0.01" value={formData.packagingFee} onChange={(e) => set('packagingFee', e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onUpdate} disabled={isPending}>Posodobi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
