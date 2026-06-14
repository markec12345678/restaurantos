'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChefHat, Receipt, ScrollText } from 'lucide-react'
import type { PrinterDialogProps } from './constants'

// ============================================
// DIJALOG ZA USTVARJANJE/UREJANJE TISKALNIKA
// ============================================

export const PrinterDialog = memo(function PrinterDialog({
  open,
  editingPrinter,
  formData,
  onOpenChange,
  onFormDataChange,
  onSubmit,
  isPending,
}: PrinterDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingPrinter ? `Uredi tiskalnik: ${editingPrinter.name}` : 'Dodaj tiskalnik'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Ime */}
          <div>
            <Label htmlFor="printer-name">Ime</Label>
            <Input
              id="printer-name"
              value={formData.name}
              onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
              placeholder="npr. Kuhinja 1, Bar tiskalnik, Blagajna"
              autoFocus
            />
          </div>
          {/* Vrsta */}
          <div>
            <Label htmlFor="printer-type">Vrsta tiskalnika</Label>
            <Select
              value={formData.type}
              onValueChange={(v) => onFormDataChange({ ...formData, type: v })}
            >
              <SelectTrigger id="printer-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thermal">Termični</SelectItem>
                <SelectItem value="dot-matrix">Iglični</SelectItem>
                <SelectItem value="label">Nalepke</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Lokacija */}
          <div>
            <Label htmlFor="printer-location">Lokacija</Label>
            <Input
              id="printer-location"
              value={formData.location}
              onChange={(e) => onFormDataChange({ ...formData, location: e.target.value })}
              placeholder="npr. Kuhinja, Bar, Blagajna"
            />
          </div>
          {/* IP naslov */}
          <div>
            <Label htmlFor="printer-ip">IP naslov</Label>
            <Input
              id="printer-ip"
              value={formData.ipAddress}
              onChange={(e) => onFormDataChange({ ...formData, ipAddress: e.target.value })}
              placeholder="192.168.1.100"
            />
            <p className="text-xs text-muted-foreground mt-1">Omrežni tiskalnik — IP naslov v lokalnem omrežju</p>
          </div>
          {/* Aktivno */}
          <div className="flex items-center gap-2">
            <Switch
              id="printer-active"
              checked={formData.isActive}
              onCheckedChange={(c) => onFormDataChange({ ...formData, isActive: c })}
            />
            <Label htmlFor="printer-active">Aktiven</Label>
          </div>
          {/* Pravila tiskanja */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Pravila tiskanja</Label>
            <p className="text-xs text-muted-foreground">Izberite, kaj se naj tiska na tem tiskalniku</p>
            <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rule-order"
                  checked={formData.printRulesOrder}
                  onCheckedChange={(c) => onFormDataChange({ ...formData, printRulesOrder: !!c })}
                />
                <label htmlFor="rule-order" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <ChefHat className="h-3.5 w-3.5 text-muted-foreground" />
                  Naročila
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rule-receipt"
                  checked={formData.printRulesReceipt}
                  onCheckedChange={(c) => onFormDataChange({ ...formData, printRulesReceipt: !!c })}
                />
                <label htmlFor="rule-receipt" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                  Računi
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rule-prep-station"
                  checked={formData.printRulesPrepStationOrder}
                  onCheckedChange={(c) => onFormDataChange({ ...formData, printRulesPrepStationOrder: !!c })}
                />
                <label htmlFor="rule-prep-station" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <ScrollText className="h-3.5 w-3.5 text-muted-foreground" />
                  Naročila pripravljalne postaje
                </label>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Prekliči
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!formData.name.trim() || isPending}
          >
            {isPending
              ? 'Shranjujem...'
              : editingPrinter
                ? 'Posodobi'
                : 'Ustvari'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
