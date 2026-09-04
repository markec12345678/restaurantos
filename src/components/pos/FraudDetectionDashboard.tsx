'use client'

// ============================================
// FRAUD DETECTION DASHBOARD
// ============================================
// Prikazuje fraud alerts z real-time osveževanjem.
// Omogoča admin-u pregled sumljivih aktivnosti.
// ============================================

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertTriangle, Shield, ShieldAlert, RefreshCw, Loader2,
  Clock, TrendingDown, DollarSign, User, Activity,
} from 'lucide-react'
import { format } from 'date-fns'

// --- Tipi ---
interface FraudAlert {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  entityType: string
  entityId: string
  detectedAt: string
  occurredAt: string
  amount?: number
  employeeId?: string
  employeeName?: string
  metadata?: Record<string, unknown>
  status: string
}

interface FraudSummary {
  total: number
  bySeverity: Record<string, number>
  byType: Record<string, number>
}

interface FraudResponse {
  alerts: FraudAlert[]
  summary: FraudSummary
}

// --- Config ---
const severityConfig: Record<string, { color: string; icon: typeof Shield; label: string }> = {
  critical: { color: 'bg-red-100 text-red-800 border-red-300', icon: ShieldAlert, label: 'Kritično' },
  high: { color: 'bg-orange-100 text-orange-800 border-orange-300', icon: AlertTriangle, label: 'Visoko' },
  medium: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: AlertTriangle, label: 'Srednje' },
  low: { color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Shield, label: 'Nizko' },
}

const typeLabels: Record<string, string> = {
  excessive_voids: 'Preveč voidov',
  high_discount_no_reason: 'Visok popust',
  frequent_refunds_same_customer: 'Pogosti povračila',
  cash_drawer_discrepancy: 'Neskladje blagajne',
  after_hours_activity: 'Aktivnost izven ur',
  employee_revenue_spike: 'Skok prometa',
  split_payment_anomaly: 'Sumljivo deljeno plačilo',
  multi_card_same_check: 'Več kartic isti račun',
  manual_price_override: 'Ročna sprememba cene',
  compromised_refund_pattern: 'Sumljiv vzorec povračil',
}

