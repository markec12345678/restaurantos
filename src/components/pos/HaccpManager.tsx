'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Search, Thermometer, Sparkles, Truck,
  Snowflake, GraduationCap, AlertTriangle, CheckCircle2, XCircle,
  Clock, ClipboardList, Filter, RotateCcw, ShieldCheck, ChevronDown,
  ChevronUp, FileText, Activity,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'

// ============================================
// TIPI
// ============================================

interface HaccpEntry {
  id: string
  date: string
  category: string
  title: string
  description: string
  value: string
  status: string
  correctiveAction: string
  employeeName: string
  createdAt: string
  updatedAt: string
}

// ============================================
// KONSTANTE
// ============================================

const categoryConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  temperature: { label: 'Temperature', icon: Thermometer, color: 'text-orange-600' },
  cleaning: { label: 'Čiščenje & dezinfekcija', icon: Sparkles, color: 'text-teal-600' },
  delivery: { label: 'Sprejem dobave', icon: Truck, color: 'text-blue-600' },
  cooling: { label: 'Hlajenje', icon: Snowflake, color: 'text-cyan-600' },
  training: { label: 'Izobraževanje', icon: GraduationCap, color: 'text-purple-600' },
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string; dotColor: string }> = {
  ok: {
    label: 'V redu',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    dotColor: 'bg-emerald-500',
  },
  warning: {
    label: 'Opozorilo',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
    dotColor: 'bg-amber-500',
  },
  critical: {
    label: 'Kritično',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
    dotColor: 'bg-red-500',
  },
}

