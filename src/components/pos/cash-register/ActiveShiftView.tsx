'use client'

// ============================================
// AKTIVNA IZMENA — Status banner + statistika + pregled plačil
// ============================================

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Wallet, Banknote, CreditCard, Smartphone, Receipt, Split, Gift, CheckCircle2 } from 'lucide-react'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { format } from 'date-fns'
import type { ActiveShiftType, LiveStatsType } from './constants'

interface ActiveShiftViewProps {
  activeShift: ActiveShiftType
  liveStats: LiveStatsType | undefined
}

export const ActiveShiftView = memo(function ActiveShiftView({ activeShift, liveStats }: ActiveShiftViewProps) {
  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <Card className="border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/10">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-emerald-800 dark:text-emerald-400">Izmena odprta</p>
                <p className="text-sm text-muted-foreground">
                  Odprto: {format(new Date(activeShift.openedAt), 'dd.MM.yyyy HH:mm')}
                  {activeShift.employeeName && ` · ${activeShift.employeeName}`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Začetna gotovina</p>
              <p className="text-xl font-bold">&euro;{safeToFixed(activeShift.startingCash, 2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Stats */}
      {liveStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Banknote className="h-4 w-4 text-emerald-600" />
                <span className="text-xs text-muted-foreground">Gotovina</span>
              </div>
              <p className="text-xl font-bold">&euro;{safeToFixed(liveStats.cashSales, 2)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Pričakovano: &euro;{safeToFixed(liveStats.expectedCash, 2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-muted-foreground">Kartično</span>
              </div>
              <p className="text-xl font-bold">&euro;{safeToFixed(liveStats.cardSales, 2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="h-4 w-4 text-purple-600" />
                <span className="text-xs text-muted-foreground">Mobilno</span>
              </div>
              <p className="text-xl font-bold">&euro;{safeToFixed(liveStats.mobileSales, 2)}</p>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Skupaj</span>
              </div>
              <p className="text-xl font-bold text-primary">&euro;{safeToFixed(liveStats.totalSales, 2)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {liveStats.totalOrders} naročil
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment Breakdown */}
      {liveStats && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Pregled plačil
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm">Gotovina</span>
                </div>
                <span className="font-semibold">&euro;{safeToFixed(liveStats.cashSales, 2)}</span>
              </div>
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Kartično</span>
                </div>
                <span className="font-semibold">&euro;{safeToFixed(liveStats.cardSales, 2)}</span>
              </div>
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-purple-600" />
                  <span className="text-sm">Mobilno</span>
                </div>
                <span className="font-semibold">&euro;{safeToFixed(liveStats.mobileSales, 2)}</span>
              </div>
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Split className="h-4 w-4 text-amber-600" />
                  <span className="text-sm">Deljeno</span>
                </div>
                <span className="font-semibold">&euro;{safeToFixed(liveStats.splitPayments, 2)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-primary/5">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Skupaj</span>
                </div>
                <span className="font-bold text-lg">&euro;{safeToFixed(liveStats.totalSales, 2)}</span>
              </div>
              {liveStats.totalDiscounts > 0 && (
                <div className="flex items-center justify-between py-2 px-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-rose-500" />
                    <span className="text-sm text-muted-foreground">Popusti</span>
                  </div>
                  <span className="text-sm text-rose-600">-&euro;{safeToFixed(liveStats.totalDiscounts, 2)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
})
