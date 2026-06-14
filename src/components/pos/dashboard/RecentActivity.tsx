'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, TrendingUp, UserCheck, Users } from 'lucide-react'
import { format } from 'date-fns'
import type { RecentActivityProps } from './constants'

/**
 * RecentActivity — zadnja naročila, najbolj prodajani artikli
 * in analitika gostov.
 */
export const RecentActivity = memo(function RecentActivity({
  recentOrders,
  topSellingItems,
  guestAnalytics,
  statusColors,
  statusLabels,
  typeLabels,
}: RecentActivityProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Zadnja naročila */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Zadnja naročila</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
            {(recentOrders || []).slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">#{order.orderNumber} - {order.customerName || 'Hodič'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(order.createdAt), 'HH:mm')} · {typeLabels[order.type] || order.type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={statusColors[order.status] || ''}>
                    {statusLabels[order.status] || order.status}
                  </Badge>
                  <span className="text-sm font-semibold">€{order.total.toFixed(2)}</span>
                </div>
              </div>
            ))}
            {(recentOrders || []).length === 0 && (
              <p className="text-center text-muted-foreground py-8">Danes še ni naročil</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Najbolj prodajani */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Najbolj prodajani</CardTitle>
        </CardHeader>
        <CardContent>
          {topSellingItems?.length > 0 ? (
            <div className="space-y-2">
              {topSellingItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{idx + 1}</span>
                    <span className="text-sm truncate max-w-[120px]">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{item.quantity}x</span>
                    <span className="font-semibold">€{item.revenue.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Ni podatkov</div>
          )}
        </CardContent>
      </Card>

      {/* ═══ Analitika gostov ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            Analitika gostov
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div>
                <p className="text-xs text-muted-foreground">Skupno gostov</p>
                <p className="text-lg font-bold">{guestAnalytics?.totalGuests || 0}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div>
                <p className="text-xs text-muted-foreground">Povratni gostje</p>
                <p className="text-lg font-bold">{guestAnalytics?.repeatGuests || 0}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Stopnja povratka</span>
                <span className={`font-bold ${(guestAnalytics?.guestReturnRate || 0) >= 30 ? 'text-emerald-600' : (guestAnalytics?.guestReturnRate || 0) >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                  {(guestAnalytics?.guestReturnRate || 0).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.min(100, guestAnalytics?.guestReturnRate || 0)} aria-valuemin={0} aria-valuemax={100} aria-valuetext={(guestAnalytics?.guestReturnRate || 0) >= 30 ? 'Odlična zvestoba gostov' : (guestAnalytics?.guestReturnRate || 0) >= 15 ? 'Solidna stopnja povratka' : 'Priložnost za izboljšavo zvestobe'}>
                <div
                  className={`h-full rounded-full transition-all ${(guestAnalytics?.guestReturnRate || 0) >= 30 ? 'bg-emerald-500' : (guestAnalytics?.guestReturnRate || 0) >= 15 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, guestAnalytics?.guestReturnRate || 0)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {(guestAnalytics?.guestReturnRate || 0) >= 30 ? 'Odlična zvestoba gostov!' : (guestAnalytics?.guestReturnRate || 0) >= 15 ? 'Solidna stopnja povratka' : 'Priložnost za izboljšavo zvestobe'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
