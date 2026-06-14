'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Plus, Search, AlertTriangle, Filter, RotateCcw, ShieldCheck, FileText, Activity } from 'lucide-react'
import { useState, useMemo, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { categoryConfig, statusConfig, statusBadgeStyles, quickTemplates, tabItems } from './haccp/constants'
import { formatDateSI, isToday } from './haccp/utils'
import type { HaccpEntry, HaccpFormData } from './haccp/types'

// Lazy-loaded sub-components
const HaccpSummaryCards = dynamic(() => import('./haccp/HaccpSummaryCards').then((m) => m.HaccpSummaryCards), { ssr: false })
const HaccpEntryCard = dynamic(() => import('./haccp/HaccpEntryCard').then((m) => m.HaccpEntryCard), { ssr: false })
const HaccpEntryDialog = dynamic(() => import('./haccp/HaccpEntryDialog').then((m) => m.HaccpEntryDialog), { ssr: false })
const HaccpDeleteDialog = dynamic(() => import('./haccp/HaccpDeleteDialog').then((m) => m.HaccpDeleteDialog), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const HaccpManager = memo(function HaccpManager() {
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
  const [formData, setFormData] = useState<HaccpFormData>({
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
    queryKey: [...queryKeys.haccp.all, activeTab, dateFrom, dateTo],
    queryFn: async () => {
      const res = await authFetch(`/api/haccp?${queryParams}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })

  // ============================================
  // IZRAČUNI ZA POVZETEK
  // ============================================

  const allEntries = Array.isArray(entries) ? entries : []

  const filteredEntries = useMemo(() => allEntries.filter((entry) =>
    entry.title.toLowerCase().includes(search.toLowerCase()) ||
    entry.description.toLowerCase().includes(search.toLowerCase()) ||
    entry.employeeName.toLowerCase().includes(search.toLowerCase())
  ), [allEntries, search])

  const todayEntries = useMemo(() => allEntries.filter((e) => isToday(e.date)), [allEntries])
  const warningCount = useMemo(() => allEntries.filter((e) => e.status === 'warning').length, [allEntries])
  const criticalCount = useMemo(() => allEntries.filter((e) => e.status === 'critical').length, [allEntries])
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
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      toast.success('HACCP vnos uspešno dodan')
      queryClient.invalidateQueries({ queryKey: queryKeys.haccp.all })
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
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      toast.success('HACCP vnos uspešno posodobljen')
      queryClient.invalidateQueries({ queryKey: queryKeys.haccp.all })
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
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      toast.success('HACCP vnos uspešno izbrisan')
      queryClient.invalidateQueries({ queryKey: queryKeys.haccp.all })
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

  const openCreate = useCallback((presetCategory?: string, presetTitle?: string, presetValue?: string) => {
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
  }, [])

  const openEdit = useCallback((entry: HaccpEntry) => {
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
  }, [])

  const handleSubmit = useCallback(() => {
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
  }, [formData, editingEntry, updateMutation, createMutation])

  const confirmDelete = useCallback((entry: HaccpEntry) => {
    setDeleteTarget(entry)
    setDeleteDialogOpen(true)
  }, [])

  const resetFilters = useCallback(() => {
    setDateFrom('')
    setDateTo('')
    setSearch('')
    setActiveTab('all')
  }, [])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setEditingEntry(null)
    }
    setDialogOpen(open)
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id)
    }
  }, [deleteTarget, deleteMutation])

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
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    const cat = entry.category
                    if (activeTab !== cat) setActiveTab(cat)
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const cat = entry.category; if (activeTab !== cat) setActiveTab(cat) } }}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotColor} mr-1`} aria-hidden="true" />
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
      <HaccpSummaryCards
        todayCount={todayEntries.length}
        warningCount={warningCount}
        criticalCount={criticalCount}
        lastEntryTime={lastEntryTime}
      />

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
                {filteredEntries.map((entry) => (
                  <HaccpEntryCard
                    key={entry.id}
                    entry={entry}
                    isExpanded={expandedEntry === entry.id}
                    onToggle={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                    onEdit={openEdit}
                    onDelete={confirmDelete}
                  />
                ))}
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
      <HaccpEntryDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        editingEntry={editingEntry}
        formData={formData}
        setFormData={setFormData}
        onSave={handleSubmit}
        isCreatePending={createMutation.isPending}
        isUpdatePending={updateMutation.isPending}
      />

      {/* Dijalog za brisanje */}
      <HaccpDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        deleteTarget={deleteTarget}
        onConfirm={handleDeleteConfirm}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
})
