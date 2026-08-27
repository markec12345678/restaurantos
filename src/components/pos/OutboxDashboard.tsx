'use client'

// ============================================
// OUTBOX MONITORING DASHBOARD
// ============================================
// Prikazuje real-time status outboxa:
//   - Število pending/failed/sent/dead_letter events
//   - Seznam nedavnih events z retry gumbi
//   - Statistika po targetih (furs, stripe, email, ...)
//   - Cleanup in manual process gumbi
// ============================================

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  RefreshCw, Trash2, Play, AlertTriangle, CheckCircle2,
  Clock, XCircle, Loader2, Server, Activity,
} from 'lucide-react'
import { format } from 'date-fns'

// --- Tipi ---
interface OutboxStats {
  pending: number
  processing: number
  sent: number
  failed: number
  dead_letter: number
  oldestPending?: string
}

interface OutboxEvent {
  id: string
  aggregateType: string
  aggregateId: string
  eventType: string
  target: string
  status: string
  attempts: number
  maxAttempts: number
  lastError: string
  nextRetryAt: string | null
  processedAt: string | null
  createdAt: string
}

interface OutboxResponse {
  stats: OutboxStats
  events: OutboxEvent[]
  count: number
}

// --- Status config ---
const statusConfig: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock, label: 'Pending' },
  processing: { color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Loader2, label: 'Processing' },
  sent: { color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle2, label: 'Sent' },
  failed: { color: 'bg-orange-100 text-orange-800 border-orange-300', icon: AlertTriangle, label: 'Failed' },
  dead_letter: { color: 'bg-red-100 text-red-800 border-red-300', icon: XCircle, label: 'Dead Letter' },
}

const targetColors: Record<string, string> = {
  furs: 'bg-purple-100 text-purple-800',
  stripe: 'bg-indigo-100 text-indigo-800',
  email: 'bg-blue-100 text-blue-800',
  sms: 'bg-green-100 text-green-800',
  webhook: 'bg-orange-100 text-orange-800',
  internal: 'bg-gray-100 text-gray-800',
}

