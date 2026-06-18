'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Wallet, Shield, Banknote, CreditCard } from 'lucide-react'
import { format } from 'date-fns'
import type { ShiftFursStatusProps } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

/**
 * ShiftFursStatus — prikaz aktivne izmene in FURS davčnega potrjevanja.
 * Dve kartici: stanje izmene (odprta/zaprta) in FURS status.
 */
export const ShiftFursStatus = memo(function ShiftFursStatus({ activeShift, fursStatus }: ShiftFursStatusProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Aktivna izmena */}
      <Card className={`${activeShift ? 'border-emerald-200 dark:border-emerald-900/50' : 'border-amber-200 dark:border-amber-900/50'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${activeShift ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                <Wallet className={`h-5 w-5 ${activeShift ? 'text-emerald-600' : 'text-amber-600'}`} />
              </div>
              <div>
                <p className="font-bold text-sm">{activeShift ? 'Izmena odprta' : 'Ni odprte izmene'}</p>
                <p className="text-xs text-muted-foreground">
                  {activeShift
                    ? `Od: ${format(new Date(activeShift.openedAt), 'HH:mm')} · Začetna blagajna: €${safeToFixed(activeShift.startingCash, 2)}`
                    : 'Odprite izmeno za sledenje prodaje'}
                </p>
              </div>
            </div>
            {activeShift && (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground">Gotovina</p>
                  <p className="font-bold text-sm flex items-center justify-center gap-1"><Banknote className="h-3 w-3" />€{safeToFixed(activeShift.cashSales || 0, 2)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Kartice</p>
                  <p className="font-bold text-sm flex items-center justify-center gap-1"><CreditCard className="h-3 w-3" />€{safeToFixed(activeShift.cardSales || 0, 2)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Skupaj</p>
                  <p className="font-bold text-sm text-primary">€{safeToFixed(activeShift.totalSales || 0, 2)}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* FURS davčno potrjevanje */}
      <Card className={`${fursStatus?.todayUnverified > 0 ? 'border-amber-200 dark:border-amber-900/50' : 'border-blue-200 dark:border-blue-900/50'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${fursStatus?.configured ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                <Shield className={`h-5 w-5 ${fursStatus?.configured ? 'text-blue-600' : 'text-red-600'}`} />
              </div>
              <div>
                <p className="font-bold text-sm">FURS davčno potrjevanje</p>
                <p className="text-xs text-muted-foreground">
                  {fursStatus?.configured
                    ? `Okolje: ${fursStatus.environment === 'production' ? 'PRODUKCIJA' : 'TEST'} · Certifikat nameščen`
                    : 'Certifikat ni nastavljen — overjanje v simulaciji'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-xl font-bold text-emerald-600">{fursStatus?.todayVerified || 0}</p>
                <p className="text-[10px] text-muted-foreground">Overjenih</p>
              </div>
              {(fursStatus?.todayUnverified || 0) > 0 && (
                <div className="text-center">
                  <p className="text-xl font-bold text-amber-600">{fursStatus.todayUnverified}</p>
                  <p className="text-[10px] text-muted-foreground">Brez overjanja</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
