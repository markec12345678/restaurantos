'use client'
import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { useState, useCallback, useMemo, memo } from 'react'
import dynamic from 'next/dynamic'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { TABS, type ConfigItem, getDefaultFormData, itemToForm, formToPayload } from './configuration/constants'
import { ConfigCard } from './configuration/ConfigCard'
import { ConfigForm } from './configuration/ConfigForm'
import { ConfigHeader, ConfigSearchBar, ConfigDialog } from './configuration/ConfigSubComponents'

// Lazy loaded custom tabs
const OpeningHoursTab = dynamic(() => import('./configuration/OpeningHoursTab').then(m => ({ default: m.OpeningHoursTab })), { ssr: false })
const HappyHourTab = dynamic(() => import('./configuration/HappyHourTab').then(m => ({ default: m.HappyHourTab })), { ssr: false })

export const ConfigurationManager = memo(function ConfigurationManager() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('tax-rates')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ConfigItem | null>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [deletingItem, setDeletingItem] = useState<ConfigItem | null>(null)
  const currentTabDef = TABS.find(t => t.key === activeTab) || TABS[0]

  // RUNDA 41 FIX: /api/configuration/<tab> nima [id] podpoti (Vercel Hobby 242
  // route-file cap) — mutacije tam gredo prek ?id= query na ISTI route datoteki
  // (POST/PUT/DELETE handlerji runda 41). Ostali apiBase-i (/api/discounts,
  // /api/gift-cards, /api/loyalty) imajo lastne [id] rute — tam ostane pot vzorec.
  const mutationEndpoint = useCallback((id: string) => (
    currentTabDef.apiBase.startsWith('/api/configuration/')
      ? `${currentTabDef.apiBase}?id=${encodeURIComponent(id)}`
      : `${currentTabDef.apiBase}/${id}`
  ), [currentTabDef.apiBase])

  // RUNDA 41 UX: napake API-ja nosijo smiselna sporocila (npr. FK cross-scope) —
  // pokazi jih namesto genericne "Napaka". onerror body: { error: string }
  const apiErrorMessage = async (res: Response, fallback: string): Promise<string> => {
    try {
      const j = await res.json() as { error?: string }
      return j.error || fallback
    } catch { return fallback }
  }

  const { data: items, isLoading } = useQuery<ConfigItem[]>({
    queryKey: queryKeys.configuration.byTab(activeTab),
    queryFn: async () => {
      const res = await authFetch(currentTabDef.apiBase)
      if (!res.ok) return []
      const json = await res.json()
      // FIX Configuration crash: API vrača { taxRates: [...] } / { diningOptions: [...] } format
      // Prej: return res.json() — vrnil objekt, potem items.filter() je crash-al
      if (Array.isArray(json)) return json
      // Poišči prvi array v objektu (taxRates, diningOptions, priceGroups, etc.)
      const arrayVal = Object.values(json).find(v => Array.isArray(v))
      return Array.isArray(arrayVal) ? arrayVal : []
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch(currentTabDef.apiBase, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Napaka pri ustvarjanju')); return res.json()
    },
    onSuccess: () => { toast.success('Uspešno ustvarjeno'); queryClient.invalidateQueries({ queryKey: queryKeys.configuration.byTab(activeTab) }); setDialogOpen(false) },
    onError: (e: Error) => toast.error(e.message || 'Napaka pri ustvarjanju'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(mutationEndpoint(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Napaka pri posodobitvi')); return res.json()
    },
    onSuccess: () => { toast.success('Uspešno posodobljeno'); queryClient.invalidateQueries({ queryKey: queryKeys.configuration.byTab(activeTab) }); setDialogOpen(false); setEditingItem(null) },
    onError: (e: Error) => toast.error(e.message || 'Napaka pri posodobitvi'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(mutationEndpoint(id), { method: 'DELETE' })
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Napaka pri brisanju'))
      return res.json() as Promise<{ success?: boolean; softDeleted?: boolean }>
    },
    onSuccess: (j) => {
      // FK zaščita (runda 41): referenciran zapis se DEAKTIVIRA namesto izbrisa
      toast.success(j.softDeleted ? 'Vnos je referenciran — deaktiviran namesto izbrisan' : 'Uspešno izbrisano')
      queryClient.invalidateQueries({ queryKey: queryKeys.configuration.byTab(activeTab) })
      setDeletingItem(null)
    },
    onError: (e: Error) => toast.error(e.message || 'Napaka pri brisanju'),
  })

  const openCreate = useCallback(() => { setEditingItem(null); setFormData(getDefaultFormData(activeTab)); setDialogOpen(true) }, [activeTab])
  const openEdit = useCallback((item: ConfigItem) => { setEditingItem(item); setFormData(itemToForm(activeTab, item)); setDialogOpen(true) }, [activeTab])
  const handleSubmit = useCallback(() => {
    const payload = formToPayload(activeTab, formData)
    if (editingItem) updateMutation.mutate({ id: (editingItem as { id: string }).id, ...payload })
    else createMutation.mutate(payload)
  }, [activeTab, formData, editingItem, updateMutation, createMutation])

  const filteredItems = useMemo(() => (items || []).filter((item) => {
    const name = (item as { name?: string; customerName?: string; cardNumber?: string }).name
      || (item as { customerName?: string }).customerName
      || (item as { cardNumber?: string }).cardNumber || ''
    return name.toLowerCase().includes(search.toLowerCase())
  }), [items, search])

  const handleTabChange = useCallback((v: string) => { setActiveTab(v); setSearch('') }, [])

  // Ime vnosa v potrditvenem dialogu (različne entitete nosijo različna polja)
  const deletingItemName = useMemo(() => {
    if (!deletingItem) return ''
    const d = deletingItem as { name?: string; customerName?: string; cardNumber?: string }
    return d.name || d.customerName || d.cardNumber || 'brez imena'
  }, [deletingItem])

  return (
    <div className="space-y-6">
      <ConfigHeader onOpenCreate={openCreate} />
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <ScrollArea className="w-full">
          <TabsList className="inline-flex w-max gap-1 bg-muted p-1 rounded-lg">
            {TABS.map(tab => (
              <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5 px-3 py-1.5 text-xs data-[state=active]:bg-background">
                {tab.icon}<span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>
        <ConfigSearchBar search={search} onSearchChange={setSearch} filteredCount={filteredItems.length} />
        <TabsContent value="opening-hours" className="mt-4"><OpeningHoursTab /></TabsContent>
        <TabsContent value="happy-hour" className="mt-4"><HappyHourTab /></TabsContent>
        {TABS.filter(t => t.key !== 'opening-hours' && t.key !== 'happy-hour').map(tab => (
          <TabsContent key={tab.key} value={tab.key} className="mt-4">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                {tab.icon && typeof tab.icon === 'object' && React.isValidElement(tab.icon) && React.cloneElement(tab.icon as React.ReactElement<{ className?: string }>, { className: "h-12 w-12 mx-auto mb-3 opacity-30" })}
                <p className="text-lg font-medium">Ni najdenih zapisov</p>
                <p className="text-sm">Kliknite &quot;Dodaj&quot; za ustvarjanje novega vnosa</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredItems.map(item => (
                  <ConfigCard key={(item as { id: string }).id} tabKey={tab.key} item={item} onEdit={() => openEdit(item)} onDelete={() => setDeletingItem(item)} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
      <ConfigDialog open={dialogOpen} onOpenChange={setDialogOpen} isEditing={!!editingItem} tabLabel={currentTabDef.label} isPending={createMutation.isPending || updateMutation.isPending} onSubmit={handleSubmit}>
        <ConfigForm tabKey={activeTab} formData={formData} setFormData={setFormData} />
      </ConfigDialog>

      {/* RUNDA 41 UX: potrditveni dialog pred brisanjem — prej se je brisalo
          TAKOJ ob kliku (nevarno na fiskalnih konfiguracijah kot DDV) */}
      <AlertDialog open={!!deletingItem} onOpenChange={(v) => { if (!v) setDeletingItem(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Izbriši vnos?</AlertDialogTitle>
            <AlertDialogDescription>
              Vnos <span className="font-semibold text-foreground">{deletingItemName}</span> ({currentTabDef.label}) bo izbrisan.
              Če je že uporabljen v naročilih ali računih, bo samo deaktiviran —
              revizijska sled fiskalizacije ostane nedotaknjena.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Prekliči</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); deleteMutation.mutate((deletingItem as { id: string }).id) }}
            >
              {deleteMutation.isPending ? 'Brišem…' : 'Izbriši'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
})