// --- Komponenta ---
export function OutboxDashboard() {
  const queryClient = useQueryClient()
  const [filterStatus, setFilterStatus] = useState<string>('pending')
  const [retryDialog, setRetryDialog] = useState<{ id: string; open: boolean }>({ id: '', open: false })

  // Fetch outbox data
  const { data, isLoading, refetch } = useQuery<OutboxResponse>({
    queryKey: ['outbox', filterStatus],
    queryFn: async () => {
      const res = await fetch(`/api/outbox?status=${filterStatus}&limit=100`)
      if (!res.ok) throw new Error('Failed to fetch outbox')
      return res.json()
    },
    refetchInterval: 10_000, // Auto-refresh vsakih 10s
  })

  // Manual process mutation
  const processMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/outbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process', limit: 25 }),
      })
      if (!res.ok) throw new Error('Process failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbox'] })
    },
  })

  // Cleanup mutation
  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/outbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cleanup', days: 30 }),
      })
      if (!res.ok) throw new Error('Cleanup failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbox'] })
    },
  })

  // Retry single event
  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/outbox/${id}/retry`, { method: 'POST' })
      if (!res.ok) throw new Error('Retry failed')
      return res.json()
    },
    onSuccess: () => {
      setRetryDialog({ id: '', open: false })
      queryClient.invalidateQueries({ queryKey: ['outbox'] })
    },
  })

  const stats = data?.stats
  const events = data?.events || []

  const totalEvents = stats
    ? stats.pending + stats.processing + stats.sent + stats.failed + stats.dead_letter
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Outbox Monitoring
          </h2>
          <p className="text-sm text-muted-foreground">
            Transactional outbox — guaranteed delivery z idempotentnostjo in exponential backoff
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Osveži
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => cleanupMutation.mutate()}
            disabled={cleanupMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Počisti stare
          </Button>
          <Button
            size="sm"
            onClick={() => processMutation.mutate()}
            disabled={processMutation.isPending}
          >
            {processMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-1" />
            )}
            Procesiraj
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard
          title="Pending"
          value={stats?.pending || 0}
          icon={Clock}
          color="bg-yellow-50 border-yellow-200 text-yellow-800"
          subtitle={stats?.oldestPending ? `od ${format(new Date(stats.oldestPending), 'dd.MM HH:mm')}` : '-'}
        />
        <StatCard
          title="Processing"
          value={stats?.processing || 0}
          icon={Loader2}
          color="bg-blue-50 border-blue-200 text-blue-800"
          subtitle="v obdelavi"
        />
        <StatCard
          title="Sent"
          value={stats?.sent || 0}
          icon={CheckCircle2}
          color="bg-green-50 border-green-200 text-green-800"
          subtitle="uspešno"
        />
        <StatCard
          title="Failed"
          value={stats?.failed || 0}
          icon={AlertTriangle}
          color="bg-orange-50 border-orange-200 text-orange-800"
          subtitle="v retry-u"
        />
        <StatCard
          title="Dead Letter"
          value={stats?.dead_letter || 0}
          icon={XCircle}
          color="bg-red-50 border-red-200 text-red-800"
          subtitle="max attempts"
        />
      </div>

      {/* Filter buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Filter:</span>
        {['pending', 'processing', 'failed', 'dead_letter', 'sent', 'all'].map((s) => (
          <Button
            key={s}
            variant={filterStatus === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus(s)}
          >
            {statusConfig[s]?.label || s}
            {stats && s !== 'all' && (
              <Badge variant="secondary" className="ml-2">
                {String(stats[s as keyof OutboxStats] || 0)}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Events table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Dogodki ({events.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Ni dogodkov s statusom &quot;{statusConfig[filterStatus]?.label || filterStatus}&quot;
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {events.map((event) => {
                  const cfg = statusConfig[event.status] || statusConfig.pending
                  const StatusIcon = cfg.icon
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <StatusIcon className={`h-4 w-4 flex-shrink-0 ${event.status === 'processing' ? 'animate-spin' : ''}`} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={`text-xs ${targetColors[event.target] || 'bg-gray-100'}`}>
                            {event.target}
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${cfg.color}`}>
                            {cfg.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {event.aggregateType}.{event.eventType}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>ID: {event.aggregateId.substring(0, 12)}...</span>
                          <span>·</span>
                          <span>{format(new Date(event.createdAt), 'dd.MM HH:mm:ss')}</span>
                          {event.attempts > 0 && (
                            <>
                              <span>·</span>
                              <span>Poskusi: {event.attempts}/{event.maxAttempts}</span>
                            </>
                          )}
                          {event.nextRetryAt && (
                            <>
                              <span>·</span>
                              <span>Naslednji: {format(new Date(event.nextRetryAt), 'HH:mm:ss')}</span>
                            </>
                          )}
                        </div>
                        {event.lastError && (
                          <div className="text-xs text-red-600 mt-1 truncate">
                            ⚠ {event.lastError.substring(0, 100)}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      {(event.status === 'failed' || event.status === 'dead_letter') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRetryDialog({ id: event.id, open: true })}
                        >
                          Retry
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Retry confirmation dialog */}
      <Dialog open={retryDialog.open} onOpenChange={(open) => setRetryDialog({ id: retryDialog.id, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ponovno poskusi event?</DialogTitle>
            <DialogDescription>
              Event bo premaknjen nazaj v pending status in procesiran v naslednjem ciklu.
              ID: {retryDialog.id.substring(0, 16)}...
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetryDialog({ id: '', open: false })}>
              Prekliči
            </Button>
            <Button
              onClick={() => retryMutation.mutate(retryDialog.id)}
              disabled={retryMutation.isPending}
            >
              {retryMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Potrdi retry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// --- StatCard podkomponenta ---
interface StatCardProps {
  title: string
  value: number
  icon: typeof Clock
  color: string
  subtitle?: string
}

function StatCard({ title, value, icon: Icon, color, subtitle }: StatCardProps) {
  return (
    <Card className={`border-2 ${color}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium opacity-80">{title}</span>
          <Icon className="h-4 w-4 opacity-60" />
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <div className="text-xs opacity-60 mt-0.5">{subtitle}</div>}
      </CardContent>
    </Card>
  )
}
