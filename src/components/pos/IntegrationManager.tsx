'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Search, Plug, RefreshCw, Play,
  CheckCircle2, XCircle, Clock, Wifi, WifiOff,
  ArrowRightLeft, Activity, Settings2, Zap,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { INTEGRATION_CONNECTORS, getConnectorTypes, type IntegrationConnector } from '@/lib/integrations/connectors'

// ============================================
// TIPI
// ============================================

interface IntegrationItem {
  id: string
  name: string
  type: string
  provider: string
  baseUrl: string
  apiKey: string
  apiSecret: string
  config: string
  syncEnabled: boolean
  syncInterval: number
  lastSyncAt: string | null
  lastSyncStatus: string
  lastSyncError: string
  events: string
  isActive: boolean
  connectionStatus: string
  _count?: { logs: number }
  createdAt: string
  updatedAt: string
}

// ============================================
// POMOŽNE FUNKCIJE
// ============================================

function formatDateSI(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Nikoli'
  const d = new Date(dateStr)
  return d.toLocaleDateString('sl-SI', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function getConnectionStatusConfig(status: string) {
  switch (status) {
    case 'connected': return { label: 'Povezano', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', icon: Wifi }
    case 'disconnected': return { label: 'Nepovezano', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400', icon: WifiOff }
    case 'error': return { label: 'Napaka', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle }
    default: return { label: 'Neznano', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400', icon: WifiOff }
  }
}

function getTypeLabel(type: string): string {
  const types: Record<string, string> = {
    eracuni: 'e-Računi',
    accounting: 'Računovodstvo',
    delivery: 'Dostava',
    crm: 'CRM',
    ecommerce: 'E-Commerce',
    analytics: 'Analitika',
    custom: 'Splošno',
  }
  return types[type] || type
}

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export function IntegrationManager() {
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')

  // Dijalog za vnos/urejanje
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<IntegrationItem | null>(null)
  const [selectedConnector, setSelectedConnector] = useState<IntegrationConnector | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'custom' as string,
    provider: 'custom',
    baseUrl: '',
    apiKey: '',
    apiSecret: '',
    config: '{}',
    syncEnabled: true,
    syncInterval: 300,
    events: [] as string[],
    isActive: true,
  })

  // Dijalog za brisanje
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<IntegrationItem | null>(null)

  // ============================================
  // QUERIES
  // ============================================

  const { data: integrations, isLoading } = useQuery<IntegrationItem[]>({
    queryKey: ['integrations'],
    queryFn: async () => {
      const res = await authFetch('/api/integrations')
      return res.json()
    },
  })

  // ============================================
  // IZRAČUNI
  // ============================================

  const allIntegrations = Array.isArray(integrations) ? integrations : []

  const filteredIntegrations = useMemo(() => {
    let items = allIntegrations
    if (filterType !== 'all') items = items.filter(i => i.type === filterType)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.provider.toLowerCase().includes(q)
      )
    }
    return items
  }, [allIntegrations, search, filterType])

  const activeCount = allIntegrations.filter(i => i.isActive).length
  const connectedCount = allIntegrations.filter(i => i.connectionStatus === 'connected').length
  const errorCount = allIntegrations.filter(i => i.connectionStatus === 'error').length

  // ============================================
  // MUTATIONS
  // ============================================

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/integrations', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Integracija uspešno ustvarjena')
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      setDialogOpen(false)
    },
    onError: () => toast.error('Napaka pri ustvarjanju integracije'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/integrations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Integracija uspešno posodobljena')
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      setDialogOpen(false)
      setEditingItem(null)
    },
    onError: () => toast.error('Napaka pri posodabljanju integracije'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/integrations/${id}`, { method: 'DELETE' })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Integracija uspešno izbrisana')
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    },
    onError: () => toast.error('Napaka pri brisanju integracije'),
  })

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/integrations/${id}/test`, { method: 'POST' })
      return res.json()
    },
    onSuccess: (data) => {
      if (data.status === 'connected') {
        toast.success('Povezava uspešna', { description: `Odziv v ${data.durationMs}ms` })
      } else {
        toast.error('Povezava ni uspela', { description: data.error || `HTTP ${data.statusCode}` })
      }
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
    },
    onError: () => toast.error('Napaka pri testiranju povezave'),
  })

  const syncMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/integrations/${id}/sync`, { method: 'POST' })
      return res.json()
    },
    onSuccess: (data) => {
      if (data.status === 'success') {
        toast.success('Sinhronizacija uspešna', { description: `Trajanje: ${data.durationMs}ms` })
      } else {
        toast.error('Sinhronizacija ni uspela', { description: data.error })
      }
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
    },
    onError: () => toast.error('Napaka pri sinhronizaciji'),
  })

  // ============================================
  // HANDLERJI
  // ============================================

  const openCreate = () => {
    setEditingItem(null)
    setSelectedConnector(null)
    setFormData({ name: '', type: 'custom', provider: 'custom', baseUrl: '', apiKey: '', apiSecret: '', config: '{}', syncEnabled: true, syncInterval: 300, events: [], isActive: true })
    setDialogOpen(true)
  }

  const selectConnector = (connector: IntegrationConnector) => {
    setSelectedConnector(connector)
    setFormData({
      name: connector.name,
      type: connector.type,
      provider: connector.provider,
      baseUrl: connector.baseUrl,
      apiKey: '',
      apiSecret: '',
      config: JSON.stringify(
        connector.configFields.reduce<Record<string, string>>((acc, f) => {
          if (f.defaultValue) acc[f.key] = f.defaultValue
          return acc
        }, {}),
        null,
        2
      ),
      syncEnabled: true,
      syncInterval: 300,
      events: connector.defaultEvents,
      isActive: true,
    })
  }

  const openEdit = (item: IntegrationItem) => {
    setEditingItem(item)
    setSelectedConnector(null)
    let parsedEvents: string[] = []
    try { parsedEvents = JSON.parse(item.events || '[]') } catch {}
    setFormData({
      name: item.name,
      type: item.type,
      provider: item.provider,
      baseUrl: item.baseUrl,
      apiKey: '', // Ne pokažemo ključev
      apiSecret: '',
      config: item.config,
      syncEnabled: item.syncEnabled,
      syncInterval: item.syncInterval,
      events: parsedEvents,
      isActive: item.isActive,
    })
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!formData.name.trim()) { toast.error('Ime je obvezno'); return }

    const payload = {
      name: formData.name,
      type: formData.type,
      provider: formData.provider,
      baseUrl: formData.baseUrl,
      apiKey: formData.apiKey || undefined,
      apiSecret: formData.apiSecret || undefined,
      config: formData.config,
      syncEnabled: formData.syncEnabled,
      syncInterval: formData.syncInterval,
      events: JSON.stringify(formData.events),
      isActive: formData.isActive,
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  // ============================================
  // RENDER
  // ============================================

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar">
      {/* Glava */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Plug className="h-5 w-5 text-primary" />
            Integracije
          </h2>
          <p className="text-sm text-muted-foreground">Povezave z zunanjimi sistemi: e-Računi, računovodstvo, dostava, CRM</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj integracijo
        </Button>
      </div>

      {/* Povzetek */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Plug className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{allIntegrations.length}</p>
                <p className="text-xs text-muted-foreground">Skupaj integracij</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                <Wifi className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{connectedCount}</p>
                <p className="text-xs text-muted-foreground">Povezanih</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Aktivnih</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{errorCount}</p>
                <p className="text-xs text-muted-foreground">Z napakami</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtri */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative flex-1 min-w-48 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Išči po imenu ali ponudniku..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtriraj po tipu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Vsi tipi</SelectItem>
                {getConnectorTypes().map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {filteredIntegrations.length === 0 ? (
            <div className="text-center py-16">
              <Plug className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-1">Ni integracij</h3>
              <p className="text-sm text-muted-foreground mb-4">Dodajte prvo integracijo za povezavo z zunanjimi sistemi</p>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Dodaj integracijo</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ime</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Povezava</TableHead>
                  <TableHead>Zadnja sinh.</TableHead>
                  <TableHead>Status sinh.</TableHead>
                  <TableHead className="text-right">Dejanja</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIntegrations.map(item => {
                  const connStatus = getConnectionStatusConfig(item.connectionStatus)
                  const ConnIcon = connStatus.icon
                  return (
                    <TableRow key={item.id} className={!item.isActive ? 'opacity-60' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-primary flex-shrink-0" />
                          <div>
                            <span className="font-medium text-sm">{item.name}</span>
                            <p className="text-xs text-muted-foreground">{item.provider}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{getTypeLabel(item.type)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${connStatus.color}`}>
                          <ConnIcon className="h-3 w-3 mr-1" />
                          {connStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateSI(item.lastSyncAt)}
                      </TableCell>
                      <TableCell>
                        {item.lastSyncStatus === 'success' ? (
                          <Badge className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">OK</Badge>
                        ) : item.lastSyncStatus === 'error' ? (
                          <Badge className="text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" title={item.lastSyncError}>Napaka</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Testiraj povezavo" onClick={() => testMutation.mutate(item.id)} disabled={testMutation.isPending}>
                            <Zap className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Sinhroniziraj" onClick={() => syncMutation.mutate(item.id)} disabled={syncMutation.isPending || !item.syncEnabled}>
                            <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Uredi" onClick={() => openEdit(item)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Izbriši" onClick={() => { setDeleteTarget(item); setDeleteDialogOpen(true) }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dijalog za vnos/urejanje */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) setEditingItem(null); setDialogOpen(open) }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-primary" />
              {editingItem ? 'Uredi integracijo' : 'Dodaj integracijo'}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? 'Posodobite nastavitve integracije.' : 'Izberite konektor ali ustvarite splošno integracijo.'}
            </DialogDescription>
          </DialogHeader>

          {!editingItem && !selectedConnector && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Izberite konektor</Label>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {INTEGRATION_CONNECTORS.map(conn => (
                  <button
                    key={conn.id}
                    onClick={() => selectConnector(conn)}
                    className="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <span className="text-2xl">{conn.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{conn.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{conn.description}</p>
                      <Badge variant="secondary" className="text-[9px] mt-1">{getTypeLabel(conn.type)}</Badge>
                    </div>
                  </button>
                ))}
              </div>
              <Separator />
              <button
                onClick={() => {
                  setSelectedConnector(INTEGRATION_CONNECTORS[INTEGRATION_CONNECTORS.length - 1])
                  selectConnector(INTEGRATION_CONNECTORS[INTEGRATION_CONNECTORS.length - 1])
                }}
                className="w-full flex items-center gap-3 rounded-lg border-2 border-dashed p-3 text-left transition-colors hover:bg-muted/50"
              >
                <Settings2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Splošen Webhook / API</p>
                  <p className="text-xs text-muted-foreground">Povežite s poljubnim sistemom preko HTTP API-ja</p>
                </div>
              </button>
            </div>
          )}

          {(editingItem || selectedConnector) && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Ime *</Label>
                  <Input placeholder="npr. Moji e-Računi" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Tip</Label>
                  <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {getConnectorTypes().map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Base URL</Label>
                <Input placeholder="https://api.example.com" value={formData.baseUrl} onChange={e => setFormData({ ...formData, baseUrl: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">API Ključ</Label>
                  <Input type="password" placeholder="Vaš API ključ" value={formData.apiKey} onChange={e => setFormData({ ...formData, apiKey: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">API Skrivnost</Label>
                  <Input type="password" placeholder="Vaša API skrivnost" value={formData.apiSecret} onChange={e => setFormData({ ...formData, apiSecret: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Konfiguracija (JSON)</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                  placeholder='{"companyId": "123"}'
                  value={formData.config}
                  onChange={e => setFormData({ ...formData, config: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold">Sinhronizacija</Label>
                    <p className="text-xs text-muted-foreground">Omogoči samodejno sinh.</p>
                  </div>
                  <Switch checked={formData.syncEnabled} onCheckedChange={checked => setFormData({ ...formData, syncEnabled: checked })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Interval (sekunde)</Label>
                  <Input type="number" min={60} max={86400} value={formData.syncInterval} onChange={e => setFormData({ ...formData, syncInterval: parseInt(e.target.value) || 300 })} />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Aktivna</Label>
                  <p className="text-xs text-muted-foreground">Nedejavne integracije se ne sinhronizirajo</p>
                </div>
                <Switch checked={formData.isActive} onCheckedChange={checked => setFormData({ ...formData, isActive: checked })} />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingItem(null); setSelectedConnector(null) }}>Prekliči</Button>
            {(editingItem || selectedConnector) && (
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? (
                  <><span className="animate-spin mr-2">⏳</span>Shranjujem...</>
                ) : editingItem ? 'Posodobi' : <><Plus className="h-4 w-4 mr-1.5" />Ustvari</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dijalog za brisanje */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Izbriši integracijo</AlertDialogTitle>
            <AlertDialogDescription>
              Ali ste prepričani, da želite izbrisati integracijo <strong>&bdquo;{deleteTarget?.name}&ldquo;</strong>? Vsi povezani dnevniki bodo izbrisani. Tega dejanja ni mogoče razveljaviti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Prekliči</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Izbriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
