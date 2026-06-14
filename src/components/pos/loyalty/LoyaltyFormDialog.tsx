'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Plus, Award } from 'lucide-react'
import { type LoyaltyAccount, tierConfig } from './constants'

// --- Props ---

interface FormData {
  customerName: string
  customerPhone: string
  customerEmail: string
  tier: string
  isActive: boolean
}

interface LoyaltyFormDialogProps {
  open: boolean
  editingAccount: LoyaltyAccount | null
  formData: FormData
  isCreatePending: boolean
  isUpdatePending: boolean
  onOpenChange: (_open: boolean) => void
  onFormDataChange: (_data: FormData) => void
  onSubmit: () => void
  onCancel: () => void
}

// --- Komponenta ---

export const LoyaltyFormDialog = memo(function LoyaltyFormDialog({
  open,
  editingAccount,
  formData,
  isCreatePending,
  isUpdatePending,
  onOpenChange,
  onFormDataChange,
  onSubmit,
  onCancel,
}: LoyaltyFormDialogProps) {
  const isPending = isCreatePending || isUpdatePending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            {editingAccount ? 'Uredi zvestobni račun' : 'Dodaj račun'}
          </DialogTitle>
          <DialogDescription>
            {editingAccount
              ? 'Posodobite podatke obstoječega zvestobnega računa.'
              : 'Ustvarite nov zvestobni račun za stranko.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Ime stranke */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Ime stranke *</Label>
            <Input
              placeholder="npr. Ana Novak"
              value={formData.customerName}
              onChange={(e) => onFormDataChange({ ...formData, customerName: e.target.value })}
              autoFocus
            />
          </div>

          {/* Telefon in E-pošta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Telefon</Label>
              <Input
                placeholder="npr. 031 234 567"
                value={formData.customerPhone}
                onChange={(e) => onFormDataChange({ ...formData, customerPhone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">E-pošta</Label>
              <Input
                placeholder="npr. ana@primer.si"
                type="email"
                value={formData.customerEmail}
                onChange={(e) => onFormDataChange({ ...formData, customerEmail: e.target.value })}
              />
            </div>
          </div>

          {/* Nivo */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Nivo</Label>
            <Select
              value={formData.tier}
              onValueChange={(v) => onFormDataChange({ ...formData, tier: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Izberite nivo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(tierConfig).map(([key, cfg]) => {
                  const Icon = cfg.icon
                  return (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Aktiven */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">Aktiven račun</Label>
              <p className="text-xs text-muted-foreground">Nedejavni računi ne morejo zbirati ali unovčevati točk</p>
            </div>
            <Switch
              checked={formData.isActive}
              onCheckedChange={(checked) => onFormDataChange({ ...formData, isActive: checked })}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Prekliči
          </Button>
          <Button
            onClick={onSubmit}
            disabled={
              !formData.customerName.trim() ||
              isPending
            }
          >
            {isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                {editingAccount ? 'Posodabljam...' : 'Vnašam...'}
              </>
            ) : editingAccount ? (
              'Posodobi račun'
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1.5" />
                Dodaj račun
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