const statusBadgeStyles: Record<string, string> = {
  ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

// Predloge za hitri vnos (pogosti HACCP kontrolni točki)
const quickTemplates: Record<string, { title: string; value: string; category: string }[]> = {
  temperature: [
    { title: 'Hladilnik - kontrola temperature', value: '°C', category: 'temperature' },
    { title: 'Zamrzovalnik - kontrola temperature', value: '°C', category: 'temperature' },
    { title: 'Vroča hrana - kontrola temperature', value: '°C', category: 'temperature' },
    { title: 'Servisna miza - kontrola temperature', value: '°C', category: 'temperature' },
  ],
  cleaning: [
    { title: 'Dnevno čiščenje kuhinje', value: 'Opravljeno', category: 'cleaning' },
    { title: 'Dezinfekcija delovnih površin', value: 'Opravljeno', category: 'cleaning' },
    { title: 'Pranje posode - kontrola', value: 'Opravljeno', category: 'cleaning' },
    { title: 'Čiščenje sanitarij', value: 'Opravljeno', category: 'cleaning' },
  ],
  delivery: [
    { title: 'Sprejem dobave - kontrola temperature', value: '°C', category: 'delivery' },
    { title: 'Sprejem dobave - organoleptična kontrola', value: 'Ustreza', category: 'delivery' },
    { title: 'Sprejem dobave - rok uporabe', value: 'Ustreza', category: 'delivery' },
  ],
  cooling: [
    { title: 'Hlajenje kuhane hrane', value: '°C', category: 'cooling' },
    { title: 'Hladilna vitrina - kontrola', value: '°C', category: 'cooling' },
  ],
  training: [
    { title: 'Usposabljanje o osebni higieni', value: 'Zaključeno', category: 'training' },
    { title: 'Usposabljanje o HACCP načrtu', value: 'Zaključeno', category: 'training' },
    { title: 'Usposabljanje o alergenih', value: 'Zaključeno', category: 'training' },
  ],
}

const tabItems = [
  { value: 'all', label: 'Vsi vnosi', icon: ClipboardList },
  { value: 'temperature', label: 'Temperature', icon: Thermometer },
  { value: 'cleaning', label: 'Čiščenje', icon: Sparkles },
  { value: 'delivery', label: 'Dobava', icon: Truck },
  { value: 'cooling', label: 'Hlajenje', icon: Snowflake },
  { value: 'training', label: 'Izobraževanje', icon: GraduationCap },
]

// ============================================
// POMOŽNE FUNKCIJE
// ============================================

function formatDateSI(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  )
}

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export function HaccpManager() {
  const queryClient = useQueryClient()

  // --- Stanja ---
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // --- Dijalog za vnos/urejanje ---
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<HaccpEntry | null>(null)
  const [formData, setFormData] = useState({
    category: 'temperature',
    title: '',
    description: '',
    value: '',
    status: 'ok',
    correctiveAction: '',
    employeeName: '',
  })

  // --- Dijalog za brisanje ---
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<HaccpEntry | null>(null)

  // --- Razširjeni vnosi ---
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null)

  // ============================================
  // QUERIES
  // ============================================

  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    if (activeTab !== 'all') params.set('category', activeTab)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    return params.toString()
  }, [activeTab, dateFrom, dateTo])

  const { data: entries, isLoading } = useQuery<HaccpEntry[]>({
    queryKey: ['haccp', activeTab, dateFrom, dateTo],
    queryFn: async () => {
      const res = await authFetch(`/api/haccp?${queryParams}`)
      return res.json()
    },
  })

  // ============================================
  // IZRAČUNI ZA Povzetek
  // ============================================

  const allEntries = Array.isArray(entries) ? entries : []

  const filteredEntries = allEntries.filter((entry) =>
    entry.title.toLowerCase().includes(search.toLowerCase()) ||
    entry.description.toLowerCase().includes(search.toLowerCase()) ||
    entry.employeeName.toLowerCase().includes(search.toLowerCase())
  )

  const todayEntries = allEntries.filter((e) => isToday(e.date))
  const warningCount = allEntries.filter((e) => e.status === 'warning').length
  const criticalCount = allEntries.filter((e) => e.status === 'critical').length
  const lastEntryTime = allEntries.length > 0
    ? formatDateSI(allEntries[0].createdAt)
    : 'Ni vnosov'

  // ============================================
  // MUTATIONS
  // ============================================

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/haccp', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return res.json()
    },
    onSuccess: () => {
      toast.success('HACCP vnos uspešno dodan')
      queryClient.invalidateQueries({ queryKey: ['haccp'] })
      setDialogOpen(false)
    },
    onError: () => {
      toast.error('Napaka pri dodajanju HACCP vnosa')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch('/api/haccp', {
        method: 'PUT',
        body: JSON.stringify({ id, ...data }),
      })
      return res.json()
    },
    onSuccess: () => {
      toast.success('HACCP vnos uspešno posodobljen')
      queryClient.invalidateQueries({ queryKey: ['haccp'] })
      setDialogOpen(false)
      setEditingEntry(null)
    },
    onError: () => {
      toast.error('Napaka pri posodabljanju HACCP vnosa')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/haccp?id=${id}`, { method: 'DELETE' })
      return res.json()
    },
    onSuccess: () => {
      toast.success('HACCP vnos uspešno izbrisan')
      queryClient.invalidateQueries({ queryKey: ['haccp'] })
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    },
    onError: () => {
      toast.error('Napaka pri brisanju HACCP vnosa')
    },
  })

  // ============================================
  // HANDLERJI
  // ============================================

  const openCreate = (presetCategory?: string, presetTitle?: string, presetValue?: string) => {
    setEditingEntry(null)
    setFormData({
      category: presetCategory || 'temperature',
      title: presetTitle || '',
      description: '',
      value: presetValue || '',
      status: 'ok',
      correctiveAction: '',
      employeeName: '',
    })
    setDialogOpen(true)
  }

  const openEdit = (entry: HaccpEntry) => {
    setEditingEntry(entry)
    setFormData({
      category: entry.category,
      title: entry.title,
      description: entry.description,
      value: entry.value,
      status: entry.status,
      correctiveAction: entry.correctiveAction,
      employeeName: entry.employeeName,
    })
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast.error('Naslov vnosa je obvezen')
      return
    }
    if (!formData.employeeName.trim()) {
      toast.error('Ime zaposlenega je obvezno')
      return
    }

    const payload = {
      ...formData,
      date: new Date().toISOString(),
    }

    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const confirmDelete = (entry: HaccpEntry) => {
    setDeleteTarget(entry)
    setDeleteDialogOpen(true)
  }

  const resetFilters = () => {
    setDateFrom('')
    setDateTo('')
    setSearch('')
    setActiveTab('all')
  }

  // ============================================
  // RENDER: POVZETEK
  // ============================================

  const renderSummaryCards = () => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{todayEntries.length}</p>
              <p className="text-xs text-muted-foreground">Vnosi danes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={`hover:shadow-md transition-shadow ${warningCount > 0 ? 'border-amber-200 dark:border-amber-800' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{warningCount}</p>
              <p className="text-xs text-muted-foreground">Opozorila</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={`hover:shadow-md transition-shadow ${criticalCount > 0 ? 'border-red-200 dark:border-red-800' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">{criticalCount}</p>
              <p className="text-xs text-muted-foreground">Kritični vnosi</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold">{lastEntryTime}</p>
              <p className="text-xs text-muted-foreground">Zadnji vnos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // ============================================
  // RENDER: KARTICA VNOSA
  // ============================================

  const renderEntryCard = (entry: HaccpEntry) => {
    const status = statusConfig[entry.status] || statusConfig.ok
    const category = categoryConfig[entry.category] || categoryConfig.temperature
    const CategoryIcon = category.icon
    const isExpanded = expandedEntry === entry.id
    const needsAction = entry.status === 'warning' || entry.status === 'critical'

    return (
      <Card
        key={entry.id}
        className={`hover:shadow-md transition-shadow border-l-4 ${status.borderColor}`}
      >
        <CardContent className="p-4 space-y-3">
          {/* Glava: ikona, naslov, status badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${status.bgColor} ${status.color} flex-shrink-0 mt-0.5`}>
                <CategoryIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{entry.title}</p>
                  <div className="flex items-center gap-1">
                    <span className={`h-2 w-2 rounded-full ${status.dotColor}`} />
                    <Badge className={`text-[10px] px-1.5 py-0 ${statusBadgeStyles[entry.status] || ''}`}>
                      {status.label}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {category.label}
                  </Badge>
                  {entry.value && (
                    <span className="text-sm font-medium text-muted-foreground">
                      {entry.value}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Uredi" onClick={() => openEdit(entry)}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Izbriši" onClick={() => confirmDelete(entry)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Opis (če obstaja) */}
          {entry.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{entry.description}</p>
          )}

          {/* Korektivni ukrep - poudarjen pri warning/critical */}
          {needsAction && entry.correctiveAction && (
            <div className={`rounded-lg p-3 ${status.bgColor} border ${status.borderColor}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldCheck className={`h-3.5 w-3.5 ${status.color}`} />
                <span className={`text-xs font-semibold ${status.color}`}>Korektivni ukrep</span>
              </div>
              <p className={`text-xs ${status.color}`}>{entry.correctiveAction}</p>
            </div>
          )}

          {/* Opozorilo, če manjka korektivni ukrep pri warning/critical */}
          {needsAction && !entry.correctiveAction && (
            <div className="rounded-lg p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                  Potreben korektivni ukrep!
                </span>
              </div>
            </div>
          )}

          {/* Noga: datum, zaposleni */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <span>{formatDateSI(entry.date)}</span>
            </div>
            {entry.employeeName && (
              <span className="truncate ml-2">{entry.employeeName}</span>
            )}
          </div>

          {/* Razširjeni del: podrobnosti */}
          <button
            onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
            className="flex items-center gap-1 text-xs text-primary w-full hover:underline"
          >
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {isExpanded ? 'Skrij podrobnosti' : 'Prikaži podrobnosti'}
          </button>
          {isExpanded && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-xs">
              {entry.description && (
                <div>
                  <span className="font-semibold text-muted-foreground">Opis:</span>
                  <p className="mt-0.5">{entry.description}</p>
                </div>
              )}
              {entry.value && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Meritev/Vrednost:</span>
                  <span className="font-medium">{entry.value}</span>
                </div>
              )}
              {entry.correctiveAction && (
                <div>
                  <span className="font-semibold text-muted-foreground">Korektivni ukrep:</span>
                  <p className="mt-0.5">{entry.correctiveAction}</p>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-muted-foreground">
                <span>Ustvarjeno: {formatDateSI(entry.createdAt)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Posodobljeno: {formatDateSI(entry.updatedAt)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // ============================================
  // RENDER: HITRE PREDLOGE
  // ============================================

  const renderQuickTemplates = () => {
    const templates = activeTab !== 'all' ? quickTemplates[activeTab] : null
    if (!templates) return null

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Hitri vnos — predloge
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {templates.map((tpl, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => openCreate(tpl.category, tpl.title, tpl.value)}
              >
                <Plus className="h-3 w-3 mr-1" />
                {tpl.title}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // ============================================
  // RENDER: OPOZORILA (warning + critical)
  // ============================================

  const renderAlerts = () => {
    const alertEntries = allEntries.filter((e) => e.status === 'warning' || e.status === 'critical')
    if (alertEntries.length === 0) return null

    return (
      <Card className="border-red-200 dark:border-red-900/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span className="font-semibold text-red-600 dark:text-red-400">
              Aktivna opozorila ({alertEntries.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {alertEntries.slice(0, 8).map((entry) => {
              const cfg = statusConfig[entry.status]
              return (
                <Badge
                  key={entry.id}
                  className={`text-xs cursor-pointer ${statusBadgeStyles[entry.status]}`}
                  onClick={() => {
                    const cat = entry.category
                    if (activeTab !== cat) setActiveTab(cat)
                  }}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotColor} mr-1`} />
                  {entry.title}: {entry.value || cfg.label}
                  {!entry.correctiveAction && ' ⚠ Brez ukrepa'}
                </Badge>
              )
            })}
            {alertEntries.length > 8 && (
              <Badge variant="outline" className="text-xs">
                +{alertEntries.length - 8} več
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // ============================================
  // RENDER: FILTRI
  // ============================================

  const renderFilters = () => (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Išči po naslovu, opisu, zaposlenem..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Filtri datuma
            {(dateFrom || dateTo) && (
              <span className="ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] px-1">
                !
              </span>
            )}
          </Button>
          {(dateFrom || dateTo || search || activeTab !== 'all') && (
            <Button variant="ghost" size="sm" className="h-9" onClick={resetFilters}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Počisti
            </Button>
          )}
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-3 items-end mt-3 pt-3 border-t">
            <div>
              <Label className="text-xs">Od datuma</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 w-40"
              />
            </div>
            <div>
              <Label className="text-xs">Do datuma</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 w-40"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )

  // ============================================
  // RENDER: DIJALOG ZA VNOS/UREJANJE
  // ============================================

  const renderFormDialog = () => (
    <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setEditingEntry(null) } setDialogOpen(open) }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {editingEntry ? 'Uredi HACCP vnos' : 'Nov HACCP vnos'}
          </DialogTitle>
          <DialogDescription>
            {editingEntry
              ? 'Posodobite podatke obstoječega HACCP vnosa.'
              : 'Vnesite novo kontrolo ali meritev v HACCP dnevnik.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Kategorija */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Kategorija *</Label>
            <Select
              value={formData.category}
              onValueChange={(v) => setFormData({ ...formData, category: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Izberite kategorijo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryConfig).map(([key, cfg]) => {
                  const Icon = cfg.icon
                  return (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Naslov */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Naslov vnosa *</Label>
            <Input
              placeholder="npr. Hladilnik - kontrola temperature"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          {/* Vrednost/Meritev in Status - vzporedno */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Meritev/Vrednost</Label>
              <Input
                placeholder="npr. 4.2°C"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Izberite status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${cfg.dotColor}`} />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Korektivni ukrep - poudarjen ko je warning/critical */}
          {(formData.status === 'warning' || formData.status === 'critical') && (
            <div className="space-y-1.5">
              <div className={`rounded-lg p-2.5 ${statusConfig[formData.status].bgColor} border ${statusConfig[formData.status].borderColor}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className={`h-3.5 w-3.5 ${statusConfig[formData.status].color}`} />
                  <span className={`text-xs font-semibold ${statusConfig[formData.status].color}`}>
                    {formData.status === 'critical'
                      ? 'Kritično! Korektivni ukrep je obvezen!'
                      : 'Opozorilo! Vnesite korektivni ukrep.'}
                  </span>
                </div>
              </div>
              <Label className="text-sm font-semibold">Korektivni ukrep</Label>
              <Textarea
                placeholder="Opišite ukrepe, ki so bili izvedeni za odpravo nepravilnosti..."
                value={formData.correctiveAction}
                onChange={(e) => setFormData({ ...formData, correctiveAction: e.target.value })}
                rows={3}
              />
            </div>
          )}

          {/* Opis */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Opis</Label>
            <Textarea
              placeholder="Podrobnejši opis kontrole ali meritve..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          {/* Zaposleni */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Zaposleni *</Label>
            <Input
              placeholder="Ime in priimek osebe, ki izvaja kontrolo"
              value={formData.employeeName}
              onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingEntry(null) }}>
            Prekliči
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !formData.title.trim() ||
              !formData.employeeName.trim() ||
              createMutation.isPending ||
              updateMutation.isPending
            }
          >
            {createMutation.isPending || updateMutation.isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                {editingEntry ? 'Posodabljam...' : 'Vnašam...'}
              </>
            ) : editingEntry ? (
              'Posodobi vnos'
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1.5" />
                Dodaj vnos
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // ============================================
  // RENDER: DIJALOG ZA BRISANJE
  // ============================================

  const renderDeleteDialog = () => (
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Izbriši HACCP vnos</AlertDialogTitle>
          <AlertDialogDescription>
            Ali ste prepričani, da želite izbrisati vnos
            <strong> „{deleteTarget?.title}"</strong>?
            Tega dejanja ni mogoče razveljaviti.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Prekliči</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Brišem...' : 'Izbriši'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  // ============================================
  // RENDER: PRAZNO STANJE
  // ============================================

  const renderEmptyState = () => (
    <div className="text-center py-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">Ni HACCP vnosov</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
        {activeTab !== 'all'
          ? `Za kategorijo "${categoryConfig[activeTab]?.label || activeTab}" ni vnosov. Dodajte nov vnos ali spremenite filter.`
          : 'Za izbrano obdobje ni vnosov. Dodajte nov vnos ali spremenite filter.'}
      </p>
      <Button onClick={() => openCreate(activeTab !== 'all' ? activeTab : undefined)}>
        <Plus className="h-4 w-4 mr-2" />
        Dodaj HACCP vnos
      </Button>
    </div>
  )

  // ============================================
  // RENDER: LOADING SKELETON
  // ============================================

  const renderLoadingSkeleton = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={`sum-${i}`} className="h-20" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={`card-${i}`} className="h-44" />
        ))}
      </div>
    </div>
  )

  // ============================================
  // GLAVNI RENDER
  // ============================================

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">HACCP Dnevnik</h2>
            <p className="text-muted-foreground">Nalaganje...</p>
          </div>
        </div>
        {renderLoadingSkeleton()}
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Glava */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            HACCP Dnevnik
          </h2>
          <p className="text-muted-foreground">Vodenje evidenčnih listov živilske varnosti</p>
        </div>
        <Button onClick={() => openCreate()}>
          <Plus className="h-4 w-4 mr-2" />
          Nov vnos
        </Button>
      </div>

      {/* Povzetek */}
      {renderSummaryCards()}

      {/* Opozorila */}
      {renderAlerts()}

      {/* Filtri */}
      {renderFilters()}

      {/* Zavihki po kategorijah */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
          {tabItems.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-1 text-xs">
                <Icon className="h-3.5 w-3.5 hidden sm:block" />
                <span className="truncate">{tab.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {tabItems.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="space-y-4 mt-4">
            {/* Hitre predloge */}
            {renderQuickTemplates()}

            {/* Seznam vnosov */}
            {filteredEntries.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredEntries.map((entry) => renderEntryCard(entry))}
              </div>
            ) : (
              renderEmptyState()
            )}

            {/* Število vnosov */}
            {filteredEntries.length > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                <span>Prikazanih {filteredEntries.length} od {allEntries.length} vnosov</span>
                {(dateFrom || dateTo) && (
                  <span>Filter: {dateFrom && `od ${dateFrom}`} {dateTo && `do ${dateTo}`}</span>
                )}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Dijalog za vnos/urejanje */}
      {renderFormDialog()}

      {/* Dijalog za brisanje */}
      {renderDeleteDialog()}
    </div>
  )
}
