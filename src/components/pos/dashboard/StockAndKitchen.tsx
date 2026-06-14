'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Package, AlertTriangle, XCircle, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import type { StockAndKitchenProps } from './constants'

/**
 * StockAndKitchen — stanje zaloge (opozorila o nizki zalogi)
 * in kuhinjski zaslon (aktivna naročila v kuhinji).
 */
export const StockAndKitchen = memo(function StockAndKitchen({
  lowStockItems,
  recentOrders,
  statusColors,
  statusLabels,
  typeLabels,
  onNavigateInventory,
}: StockAndKitchenProps) {
  return (
    <>
      {/* Stanje zaloge */}
      <Card className={`${(lowStockItems?.length || 0) > 0 ? 'border-red-200 dark:border-red-900/50' : 'border-emerald-200 dark:border-emerald-900/50'}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-4 w-4" />
              Stanje zaloge
            </CardTitle>
            <Button variant="outline" size="sm" onClick={onNavigateInventory} className="text-xs gap-1" aria-label="Upravljaj zalogo">
              Upravljaj <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(lowStockItems?.length || 0) > 0 ? (
            <div className="space-y-2">
              {lowStockItems.filter((i) => i.quantity <= 0).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-red-600 flex items-center gap-1"><XCircle className="h-3 w-3" /> Ni na zalogi</p>
                  <div className="flex flex-wrap gap-1.5">
                    {lowStockItems.filter((i) => i.quantity <= 0).map((item) => (
                      <Badge key={item.id} variant="destructive" className="text-xs cursor-pointer" role="button" tabIndex={0} onClick={onNavigateInventory} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigateInventory() } }}>
                        {item.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {lowStockItems.filter((i) => i.quantity > 0).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Nizka zaloga</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {lowStockItems.filter((i) => i.quantity > 0).map((item) => {
                      const pct = item.minQuantity > 0 ? Math.min((item.quantity / item.minQuantity) * 100, 100) : 100
                      return (
                        <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{item.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-valuetext={pct <= 25 ? 'Kritično nizka zaloga' : pct <= 50 ? 'Nizka zaloga' : 'Zadostna zaloga'}>
                                <div className={`h-full rounded-full ${pct <= 25 ? 'bg-red-500' : pct <= 50 ? 'bg-amber-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{item.quantity}/{item.minQuantity} {item.unit || ''}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground text-center mt-2">Kliknite na artikel za hitro vnašanje nabave</p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 py-6 text-emerald-600">
              <Package className="h-8 w-8 opacity-30" />
              <div>
                <p className="font-semibold">Vse zaloge so v redu</p>
                <p className="text-xs text-muted-foreground">Ni artiklov pod minimalno količino</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kuhinjski zaslon */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse"><span className="sr-only">Aktivno</span></span>
            Kuhinjski zaslon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(recentOrders || [])
              .filter((o) => o.status === 'pending' || o.status === 'in-progress')
              .map((order) => (
                <div key={order.id} className={`p-3 rounded-lg border-2 ${
                  order.status === 'pending'
                    ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800'
                    : 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm">#{order.orderNumber}</span>
                    <Badge variant="outline" className={statusColors[order.status]}>{statusLabels[order.status]}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {typeLabels[order.type] || order.type}
                    {order.type === 'dine-in' && order.table ? ` · Miza ${order.table.number}` : ''}
                    {' · '}{format(new Date(order.createdAt), 'HH:mm')}
                  </div>
                  <div className="space-y-1">
                    {order.orderItems.map((oi) => (
                      <div key={oi.id} className="flex items-center gap-2 text-sm">
                        <span className={`h-1.5 w-1.5 rounded-full ${oi.status === 'ready' ? 'bg-emerald-500' : oi.status === 'preparing' ? 'bg-blue-500' : 'bg-yellow-500'}`}><span className="sr-only">{oi.status === 'ready' ? 'Pripravljeno' : oi.status === 'preparing' ? 'V pripravi' : 'Čakajoče'}</span></span>
                        <span>{oi.quantity}x {oi.menuItem.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            {(recentOrders || []).filter((o) => o.status === 'pending' || o.status === 'in-progress').length === 0 && (
              <div className="col-span-full text-center py-6 text-muted-foreground text-sm">V kuhinji ni aktivnih naročil</div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  )
})
