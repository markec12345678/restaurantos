'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Plus, ShieldCheck } from 'lucide-react'
import { useState, useMemo, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { tabItems } from './haccp/constants'
import { formatDateSI, isToday } from './haccp/utils'
import type { HaccpEntry, HaccpFormData } from './haccp/types'

// Lazy-loaded sub-komponente
const HaccpSummaryCards = dynamic(() => import('./haccp/HaccpSummaryCards').then((m) => m.HaccpSummaryCards), { ssr: false })
const HaccpEntryCard = dynamic(() => import('./haccp/HaccpEntryCard').then((m) => m.HaccpEntryCard), { ssr: false })
const HaccpEntryDialog = dynamic(() => import('./haccp/HaccpEntryDialog').then((m) => m.HaccpEntryDialog), { ssr: false })
const HaccpDeleteDialog = dynamic(() => import('./haccp/HaccpDeleteDialog').then((m) => m.HaccpDeleteDialog), { ssr: false })
const HaccpQuickTemplates = dynamic(() => import('./haccp/HaccpQuickTemplates').then((m) => m.HaccpQuickTemplates), { ssr: false })
const HaccpAlerts = dynamic(() => import('./haccp/HaccpAlerts').then((m) => m.HaccpAlerts), { ssr: false })
const HaccpFilters = dynamic(() => import('./haccp/HaccpFilters').then((m) => m.HaccpFilters), { ssr: false })
const HaccpEmptyState = dynamic(() => import('./haccp/HaccpEmptyState').then((m) => m.HaccpEmptyState), { ssr: false })
const HaccpLoadingSkeleton = dynamic(() => import('./haccp/HaccpLoadingSkeleton').then((m) => m.HaccpLoadingSkeleton), { ssr: false })

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

  const hasActiveFilters = !!(dateFrom || dateTo || search || activeTab !== 'all')

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
        <HaccpLoadingSkeleton />
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
      <HaccpAlerts
        allEntries={allEntries}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Filtri */}
      <HaccpFilters
        search={search}
        onSearchChange={setSearch}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        showFilters={showFilters}
        onShowFiltersChange={setShowFilters}
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
      />

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
            <HaccpQuickTemplates
              activeTab={activeTab}
              onCreate={openCreate}
            />

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
              <HaccpEmptyState
                activeTab={activeTab}
                onCreate={openCreate}
              />
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
