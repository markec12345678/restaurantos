'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { tierConfig } from './constants'

export interface FormData {
  customerName: string
  customerPhone: string
  customerEmail: string
  tier: string
  isActive: boolean
}

interface LoyaltyFormFieldsProps {
  formData: FormData
  onFormDataChange: (_data: FormData) => void
}

export const LoyaltyFormFields = memo(function LoyaltyFormFields({
  formData,
  onFormDataChange,
}: LoyaltyFormFieldsProps) {
  return (
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
  )
})
