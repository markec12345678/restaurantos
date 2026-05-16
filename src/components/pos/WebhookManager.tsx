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
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Search, Globe, Zap, Shield,
  Send, AlertTriangle, CheckCircle2, XCircle, Clock,
  Activity, Webhook,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'

// ============================================
// TIPI
// ============================================

interface WebhookItem {
  id: string
  name: string
  url: string
  events: string
  isActive: boolean
  secret: string
  lastTriggered: string | null
  failureCount: number
  createdAt: string
  updatedAt: string
}

// ============================================
// KONSTANTE
// ============================================

const eventOptions = [
  { value: 'order.created', label: 'Naročilo ustvarjeno', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'order.paid', label: 'Naročilo plačano', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { value: 'order.ready', label: 'Naročilo pripravljeno', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'stock.low', label: 'Zaloga nizka', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'shift.started', label: 'Izmena začeta', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'payment.received', label: 'Plačilo prejeto', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400' },
]

function getEventConfig(value: string) {
  return eventOptions.find(e => e.value === value) || { value, label: value, color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' }
}

function formatDateSI(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Nikoli'
  const d = new Date(dateStr)
  return d.toLocaleDateString('sl-SI', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export function WebhookManager() {
  const queryClient = useQueryClient()

  // --- Stanja ---
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  // --- Dijalog za vnos/urejanje ---
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<WebhookItem | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: '',
    isActive: true,
  })

  // --- Dijalog za brisanje ---
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<WebhookItem | null>(null)

  // ============================================
  // QUERIES
  // ============================================

  const { data: webhooks, isLoading } = useQuery<WebhookItem[]>({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const res = await authFetch('/api/webhooks')
      return res.json()
    },
  })

  // ============================================
  // IZRAČUNI
  // ============================================

  const allWebhooks = Array.isArray(webhooks) ? webhooks : []

  const filteredWebhooks = useMemo(() => {
    let items = allWebhooks
    if (!showInactive) items = items.filter(w => w.isActive)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(w =>
        w.name.toLowerCase().includes(q) ||
        w.url.toLowerCase().includes(q)
      )
    }
    return items
  }, [allWebhooks, search, showInactive])

  const activeCount = allWebhooks.filter(w => w.isActive).length
  const totalEvents = allWebhooks.reduce((sum, w) => {
    try { return sum + JSON.parse(w.events || '[]').length } catch { return sum }
  }, 0)
  const failedCount = allWebhooks.filter(w => w.failureCount > 0).length

  // ============================================
  // MUTATIONS
  // ============================================

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/webhooks', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Spletna kljuka uspešno ustvarjena')
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      setDialogOpen(false)
    },
    onError: () => toast.error('Napaka pri ustvarjanju spletne kljuke'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/webhooks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Spletna kljuka uspešno posodobljena')
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      setDialogOpen(false)
      setEditingItem(null)
    },
    onError: () => toast.error('Napaka pri posodabljanju spletne kljuke'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/webhooks/${id}`, { method: 'DELETE' })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Spletna kljuka uspešno izbrisana')
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    },
    onError: () => toast.error('Napaka pri brisanju spletne kljuke'),
  })

  // ============================================
  // HANDLERJI
  // ============================================

  const openCreate = () => {
    setEditingItem(null)
    setFormData({ name: '', url: '', events: [], secret: '', isActive: true })
    setDialogOpen(true)
  }

  const openEdit = (item: WebhookItem) => {
    setEditingItem(item)
    let parsedEvents: string[] = []
    try { parsedEvents = JSON.parse(item.events || '[]') } catch {}
    setFormData({
      name: item.name,
      url: item.url,
      events: parsedEvents,
      secret: item.secret,
      isActive: item.isActive,
    })
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!formData.name.trim()) { toast.error('Ime je obvezno'); return }
    if (!formData.url.trim()) { toast.error('URL je obvezen'); return }
    if (formData.events.length === 0) { toast.error('Izberite vsaj en dogodek'); return }

    const payload = {
      name: formData.name,
      url: formData.url,
      events: JSON.stringify(formData.events),
      secret: formData.secret,
      isActive: formData.isActive,
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const toggleEvent = (eventValue: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventValue)
        ? prev.events.filter(e => e !== eventValue)
        : [...prev.events, eventValue],
    }))
  }

  const testWebhook = (item: WebhookItem) => {
    toast.success(`Testni webhook poslan na ${item.url}`, { description: 'Preverite dnevnik strežnika za odziv' })
  }

  // ============================================
  // RENDER
  // ============================================

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
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
            <Webhook className="h-5 w-5 text-primary" />
            Spletne kljuke
          </h2>
          <p className="text-sm text-muted-foreground">Upravljanje webhook integracij za obvestila v realnem času</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj webhook
        </Button>
      </div>

      {/* Povzetek */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{allWebhooks.length}</p>
                <p className="text-xs text-muted-foreground">Skupaj kljuk</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Aktivne</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{totalEvents}</p>
                <p className="text-xs text-muted-foreground">Sledeni dogodki</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{failedCount}</p>
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
              <Input
                placeholder="Išči po imenu ali URL-ju..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 h-9">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} />
              <Label className="text-sm text-muted-foreground">Prikaži nedejavne</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {filteredWebhooks.length === 0 ? (
            <div className="text-center py-16">
              <Webhook className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-1">Ni spletnih kljuk</h3>
              <p className="text-sm text-muted-foreground mb-4">Ustvarite prvo spletno kljuko za začetek integracij</p>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Dodaj webhook</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ime</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Dogodki</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Nazadnje sproženo</TableHead>
                  <TableHead>Napake</TableHead>
                  <TableHead className="text-right">Dejanja</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWebhooks.map(item => {
                  let parsedEvents: string[] = []
                  try { parsedEvents = JSON.parse(item.events || '[]') } catch {}
                  return (
                    <TableRow key={item.id} className={!item.isActive ? 'opacity-60' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="font-medium text-sm">{item.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono text-muted-foreground max-w-48 truncate block">{item.url}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {parsedEvents.slice(0, 3).map(ev => {
                            const cfg = getEventConfig(ev)
                            return (
                              <Badge key={ev} className={`text-[9px] px-1.5 py-0 ${cfg.color}`}>
                                {cfg.label}
                              </Badge>
                            )
                          })}
                          {parsedEvents.length > 3 && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">+{parsedEvents.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.isActive ? (
                          <Badge className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Aktiven</Badge>
                        ) : (
                          <Badge className="text-xs bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400">Nedejaven</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateSI(item.lastTriggered)}
                      </TableCell>
                      <TableCell>
                        {item.failureCount > 0 ? (
                          <Badge className="text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            <XCircle className="h-3 w-3 mr-1" />
                            {item.failureCount}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Testiraj" onClick={() => testWebhook(item)}>
                            <Send className="h-3.5 w-3.5" />
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-primary" />
              {editingItem ? 'Uredi spletno kljuko' : 'Dodaj webhook'}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? 'Posodobite nastavitve spletne kljuke.' : 'Ustvarite novo spletno kljuko za obvestila v realnem času.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Ime *</Label>
              <Input
                placeholder="npr. Obvestilo kuhinji"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">URL končne točke *</Label>
              <Input
                placeholder="https://primer.si/api/webhook"
                value={formData.url}
                onChange={e => setFormData({ ...formData, url: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Dogodki *</Label>
              <div className="grid grid-cols-2 gap-2">
                {eventOptions.map(ev => (
                  <label
                    key={ev.value}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors text-sm ${
                      formData.events.includes(ev.value)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.events.includes(ev.value)}
                      onChange={() => toggleEvent(ev.value)}
                      className="rounded"
                    />
                    <span>{ev.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Skrivnost</Label>
              <Input
                placeholder="Skrivnost za podpisovanje payloada"
                value={formData.secret}
                onChange={e => setFormData({ ...formData, secret: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Uporablja se za HMAC podpisovanje payloada</p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Aktiven</Label>
                <p className="text-xs text-muted-foreground">Nedejavne kljuke ne bodo sprožene</p>
              </div>
              <Switch checked={formData.isActive} onCheckedChange={checked => setFormData({ ...formData, isActive: checked })} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingItem(null) }}>Prekliči</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? (
                <><span className="animate-spin mr-2">⏳</span>Shranjujem...</>
              ) : editingItem ? 'Posodobi' : <><Plus className="h-4 w-4 mr-1.5" />Ustvari</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dijalog za brisanje */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Izbriši spletno kljuko</AlertDialogTitle>
            <AlertDialogDescription>
              Ali ste prepričani, da želite izbrisati spletno kljuko <strong>&bdquo;{deleteTarget?.name}&ldquo;</strong>? Tega dejanja ni mogoče razveljaviti.
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
