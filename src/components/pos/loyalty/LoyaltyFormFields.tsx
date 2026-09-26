'use client'

import { memo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { tierConfig } from './constants'
import { useAuthUser } from '@/components/pos/sidebar/useAuthUser'
import { authFetch } from '@/components/pos/PinLogin'

export interface FormData {
  customerName: string
  customerPhone: string
  customerEmail: string
  tier: string
  isActive: boolean
  /** R143 #30: izrecna lokacija (MODEL A) — obvezna, če seja nima dodeljene lokacije */
  locationId?: string
}

interface LoyaltyFormFieldsProps {
  formData: FormData
  onFormDataChange: (_data: FormData) => void
}

interface FormLocationOption { id: string; name: string; isActive: boolean }

/** R143 #30: aktivne lokacije za izrecno dodelitev (devices reassign kanon) */
function useFormLocations(enabled: boolean) {
  return useQuery({
    queryKey: ['loyalty', 'form-locations'] as const,
    queryFn: async (): Promise<FormLocationOption[]> => {
      const res = await authFetch('/api/locations')
      if (!res.ok) return []
      const json = await res.json() as unknown
      const rows: Array<Record<string, unknown>> = Array.isArray(json)
        ? json as Array<Record<string, unknown>>
        : ((json as { locations?: Array<Record<string, unknown>> })?.locations ?? [])
      return rows
        .map((r) => ({ id: String(r.id ?? ''), name: String(r.name ?? ''), isActive: r.isActive !== false }))
        .filter((r) => r.id && r.name)
    },
    enabled,
    staleTime: 60_000,
    retry: 1,
  })
}

export const LoyaltyFormFields = memo(function LoyaltyFormFields({
  formData,
  onFormDataChange,
}: LoyaltyFormFieldsProps) {
  // R143 #30 (MODEL A): skrbniška seja lahko nima dodeljene lokacije — takrat
  // mora izrecno izbrati lokacijo (ruta: ?locationId=, sicer 400 fail-closed).
  const authUser = useAuthUser()
  const isTenantAdmin = authUser?.role === 'admin' || authUser?.role === 'super_admin'
  const { data: locations } = useFormLocations(isTenantAdmin)
  const showLocationSelect = isTenantAdmin && (locations?.length ?? 0) > 0

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

      {/* R143 #30: izrecna lokacija (samo skrbniki) */}
      {showLocationSelect && (
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Lokacija</Label>
          <Select
            value={formData.locationId ?? ''}
            onValueChange={(v) => onFormDataChange({ ...formData, locationId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Izberite lokacijo" />
            </SelectTrigger>
            <SelectContent>
              {locations!.map((l) => (
                <SelectItem key={l.id} value={l.id} disabled={!l.isActive}>
                  {l.name}{!l.isActive ? ' (neaktivna)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Obvezno, če vaš profil nima dodeljene lokacije
          </p>
        </div>
      )}

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
