'use client'

// ============================================
// CONFLICT RESOLUTION DASHBOARD
// ============================================
// Prikazuje multi-device sinhronizacijske konflikte
// in omogoča admin-u reševanje.
//
// Resolucijske strategije:
//   1. keep_incoming — uporabi podatke iz novejše naprave
//   2. keep_existing — ohrani trenutne podatke
//   3. merge — kombiniraj (admin vpiše merged data)
//   4. discard — zavrzi konflikt
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  AlertTriangle, CheckCircle2, GitBranch, Loader2,
  RefreshCw, Shield, XCircle,
} from 'lucide-react'
import { format } from 'date-fns'

// --- Tipi ---
interface SyncState {
  id: string
  entityType: string
  entityId: string
  lastSyncedAt: string | null
  syncVersion: number
  conflictStatus: string // none, detected, resolved
  conflictData: unknown
  updatedAt: string
}

interface SyncStats {
  none: number
  detected: number
  resolved: number
  total: number
}

interface SyncResponse {
  syncStates: SyncState[]
  count: number
  stats: SyncStats
}

// --- Status config ---
const statusConfig: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  none: { color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle2, label: 'Sinhronizirano' },
  detected: { color: 'bg-red-100 text-red-800 border-red-300', icon: AlertTriangle, label: 'Konflikt' },
  resolved: { color: 'bg-blue-100 text-blue-800 border-blue-300', icon: GitBranch, label: 'Rešeno' },
}

const entityTypeLabels: Record<string, string> = {
  order: 'Naročilo',
  menu_item: 'Artikel',
  employee: 'Zaposleni',
  reservation: 'Rezervacija',
  customer: 'Stranka',
  payment: 'Plačilo',
}

