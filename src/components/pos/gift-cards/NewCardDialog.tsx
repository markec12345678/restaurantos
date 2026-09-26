'use client'

import { memo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Plus, Gift, RefreshCw } from 'lucide-react'
import { generateCardNumber } from './constants'
import { authFetch } from '@/components/pos/PinLogin'
import { useAuthUser } from '@/components/pos/sidebar/useAuthUser'
import type { NewCardForm } from './useGiftCardDialogs'

// --- Props ---

interface NewCardDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  form: NewCardForm
  onFormChange: (_form: NewCardForm) => void
  onSubmit: () => void
  isPending: boolean
}

// --- R144 #31 (MODEL A): lokacije za izrecno izbiro (samo skrbniki) ---

interface FormLocationOption {
  id: string
  name: string
  isActive: boolean
}

function useFormLocations(enabled: boolean) {
  return useQuery({
    queryKey: ['gift-cards', 'form-locations'] as const,
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

// --- Komponenta ---

export const NewCardDialog = memo(function NewCardDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSubmit,
  isPending,
}: NewCardDialogProps) {
  // R144 #31 (MODEL A): skrbniška seja lahko nima dodeljene lokacije — takrat
  // mora izrecno izbrati lokacijo (ruta: ?locationId= + body, sicer 400 fail-closed).
  // Vzorec R143 LoyaltyFormFields — reuse useAuthUser/authFetch, brez cross-module importov.
  const authUser = useAuthUser()
  const isTenantAdmin = authUser?.role === 'admin' || authUser?.role === 'super_admin'
  const { data: locations } = useFormLocations(isTenantAdmin)
  const showLocationSelect = isTenantAdmin && (locations?.length ?? 0) > 0
  const locationValue = form.locationId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Nova darilna kartica
          </DialogTitle>
          <DialogDescription>
            Ustvarite novo darilno kartico za stranko.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="gc-card-number" className="text-sm font-semibold">Številka kartice</Label>
            <div className="flex gap-2">
              <Input
                id="gc-card-number"
                placeholder="Samodejno generirano"
                value={form.cardNumber}
                onChange={(e) => onFormChange({ ...form, cardNumber: e.target.value })}
                className="font-mono"
                autoFocus
              />
              <Button
                variant="outline"
                size="icon"
                aria-label="Generiraj številko"
                className="flex-shrink-0"
                title="Generiraj novo številko"
                onClick={() => onFormChange({ ...form, cardNumber: generateCardNumber() })}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Pustite prazno za samodejno generiranje</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gc-owner-name" className="text-sm font-semibold">Lastnik</Label>
            <Input
              id="gc-owner-name"
              placeholder="Ime in priimek lastnika"
              value={form.ownerName}
              onChange={(e) => onFormChange({ ...form, ownerName: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gc-initial-balance" className="text-sm font-semibold">Začetno stanje (€) *</Label>
            <DecimalInput
              id="gc-initial-balance"
              placeholder="0.00"
              value={form.initialBalance}
              onValueChange={(n) => onFormChange({ ...form, initialBalance: String(n) })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gc-new-expires" className="text-sm font-semibold">Datum poteka</Label>
            <Input
              id="gc-new-expires"
              type="date"
              value={form.expiresAt}
              onChange={(e) => onFormChange({ ...form, expiresAt: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Pustite prazno za kartico brez roka veljavnosti</p>
          </div>

          {/* R144 #31 (MODEL A): izrecna lokacija (samo skrbniki) */}
          {showLocationSelect && (
            <div className="space-y-1.5">
              <Label htmlFor="gc-new-location" className="text-sm font-semibold">Lokacija</Label>
              <Select
                value={locationValue}
                onValueChange={(v) => onFormChange({ ...form, locationId: v })}
              >
                <SelectTrigger id="gc-new-location">
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
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Prekliči
          </Button>
          <Button
            onClick={onSubmit}
            disabled={
              !form.initialBalance ||
              parseFloat(form.initialBalance) <= 0 ||
              isPending
            }
          >
            {isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Ustvarjam...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1.5" />
                Ustvari kartico
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