// --- Komponenta ---
export function FraudDetectionDashboard() {
  const queryClient = useQueryClient()
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null)
  const [filterSeverity, setFilterSeverity] = useState<string>('all')

  // Fetch fraud alerts
  const { data, isLoading, refetch } = useQuery<FraudResponse>({
    queryKey: ['fraud-alerts'],
    queryFn: async () => {
      const res = await fetch('/api/fraud-detection')
      if (!res.ok) throw new Error('Failed to fetch fraud alerts')
      return res.json()
    },
    refetchInterval: 60_000, // vsakih 60s
  })

  // Re-run detection
  const rerunMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/fraud-detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_checks' }),
      })
      if (!res.ok) throw new Error('Re-run failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fraud-alerts'] })
    },
  })

  const summary = data?.summary
  const allAlerts = data?.alerts || []

  const filteredAlerts = filterSeverity === 'all'
    ? allAlerts
    : allAlerts.filter((a) => a.severity === filterSeverity)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Fraud Detection
          </h2>
          <p className="text-sm text-muted-foreground">
            Avtomatska detekcija sumljivih aktivnosti (audit compliance)
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => rerunMutation.mutate()}
          disabled={rerunMutation.isPending}
        >
          {rerunMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          Ponovno preveri
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard
          title="Skupaj alertov"
          value={summary?.total || 0}
          icon={Activity}
          color="bg-gray-50 border-gray-200 text-gray-800"
        />
        <StatCard
          title="Kritično"
          value={summary?.bySeverity?.critical || 0}
          icon={ShieldAlert}
          color="bg-red-50 border-red-200 text-red-800"
          alert={!!summary?.bySeverity?.critical}
        />
        <StatCard
          title="Visoko"
          value={summary?.bySeverity?.high || 0}
          icon={AlertTriangle}
          color="bg-orange-50 border-orange-200 text-orange-800"
        />
        <StatCard
          title="Srednje"
          value={summary?.bySeverity?.medium || 0}
          icon={AlertTriangle}
          color="bg-yellow-50 border-yellow-200 text-yellow-800"
        />
        <StatCard
          title="Nizko"
          value={summary?.bySeverity?.low || 0}
          icon={Shield}
          color="bg-blue-50 border-blue-200 text-blue-800"
        />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Filter:</span>
        {['all', 'critical', 'high', 'medium', 'low'].map((s) => (
          <Button
            key={s}
            variant={filterSeverity === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterSeverity(s)}
          >
            {s === 'all' ? 'Vse' : severityConfig[s]?.label || s}
            {summary && s !== 'all' && (
              <Badge variant="secondary" className="ml-2">
                {String(summary.bySeverity[s] || 0)}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Alerts list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Alerti ({filteredAlerts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              ✅ Ni fraud alertov — vse v redu
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {filteredAlerts.map((alert) => {
                  const cfg = severityConfig[alert.severity] || severityConfig.low
                  const Icon = cfg.icon
                  return (
                    <div
                      key={alert.id}
                      className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedAlert(alert)}
                    >
                      <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                        alert.severity === 'critical' ? 'text-red-500' :
                        alert.severity === 'high' ? 'text-orange-500' : ''
                      }`} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="outline" className={`text-xs ${cfg.color}`}>
                            {cfg.label}
                          </Badge>
                          <span className="text-sm font-medium">
                            {typeLabels[alert.type] || alert.type}
                          </span>
                          {alert.employeeName && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {alert.employeeName}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {alert.description}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(alert.occurredAt), 'dd.MM HH:mm')}
                          </span>
                          {alert.amount !== undefined && alert.amount > 0 && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              €{alert.amount.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAlert && (() => {
                const cfg = severityConfig[selectedAlert.severity] || severityConfig.low
                const Icon = cfg.icon
                return <Icon className={`h-5 w-5 ${selectedAlert.severity === 'critical' ? 'text-red-500' : ''}`} />
              })()}
              {selectedAlert && (typeLabels[selectedAlert.type] || selectedAlert.type)}
            </DialogTitle>
            <DialogDescription>
              Alert ID: {selectedAlert?.id.substring(0, 16)}...
            </DialogDescription>
          </DialogHeader>

          {selectedAlert && (
            <div className="space-y-3">
              <div className="bg-muted/30 rounded-md p-3">
                <div className="text-xs text-muted-foreground mb-1">Opis:</div>
                <div className="text-sm">{selectedAlert.description}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Severity</div>
                  <Badge variant="outline" className={severityConfig[selectedAlert.severity]?.color}>
                    {severityConfig[selectedAlert.severity]?.label}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Znesek</div>
                  <div className="font-medium">
                    {selectedAlert.amount ? `€${selectedAlert.amount.toFixed(2)}` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Zaposleni</div>
                  <div className="font-medium">{selectedAlert.employeeName || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Entiteta</div>
                  <div className="font-medium">{selectedAlert.entityType}: {selectedAlert.entityId.substring(0, 12)}...</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Zaznano</div>
                  <div className="font-medium">{format(new Date(selectedAlert.detectedAt), 'dd.MM.yyyy HH:mm')}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Pojavilo</div>
                  <div className="font-medium">{format(new Date(selectedAlert.occurredAt), 'dd.MM.yyyy HH:mm')}</div>
                </div>
              </div>

              {selectedAlert.metadata && Object.keys(selectedAlert.metadata).length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Metadata:</div>
                  <pre className="text-xs bg-background border border-border rounded-md p-2 overflow-auto max-h-40">
                    {JSON.stringify(selectedAlert.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAlert(null)}>
              Zapri
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// --- StatCard ---
interface StatCardProps {
  title: string
  value: number
  icon: typeof Shield
  color: string
  alert?: boolean
}

function StatCard({ title, value, icon: Icon, color, alert }: StatCardProps) {
  return (
    <Card className={`border-2 ${color} ${alert ? 'ring-2 ring-red-300 animate-pulse' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium opacity-80">{title}</span>
          <Icon className="h-4 w-4 opacity-60" />
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}
