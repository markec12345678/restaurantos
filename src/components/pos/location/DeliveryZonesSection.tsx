'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Navigation, Plus, Trash2 } from 'lucide-react'
import type { DeliveryZonesSectionProps } from './constants'
import type { DeliveryZoneRow } from '@/lib/types'

// Odsek za upravljanje con dostave
export const DeliveryZonesSection = memo(function DeliveryZonesSection({
  showZones,
  zonesLoading,
  zonesData,
  showZoneForm,
  zoneForm,
  locations,
  createZonePending,
  onSetZoneForm,
  onShowZoneForm,
  onZoneFormSubmit,
  onDeleteZone,
}: DeliveryZonesSectionProps) {
  if (!showZones) return null

  // Obdelava seznama con — podpira različne formate odgovora API-ja
  const zones: DeliveryZoneRow[] = (Array.isArray(zonesData) ? zonesData : (zonesData as { deliveryZones?: DeliveryZoneRow[] } | null)?.deliveryZones) || []

  return (
    <Card className="border-emerald-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Navigation className="h-4 w-4" /> Cone dostave
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Določite cone dostave s cenami, minimalnimi naročili in predvidenim časom za vsako cono.
        </p>

        {/* Seznam con */}
        {zonesLoading ? (
          <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : (
          <div className="space-y-2">
            {zones.map((zone: DeliveryZoneRow) => (
              <div key={zone.id} className="flex items-center justify-between p-3 rounded-xl border bg-muted/30">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm">{zone.name}</h4>
                    {zone.locationId && <Badge variant="outline" className="text-[10px]">Lokacija</Badge>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>Dostava: €{(zone.deliveryFee || 0).toFixed(2)}</span>
                    <span>Min: €{(zone.minOrderAmount || 0).toFixed(2)}</span>
                    {zone.freeDeliveryAbove != null && zone.freeDeliveryAbove > 0 && <span className="text-green-600">Brezplačno nad €{zone.freeDeliveryAbove.toFixed(2)}</span>}
                    <span>{(zone.estimatedMinutes ?? 30)} min</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {(() => { try { const pc = JSON.parse(zone.postCodes || '[]'); return pc.length > 0 ? `PT: ${pc.join(', ')}` : '' } catch { return '' } })()}
                    {(() => { try { const c = JSON.parse(zone.cities || '[]'); return c.length > 0 ? ` | Mesta: ${c.join(', ')}` : '' } catch { return '' } })()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={zone.isActive ? 'default' : 'secondary'} className={zone.isActive ? 'bg-green-600' : ''}>
                    {zone.isActive ? 'Aktivna' : 'Neaktivna'}
                  </Badge>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 h-7 w-7 p-0" onClick={() => onDeleteZone(zone)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {(zones.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">Ni dodanih con dostave</p>
            )}
          </div>
        )}

        {/* Obrazec za dodajanje cone */}
        {showZoneForm ? (
          <div className="space-y-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
            <h4 className="font-semibold text-sm">Nova cona dostave</h4>
            <div className="grid grid-cols-2 gap-2">
              <Input aria-label="Ime cone" placeholder="Ime cone (npr. Center LJU) *" value={zoneForm.name} onChange={e => onSetZoneForm(p => ({ ...p, name: e.target.value }))} className="col-span-2" />
              <Input aria-label="Poštne številke" placeholder="Poštne št. (1000,1001,1000)" value={zoneForm.postCodes} onChange={e => onSetZoneForm(p => ({ ...p, postCodes: e.target.value }))} className="col-span-2" />
              <Input aria-label="Mesta" placeholder="Mesta (Ljubljana,Domžale)" value={zoneForm.cities} onChange={e => onSetZoneForm(p => ({ ...p, cities: e.target.value }))} className="col-span-2" />
              <Input aria-label="Cena dostave" placeholder="Cena dostave (€)" type="number" step="0.50" value={zoneForm.deliveryFee} onChange={e => onSetZoneForm(p => ({ ...p, deliveryFee: e.target.value }))} />
              <Input aria-label="Minimalno naročilo" placeholder="Min. naročilo (€)" type="number" step="1" value={zoneForm.minOrderAmount} onChange={e => onSetZoneForm(p => ({ ...p, minOrderAmount: e.target.value }))} />
              <Input aria-label="Brezplačna dostava nad" placeholder="Brezpl. dostava nad (€)" type="number" step="1" value={zoneForm.freeDeliveryAbove} onChange={e => onSetZoneForm(p => ({ ...p, freeDeliveryAbove: e.target.value }))} />
              <Input aria-label="Predviden čas dostave" placeholder="Predviden čas (min)" type="number" value={zoneForm.estimatedMinutes} onChange={e => onSetZoneForm(p => ({ ...p, estimatedMinutes: e.target.value }))} />
              <select value={zoneForm.locationId} onChange={e => onSetZoneForm(p => ({ ...p, locationId: e.target.value }))} className="col-span-2 px-3 py-2 rounded-lg border bg-background text-sm">
                <option value="">Vse lokacije</option>
                {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={onZoneFormSubmit} disabled={!zoneForm.name || createZonePending} className="flex-1">
                {createZonePending ? 'Ustvarjam...' : 'Dodaj cono'}
              </Button>
              <Button variant="outline" onClick={() => onShowZoneForm(false)}>Prekliči</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => onShowZoneForm(true)} className="gap-2 w-full">
            <Plus className="h-4 w-4" /> Dodaj cono dostave
          </Button>
        )}
      </CardContent>
    </Card>
  )
})
