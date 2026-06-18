'use client'

// ============================================
// ZADNJE ZAPRTE IZMENE — Prikaz zgodovine
// ============================================

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Lock, Clock, Banknote, CreditCard, TrendingUp, TrendingDown } from 'lucide-react'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { format } from 'date-fns'
import type { RecentShiftType } from './constants'

interface RecentShiftsListProps {
  shifts: RecentShiftType[]
}

export const RecentShiftsList = memo(function RecentShiftsList({ shifts }: RecentShiftsListProps) {
  if (shifts.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Zadnje zaprte izmene
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {shifts.map((shift) => (
            <div key={shift.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {format(new Date(shift.openedAt), 'dd.MM HH:mm')} → {shift.closedAt ? format(new Date(shift.closedAt), 'HH:mm') : ''}
                    {shift.employeeName && ` · ${shift.employeeName}`}
                  </p>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>&euro;{safeToFixed(shift.startingCash, 2)} → &euro;{safeToFixed(shift.closingCash, 2)}</span>
                    <span>·</span>
                    <span>{shift.totalOrders} naročil</span>
                  </div>
                </div>
              </div>
              <div className="text-right flex items-center gap-3">
                <div>
                  <p className="font-semibold text-sm">&euro;{safeToFixed(shift.totalSales, 2)}</p>
                  <div className="flex gap-1.5">
                    <Badge variant="outline" className="text-[9px] h-4 px-1">
                      <Banknote className="h-2.5 w-2.5 mr-0.5" />&euro;{safeToFixed(shift.cashSales, 0)}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] h-4 px-1">
                      <CreditCard className="h-2.5 w-2.5 mr-0.5" />&euro;{safeToFixed(shift.cardSales, 0)}
                    </Badge>
                  </div>
                </div>
                {Math.abs(shift.cashDifference) > 0.01 && (
                  <Badge
                    variant={shift.cashDifference > 0 ? 'default' : 'destructive'}
                    className="text-[9px] h-5"
                  >
                    {shift.cashDifference > 0 ? (
                      <><TrendingUp className="h-2.5 w-2.5 mr-0.5" />+&euro;{safeToFixed(shift.cashDifference, 2)}</>
                    ) : (
                      <><TrendingDown className="h-2.5 w-2.5 mr-0.5" />&euro;{safeToFixed(shift.cashDifference, 2)}</>
                    )}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
})