// --- Komponenta ---
export function ConflictResolutionDashboard() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<string>('detected')
  const [resolveDialog, setResolveDialog] = useState<{
    open: boolean
    syncState: SyncState | null
    resolution: string
    mergedData: string
    notes: string
  }>({ open: false, syncState: null, resolution: 'keep_incoming', mergedData: '', notes: '' })

  // Fetch data
  const { data, isLoading, refetch } = useQuery<SyncResponse>({
    queryKey: ['sync', filter],
    queryFn: async () => {
      const params = filter !== 'all' ? `?conflictStatus=${filter}` : ''
      const res = await fetch(`/api/sync${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    refetchInterval: 30_000, // vsakih 30s
  })

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!resolveDialog.syncState) return
      const res = await fetch(`/api/sync/${resolveDialog.syncState.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution: resolveDialog.resolution,
          mergedData: resolveDialog.resolution === 'merge'
            ? JSON.parse(resolveDialog.mergedData || '{}')
            : undefined,
          notes: resolveDialog.notes,
        }),
      })
      if (!res.ok) throw new Error('Resolve failed')
      return res.json()
    },
    onSuccess: () => {
      setResolveDialog({ open: false, syncState: null, resolution: 'keep_incoming', mergedData: '', notes: '' })
      queryClient.invalidateQueries({ queryKey: ['sync'] })
    },
  })

  const stats = data?.stats
  const syncStates = data?.syncStates || []

  function openResolveDialog(state: SyncState) {
    const cd = (state.conflictData as Record<string, unknown>) || {}
    setResolveDialog({
      open: true,
      syncState: state,
      resolution: 'keep_incoming',
      mergedData: JSON.stringify(cd.incomingData || {}, null, 2),
      notes: '',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Conflict Resolution
          </h2>
          <p className="text-sm text-muted-foreground">
            Multi-device sinhronizacija — zaznavanje in reševanje konfliktov
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Osveži
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard title="Sinhronizirano" value={stats?.none || 0} icon={CheckCircle2} color="bg-green-50 border-green-200 text-green-800" />
        <StatCard title="Konflikti" value={stats?.detected || 0} icon={AlertTriangle} color="bg-red-50 border-red-200 text-red-800" alert={!!stats?.detected} />
        <StatCard title="Rešeno" value={stats?.resolved || 0} icon={GitBranch} color="bg-blue-50 border-blue-200 text-blue-800" />
        <StatCard title="Skupaj" value={stats?.total || 0} icon={Shield} color="bg-gray-50 border-gray-200 text-gray-800" />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        {['detected', 'resolved', 'none', 'all'].map((s) => (
          <Button
            key={s}
            variant={filter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {statusConfig[s]?.label || 'Vse'}
            {stats && s !== 'all' && (
              <Badge variant="secondary" className="ml-2">
                {String(stats[s as keyof SyncStats] || 0)}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Sinhronizacijska stanja ({syncStates.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : syncStates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {filter === 'detected'
                ? 'Ni konfliktov — vse sinhronizirano ✅'
                : 'Ni zapisov s tem filtrom'}
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {syncStates.map((state) => {
                  const cfg = statusConfig[state.conflictStatus] || statusConfig.none
                  const StatusIcon = cfg.icon
                  const conflictData = (state.conflictData as Record<string, unknown>) || {}
                  return (
                    <div
                      key={state.id}
                      className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <StatusIcon className={`h-4 w-4 flex-shrink-0 ${
                        state.conflictStatus === 'detected' ? 'text-red-500' : ''
                      }`} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={`text-xs ${cfg.color}`}>
                            {cfg.label}
                          </Badge>
                          <span className="text-sm font-medium">
                            {entityTypeLabels[state.entityType] || state.entityType}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ID: {state.entityId.substring(0, 12)}...
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            v{state.syncVersion}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {state.lastSyncedAt
                            ? `Zadnja sinhronizacija: ${format(new Date(state.lastSyncedAt), 'dd.MM HH:mm:ss')}`
                            : 'Še ni sinhronizirano'}
                        </div>
                        {state.conflictStatus === 'detected' && typeof conflictData.detectedAt === 'string' && (
                          <div className="text-xs text-red-600 mt-1">
                            ⚠ Konflikt zaznan: {format(new Date(conflictData.detectedAt), 'dd.MM HH:mm')}
                          </div>
                        )}
                      </div>

                      {state.conflictStatus === 'detected' && (
                        <Button size="sm" onClick={() => openResolveDialog(state)}>
                          <GitBranch className="h-4 w-4 mr-1" />
                          Reši
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

      {/* Resolve dialog */}
      <Dialog
        open={resolveDialog.open}
        onOpenChange={(open) =>
          setResolveDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Reši konflikt
            </DialogTitle>
            <DialogDescription>
              Entiteta: {resolveDialog.syncState && (entityTypeLabels[resolveDialog.syncState.entityType] || resolveDialog.syncState.entityType)}
              {' · '}ID: {resolveDialog.syncState?.entityId.substring(0, 16)}...
            </DialogDescription>
          </DialogHeader>

          {resolveDialog.syncState && (
            <ConflictDetail state={resolveDialog.syncState} />
          )}

          <div className="space-y-3">
            <Label>Strategija reševanja</Label>
            <div className="grid grid-cols-2 gap-2">
              <ResolutionOption
                value="keep_incoming"
                label="Obdrži incoming"
                description="Uporabi podatke iz novejše naprave"
                selected={resolveDialog.resolution === 'keep_incoming'}
                onClick={() => setResolveDialog((p) => ({ ...p, resolution: 'keep_incoming' }))}
              />
              <ResolutionOption
                value="keep_existing"
                label="Obdrži existing"
                description="Ohrani trenutne podatke"
                selected={resolveDialog.resolution === 'keep_existing'}
                onClick={() => setResolveDialog((p) => ({ ...p, resolution: 'keep_existing' }))}
              />
              <ResolutionOption
                value="merge"
                label="Spoji (merge)"
                description="Ročno kombiniraj podatke"
                selected={resolveDialog.resolution === 'merge'}
                onClick={() => setResolveDialog((p) => ({ ...p, resolution: 'merge' }))}
              />
              <ResolutionOption
                value="discard"
                label="Zavrzi"
                description="Zavrzi konflikt"
                selected={resolveDialog.resolution === 'discard'}
                onClick={() => setResolveDialog((p) => ({ ...p, resolution: 'discard' }))}
              />
            </div>

            {resolveDialog.resolution === 'merge' && (
              <div>
                <Label htmlFor="merged-data">Merged data (JSON)</Label>
                <Textarea
                  id="merged-data"
                  value={resolveDialog.mergedData}
                  onChange={(e) =>
                    setResolveDialog((p) => ({ ...p, mergedData: e.target.value }))
                  }
                  className="font-mono text-xs"
                  rows={6}
                />
              </div>
            )}

            <div>
              <Label htmlFor="notes">Opombe</Label>
              <Textarea
                id="notes"
                value={resolveDialog.notes}
                onChange={(e) =>
                  setResolveDialog((p) => ({ ...p, notes: e.target.value }))
                }
                placeholder="Zakaj si izbral to resolucijo?"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResolveDialog({ open: false, syncState: null, resolution: 'keep_incoming', mergedData: '', notes: '' })}
            >
              Prekliči
            </Button>
            <Button
              onClick={() => resolveMutation.mutate()}
              disabled={resolveMutation.isPending || (resolveDialog.resolution === 'merge' && !resolveDialog.mergedData)}
            >
              {resolveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Reši konflikt
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
  icon: typeof CheckCircle2
  color: string
  alert?: boolean
}

function StatCard({ title, value, icon: Icon, color, alert }: StatCardProps) {
  return (
    <Card className={`border-2 ${color} ${alert ? 'ring-2 ring-red-300' : ''}`}>
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

// --- ResolutionOption ---
interface ResolutionOptionProps {
  value: string
  label: string
  description: string
  selected: boolean
  onClick: () => void
}

function ResolutionOption({ label, description, selected, onClick }: ResolutionOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-3 border rounded-md transition-all ${
        selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/30'
      }`}
    >
      <div className="font-medium text-sm">{label}</div>
      <div className="text-xs text-muted-foreground mt-1">{description}</div>
    </button>
  )
}

// --- ConflictDetail ---
function ConflictDetail({ state }: { state: SyncState }) {
  const cd = (state.conflictData as Record<string, unknown>) || {}
  if (!cd.incomingVersion && !cd.existingVersion) {
    return <div className="text-xs text-muted-foreground">Brez podrobnosti konflikta</div>
  }

  return (
    <div className="bg-muted/30 rounded-md p-3 text-xs space-y-2 max-h-40 overflow-auto">
      <div className="font-medium text-foreground">Podrobnosti konflikta:</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-muted-foreground">Incoming (nova naprava):</div>
          <div className="font-mono">v{String(cd.incomingVersion || '?')}</div>
          <pre className="mt-1 text-[10px] bg-background p-1 rounded overflow-auto max-h-20">
            {JSON.stringify(cd.incomingData, null, 2)}
          </pre>
        </div>
        <div>
          <div className="text-muted-foreground">Existing (trenutno):</div>
          <div className="font-mono">v{String(cd.existingVersion || '?')}</div>
          <pre className="mt-1 text-[10px] bg-background p-1 rounded overflow-auto max-h-20">
            {JSON.stringify(cd.existingData, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
