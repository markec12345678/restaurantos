'use client'

import { memo } from 'react'
import { Wifi, WifiOff } from 'lucide-react'
import type { KDSData } from './types'
import { slPluralWord, PRIPRAVLJEN_FORMS, CAKA_GLAGOL_FORMS } from '@/lib/sl-plural'

// --- Props ---

interface KitchenFooterProps {
  stats: KDSData['stats']
  wsConnected: boolean
}

// --- Komponenta ---

export const KitchenFooter = memo(function KitchenFooter({
  stats,
  wsConnected,
}: KitchenFooterProps) {
  return (
    <div className="flex-shrink-0 border-t bg-card px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <span>Povpr. čakalna doba: <strong className={stats.avgWaitTime >= 10 ? 'text-amber-600' : ''}>{stats.avgWaitTime} min</strong></span>
        {/* RUNDA 57c: moški rod + glagolska soglasje — "2 čakata", "0
            pripravljenih" (prej trdo "čaka"/"pripravljeni"); tabular-nums */}
        <span className="tabular-nums">Artikli: <strong>{stats.totalItemsPending}</strong> {slPluralWord(stats.totalItemsPending, CAKA_GLAGOL_FORMS)} / <strong>{stats.totalItemsPreparing}</strong> v pripravi / <strong className="text-emerald-600">{stats.totalItemsReady}</strong> {slPluralWord(stats.totalItemsReady, PRIPRAVLJEN_FORMS)}</span>
        {(stats.readyOrdersCount ?? 0) > 0 && (
          <span>Naročila za prevzem: <strong className="text-emerald-600">{stats.readyOrdersCount}</strong></span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {wsConnected ? (
          <>
            <Wifi className="h-3 w-3 text-emerald-500" />
            <span>Real-time</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3 text-amber-500" />
            <span>Polling: 5s</span>
          </>
        )}
      </div>
    </div>
  )
})
