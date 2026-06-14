'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { MenuSyncSectionProps } from './constants'
import type { SyncResultItem } from '@/lib/types'

// Odsek za sinhronizacijo menijev med lokacijami
export const MenuSyncSection = memo(function MenuSyncSection({
  showSync,
  syncSource,
  syncing,
  syncResult,
  locations,
  onSyncSourceChange,
  onSync,
  onCloseSync,
}: MenuSyncSectionProps) {
  if (!showSync) return null

  return (
    <Card className="border-purple-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">Sinhronizacija menijev</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Sinhroniziraj menije, kategorije in artikle iz izvorne lokacije na ciljne lokacije.
          Cene se privzeto NE prenašajo (lahko se razlikujejo med lokacijami).
        </p>
        <div className="space-y-2">
          <label className="text-sm font-medium">Izvorna lokacija (master)</label>
          <select
            value={syncSource}
            onChange={onSyncSourceChange}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
          >
            <option value="">Izberi izvorno lokacijo...</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Ciljne lokacije</label>
          <div className="text-xs text-muted-foreground">
            Vse ostale aktivne lokacije bodo prejele meni iz izvorne lokacije
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={onSync}
            disabled={!syncSource || syncing}
            className="flex-1"
          >
            {syncing ? 'Sinhroniziram...' : 'Sinhroniziraj'}
          </Button>
          <Button variant="outline" onClick={onCloseSync}>Zapri</Button>
        </div>
        {syncResult && (
          <div className={`p-4 rounded-xl border ${syncResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            {syncResult.success ? (
              <div className="space-y-2">
                <p className="font-bold text-green-700">Sinhronizacija uspešna!</p>
                {syncResult.results?.map((r: SyncResultItem, i: number) => (
                  <div key={i} className="text-sm">
                    <p className="font-medium">{r.targetLocationName}:</p>
                    <p className="text-xs text-muted-foreground">
                      Meniji: +{r.menusCreated} | Kategorije: +{r.categoriesCreated} | Artikli: +{r.itemsCreated} posodobljeni: {r.itemsUpdated}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-red-700">{syncResult.error || 'Napaka'}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
})
