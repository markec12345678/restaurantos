'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Plug } from 'lucide-react'
import { getConnectorTypes } from '@/lib/integrations/connectors'
import type { IntegrationDialogProps } from './constants'
import dynamic from 'next/dynamic'

// Lazy-loaded podkomponenta
const IntegrationConnectorCards = dynamic(() => import('./IntegrationConnectorCards').then(m => ({ default: m.IntegrationConnectorCards })), { ssr: false })

// ============================================
// DIJALOG ZA VNOS/UREJANJE INTEGRACIJE
// ============================================

export const IntegrationDialog = memo(function IntegrationDialog({
  open,
  onOpenChange,
  editingItem,
  selectedConnector,
  formData,
  onFormDataChange,
  onSelectConnector,
  onSubmit,
  onCancel,
  isCreating,
  isUpdating,
}: IntegrationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5 text-primary" />
            {editingItem ? 'Uredi integracijo' : 'Dodaj integracijo'}
          </DialogTitle>
          <DialogDescription>
            {editingItem ? 'Posodobite nastavitve integracije.' : 'Izberite konektor ali ustvarite splošno integracijo.'}
          </DialogDescription>
        </DialogHeader>

        {/* Izbor konektorja — samo pri ustvarjanju */}
        {!editingItem && !selectedConnector && (
          <IntegrationConnectorCards onSelectConnector={onSelectConnector} />
        )}

        {/* Obrazec za urejanje */}
        {(editingItem || selectedConnector) && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="int-name" className="text-sm font-semibold">Ime *</Label>
                <Input id="int-name" placeholder="npr. Moji e-Računi" value={formData.name} onChange={e => onFormDataChange({ ...formData, name: e.target.value })} aria-label="Ime integracije" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="int-type" className="text-sm font-semibold">Tip</Label>
                <Select value={formData.type} onValueChange={v => onFormDataChange({ ...formData, type: v })}>
                  <SelectTrigger id="int-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getConnectorTypes().map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="int-baseurl" className="text-sm font-semibold">Base URL</Label>
              <Input id="int-baseurl" placeholder="https://api.example.com" value={formData.baseUrl} onChange={e => onFormDataChange({ ...formData, baseUrl: e.target.value })} aria-label="Base URL" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="int-apikey" className="text-sm font-semibold">API Ključ</Label>
                <Input id="int-apikey" type="password" placeholder="Vaš API ključ" value={formData.apiKey} onChange={e => onFormDataChange({ ...formData, apiKey: e.target.value })} aria-label="API Ključ" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="int-apisecret" className="text-sm font-semibold">API Skrivnost</Label>
                <Input id="int-apisecret" type="password" placeholder="Vaša API skrivnost" value={formData.apiSecret} onChange={e => onFormDataChange({ ...formData, apiSecret: e.target.value })} aria-label="API Skrivnost" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="int-config" className="text-sm font-semibold">Konfiguracija (JSON)</Label>
              <textarea
                id="int-config"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                placeholder='{"companyId": "123"}'
                value={formData.config}
                onChange={e => onFormDataChange({ ...formData, config: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="int-sync" className="text-sm font-semibold">Sinhronizacija</Label>
                  <p className="text-xs text-muted-foreground">Omogoči samodejno sinh.</p>
                </div>
                <Switch id="int-sync" checked={formData.syncEnabled} onCheckedChange={checked => onFormDataChange({ ...formData, syncEnabled: checked })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="int-interval" className="text-sm font-semibold">Interval (sekunde)</Label>
                <Input id="int-interval" type="number" min={60} max={86400} value={formData.syncInterval} onChange={e => onFormDataChange({ ...formData, syncInterval: parseInt(e.target.value) || 300 })} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="int-active" className="text-sm font-semibold">Aktivna</Label>
                <p className="text-xs text-muted-foreground">Nedejavne integracije se ne sinhronizirajo</p>
              </div>
              <Switch id="int-active" checked={formData.isActive} onCheckedChange={checked => onFormDataChange({ ...formData, isActive: checked })} />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>Prekliči</Button>
          {(editingItem || selectedConnector) && (
            <Button onClick={onSubmit} disabled={isCreating || isUpdating}>
              {isCreating || isUpdating ? (
                <><span className="animate-spin mr-2">⏳</span>Shranjujem...</>
              ) : editingItem ? 'Posodobi' : <><Plus className="h-4 w-4 mr-1.5" />Ustvari</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
