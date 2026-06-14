'use client'
import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { Plus, Search, Settings2 } from 'lucide-react'
import { useState, useCallback, useMemo, memo } from 'react'
import dynamic from 'next/dynamic'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { TABS, type ConfigItem, getDefaultFormData, itemToForm, formToPayload } from './configuration/constants'
import { ConfigCard } from './configuration/ConfigCard'
import { ConfigForm } from './configuration/ConfigForm'

// ============================================
// LAZY LOADED CUSTOM TABS
// ============================================
const OpeningHoursTab = dynamic(() => import('./configuration/OpeningHoursTab').then(m => ({ default: m.OpeningHoursTab })), { ssr: false })
const HappyHourTab = dynamic(() => import('./configuration/HappyHourTab').then(m => ({ default: m.HappyHourTab })), { ssr: false })

// ============================================
// MAIN KOMPONENTA
// ============================================
export const ConfigurationManager = memo(function ConfigurationManager() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('tax-rates')
  const [search, setSearch] = useState('')
  // Dijalog stanje
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ConfigItem | null>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const currentTabDef = TABS.find(t => t.key === activeTab) || TABS[0]
  // ============================================
  // QUERIES - naloži podatke za aktivni zavihek
  // ============================================
  const { data: items, isLoading } = useQuery<ConfigItem[]>({
    queryKey: queryKeys.configuration.byTab(activeTab),
    queryFn: async () => {
      const res = await authFetch(currentTabDef.apiBase)
      if (!res.ok) return []
      return res.json()
    },
  })
  // ============================================
  // MUTATIONS
  // ============================================
  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch(currentTabDef.apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka pri ustvarjanju')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Uspešno ustvarjeno')
      queryClient.invalidateQueries({ queryKey: queryKeys.configuration.byTab(activeTab) })
      setDialogOpen(false)
    },
    onError: () => toast.error('Napaka pri ustvarjanju'),
  })
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`${currentTabDef.apiBase}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka pri posodobitvi')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Uspešno posodobljeno')
      queryClient.invalidateQueries({ queryKey: queryKeys.configuration.byTab(activeTab) })
      setDialogOpen(false)
      setEditingItem(null)
    },
    onError: () => toast.error('Napaka pri posodobitvi'),
  })
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`${currentTabDef.apiBase}/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka pri brisanju')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Uspešno izbrisano')
      queryClient.invalidateQueries({ queryKey: queryKeys.configuration.byTab(activeTab) })
    },
    onError: () => toast.error('Napaka pri brisanju'),
  })
  // ============================================
  // HANDLERJI
  // ============================================
  const openCreate = useCallback(() => {
    setEditingItem(null)
    setFormData(getDefaultFormData(activeTab))
    setDialogOpen(true)
  }, [activeTab])
  const openEdit = useCallback((item: ConfigItem) => {
    setEditingItem(item)
    setFormData(itemToForm(activeTab, item))
    setDialogOpen(true)
  }, [activeTab])
  const handleSubmit = useCallback(() => {
    const payload = formToPayload(activeTab, formData)
    if (editingItem) {
      updateMutation.mutate({ id: (editingItem as { id: string }).id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }, [activeTab, formData, editingItem, updateMutation, createMutation])
  const filteredItems = useMemo(() => (items || []).filter((item) => {
    const name = (item as { name?: string; customerName?: string; cardNumber?: string }).name
      || (item as { customerName?: string }).customerName
      || (item as { cardNumber?: string }).cardNumber
      || ''
    return name.toLowerCase().includes(search.toLowerCase())
  }), [items, search])
  const handleTabChange = useCallback((v: string) => {
    setActiveTab(v)
    setSearch('')
  }, [])
  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings2 className="h-6 w-6" />
            Konfiguracija
          </h2>
          <p className="text-muted-foreground">Upravljanje vseh nastavitev restavracije na enem mestu</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj
        </Button>
      </div>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <ScrollArea className="w-full">
          <TabsList className="inline-flex w-max gap-1 bg-muted p-1 rounded-lg">
            {TABS.map(tab => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="gap-1.5 px-3 py-1.5 text-xs data-[state=active]:bg-background"
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>
        {/* Iskanje */}
        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Išči..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="outline" className="text-xs">
            {filteredItems.length} {filteredItems.length === 1 ? 'zapis' : filteredItems.length === 2 ? 'zapisa' : (filteredItems.length < 5 ? 'zapisi' : 'zapisov')}
          </Badge>
        </div>
        {/* Custom zavihek: Delovni čas */}
        <TabsContent value="opening-hours" className="mt-4">
          <OpeningHoursTab />
        </TabsContent>
        {/* Custom zavihek: Happy Hour */}
        <TabsContent value="happy-hour" className="mt-4">
          <HappyHourTab />
        </TabsContent>
        {/* Vsebina zavihkov - generični */}
        {TABS.filter(t => t.key !== 'opening-hours' && t.key !== 'happy-hour').map(tab => (
          <TabsContent key={tab.key} value={tab.key} className="mt-4">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                {tab.icon && typeof tab.icon === 'object' && React.isValidElement(tab.icon) && React.cloneElement(tab.icon as React.ReactElement<{ className?: string }>, { className: "h-12 w-12 mx-auto mb-3 opacity-30" })}
                <p className="text-lg font-medium">Ni najdenih zapisov</p>
                <p className="text-sm">Kliknite &quot;Dodaj&quot; za ustvarjanje novega vnosa</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredItems.map(item => (
                  <ConfigCard
                    key={(item as { id: string }).id}
                    tabKey={tab.key}
                    item={item}
                    onEdit={() => openEdit(item)}
                    onDelete={() => deleteMutation.mutate((item as { id: string }).id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
      {/* DIALOG ZA DODAJANJE/UREJANJE */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? `Uredi: ${currentTabDef.label}` : `Dodaj: ${currentTabDef.label}`}
            </DialogTitle>
          </DialogHeader>
          <ConfigForm tabKey={activeTab} formData={formData} setFormData={setFormData} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Prekliči</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? 'Shranjujem...' : editingItem ? 'Posodobi' : 'Ustvari'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})
