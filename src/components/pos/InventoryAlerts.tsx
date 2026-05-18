'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertTriangle,
  Package,
  TrendingDown,
  ShoppingCart,
  Bell,
  BellRing,
  CheckCircle,
  Clock,
  Filter,
} from 'lucide-react'

interface InventoryAlert {
  id: string
  itemName: string
  currentStock: number
  minStock: number
  unit: string
  category: string
  supplier: string | null
  dailyUsage: number
  daysUntilEmpty: number
  severity: 'critical' | 'warning' | 'low'
  lastRestocked: string | null
  autoOrderSuggested: boolean
  suggestedOrderQty: number
}

interface AlertSettings {
  criticalThreshold: number // days
  warningThreshold: number  // days
  autoNotify: boolean
  notifyHours: number[]
}

export function InventoryAlerts() {
  const [alerts, setAlerts] = useState<InventoryAlert[]>([])
  const [settings, setSettings] = useState<AlertSettings>({
    criticalThreshold: 2,
    warningThreshold: 5,
    autoNotify: true,
    notifyHours: [8, 14],
  })
  const [loading, setLoading] = useState(true)
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [autoOrdering, setAutoOrdering] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadAlerts()
    const interval = setInterval(loadAlerts, 60000) // Osveži vsako minuto
    return () => clearInterval(interval)
  }, [])

  const loadAlerts = async () => {
    try {
      // Naloži zaloge
      const invRes = await fetch('/api/inventory')
      const invData = await invRes.json()

      // Naloži dobavitelje
      const supRes = await fetch('/api/suppliers')
      const supData = await supRes.json()

      // Naloži nabavna naročila za izračun dnevne porabe
      const poRes = await fetch('/api/purchase-orders')
      const poData = await poRes.json()

      // Zgradi alerte
      const alertList: InventoryAlert[] = (invData || []).map((item: any) => {
        const currentStock = item.currentStock || 0
        const minStock = item.minStock || 0
        const dailyUsage = item.dailyUsage || Math.max(1, Math.floor(minStock * 0.3))
        const daysUntilEmpty = dailyUsage > 0 ? Math.floor(currentStock / dailyUsage) : 999

        let severity: 'critical' | 'warning' | 'low' = 'low'
        if (daysUntilEmpty <= settings.criticalThreshold || currentStock <= 0) {
          severity = 'critical'
        } else if (daysUntilEmpty <= settings.warningThreshold || currentStock <= minStock) {
          severity = 'warning'
        }

        const supplier = supData?.find?.((s: any) => s.id === item.supplierId)?.name || null
        const suggestedOrderQty = Math.max(minStock * 3 - currentStock, minStock)

        return {
          id: item.id,
          itemName: item.name || item.itemName || 'Neznan artikel',
          currentStock,
          minStock,
          unit: item.unit || 'kos',
          category: item.category || 'Splošno',
          supplier,
          dailyUsage,
          daysUntilEmpty,
          severity,
          lastRestocked: item.lastRestocked || null,
          autoOrderSuggested: severity === 'critical' && supplier !== null,
          suggestedOrderQty: Math.ceil(suggestedOrderQty),
        }
      })

      // Sortiraj po resnosti
      alertList.sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, low: 2 }
        return severityOrder[a.severity] - severityOrder[b.severity]
      })

      setAlerts(alertList)
    } catch (err) {
      console.error('Error loading inventory alerts:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAutoOrder = async (alert: InventoryAlert) => {
    setAutoOrdering(prev => new Set(prev).add(alert.id))
    try {
      await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: alert.supplier,
          items: [{
            inventoryItemId: alert.id,
            itemName: alert.itemName,
            quantity: alert.suggestedOrderQty,
            unit: alert.unit,
          }],
          status: 'pending',
          notes: `Samodejno naročilo — zaloga kritična (${alert.currentStock} ${alert.unit})`,
        }),
      })
      // Osveži alerte
      await loadAlerts()
    } catch (err) {
      console.error('Error creating auto-order:', err)
    } finally {
      setAutoOrdering(prev => {
        const next = new Set(prev)
        next.delete(alert.id)
        return next
      })
    }
  }

  const handleMarkRestocked = async (alertId: string) => {
    try {
      await fetch(`/api/inventory/${alertId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastRestocked: new Date().toISOString() }),
      })
      await loadAlerts()
    } catch (err) {
      console.error('Error marking restocked:', err)
    }
  }

  const filteredAlerts = filterSeverity === 'all'
    ? alerts
    : alerts.filter(a => a.severity === filterSeverity)

  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const warningCount = alerts.filter(a => a.severity === 'warning').length
  const lowCount = alerts.filter(a => a.severity === 'low').length

  const severityConfig = {
    critical: {
      color: 'bg-red-500',
      badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      border: 'border-red-200 dark:border-red-800',
      icon: BellRing,
      label: 'Kritično',
    },
    warning: {
      color: 'bg-amber-500',
      badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-800',
      icon: AlertTriangle,
      label: 'Opozorilo',
    },
    low: {
      color: 'bg-blue-500',
      badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800',
      icon: Bell,
      label: 'Nizko',
    },
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
            <BellRing className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Alarmi zalog</h2>
            <p className="text-sm text-muted-foreground">Spremljanje in upravljanje zalog v realnem času</p>
          </div>
        </div>
      </div>

      {/* Povzetek kartic */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <BellRing className="h-4 w-4 text-red-500" />
              <span className="text-2xl font-bold text-red-600">{criticalCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">Kritično</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-2xl font-bold text-amber-600">{warningCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">Opozorilo</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Package className="h-4 w-4 text-blue-500" />
              <span className="text-2xl font-bold text-blue-600">{lowCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">Nizka zaloga</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtri */}
      <div className="flex gap-2">
        {['all', 'critical', 'warning', 'low'].map(sev => (
          <Button
            key={sev}
            variant={filterSeverity === sev ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterSeverity(sev)}
          >
            {sev === 'all' ? 'Vsi' : severityConfig[sev as keyof typeof severityConfig].label}
            {sev !== 'all' && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {sev === 'critical' ? criticalCount : sev === 'warning' ? warningCount : lowCount}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Seznam alertov */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-medium">Vse zaloge so v redu</p>
              <p className="text-sm text-muted-foreground">Ni artiklov pod minimalno zalogo</p>
            </CardContent>
          </Card>
        ) : (
          filteredAlerts.map(alert => {
            const config = severityConfig[alert.severity]
            const Icon = config.icon
            const stockPercent = alert.minStock > 0
              ? Math.min(100, Math.round((alert.currentStock / alert.minStock) * 100))
              : 0

            return (
              <Card key={alert.id} className={`${config.border} transition-all hover:shadow-md`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`h-4 w-4 ${alert.severity === 'critical' ? 'text-red-500' : alert.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'}`} />
                        <span className="font-medium truncate">{alert.itemName}</span>
                        <Badge className={config.badge}>{config.label}</Badge>
                      </div>

                      <div className="grid grid-cols-4 gap-3 mb-3 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Trenutna zaloga</p>
                          <p className="font-semibold">{alert.currentStock} {alert.unit}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Minimalna zaloga</p>
                          <p className="font-semibold">{alert.minStock} {alert.unit}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Dnevna poraba</p>
                          <p className="font-semibold">{alert.dailyUsage} {alert.unit}/dan</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Dni do praznine</p>
                          <p className={`font-semibold ${alert.daysUntilEmpty <= 2 ? 'text-red-600' : alert.daysUntilEmpty <= 5 ? 'text-amber-600' : 'text-blue-600'}`}>
                            {alert.daysUntilEmpty >= 999 ? '∞' : alert.daysUntilEmpty}
                          </p>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Zaloga</span>
                          <span>{stockPercent}% minimalne</span>
                        </div>
                        <Progress
                          value={stockPercent}
                          className={`h-2 ${stockPercent <= 25 ? '[&>div]:bg-red-500' : stockPercent <= 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-green-500'}`}
                        />
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {alert.supplier && (
                          <span className="flex items-center gap-1">
                            <ShoppingCart className="h-3 w-3" />
                            {alert.supplier}
                          </span>
                        )}
                        {alert.lastRestocked && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Zadnji naklad: {new Date(alert.lastRestocked).toLocaleDateString('sl-SI')}
                          </span>
                        )}
                        {alert.autoOrderSuggested && (
                          <span className="flex items-center gap-1 text-orange-600">
                            <TrendingDown className="h-3 w-3" />
                            Predlagano naročilo: {alert.suggestedOrderQty} {alert.unit}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {alert.autoOrderSuggested && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleAutoOrder(alert)}
                          disabled={autoOrdering.has(alert.id)}
                          className="whitespace-nowrap"
                        >
                          {autoOrdering.has(alert.id) ? (
                            <><Clock className="h-3 w-3 mr-1 animate-spin" /> Naročam...</>
                          ) : (
                            <><ShoppingCart className="h-3 w-3 mr-1" /> Naroči {alert.suggestedOrderQty} {alert.unit}</>
                          )}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkRestocked(alert.id)}
                        className="whitespace-nowrap"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" /> Nakladano
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
