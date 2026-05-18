'use client'

import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Search, Percent, UtensilsCrossed, Building2,
  FolderTree, Tags, Wrench, ChefHat, XCircle, Ban, CreditCard,
  Printer, Gift, Heart, Webhook, Settings2, Clock, Sparkles,
} from 'lucide-react'
import { useState, useCallback } from 'react'

// ============================================
// TIPI ZA KONFIGURACIJSKE MODELE
// ============================================

interface TaxRate { id: string; name: string; rate: number; code: string; isActive: boolean }
interface DiningOption { id: string; name: string; type: string; prepTimeMinutes: number; linkedServiceCharge: string | null }
interface RevenueCenter { id: string; name: string; code: string; isActive: boolean }
interface SalesCategory { id: string; name: string; code: string; isActive: boolean }
interface PriceGroup { id: string; name: string; description: string; isActive: boolean }
interface ServiceCharge { id: string; name: string; type: string; amount: number; isAutoApply: boolean }
interface PrepStation { id: string; name: string; type: string; avgPrepTime: number }
interface VoidReason { id: string; name: string; isActive: boolean }
interface NoSaleReason { id: string; name: string; isActive: boolean }
interface AltPaymentType { id: string; name: string; code: string; type: string }
interface Printer { id: string; name: string; type: string; location: string; ipAddress: string }
interface Discount { id: string; name: string; type: string; amount: number; appliesTo: string; triggerType: string; promoCode: string; validFrom: string; validTo: string; maxUses: number; isActive: boolean }
interface GiftCard { id: string; cardNumber: string; balance: number; initialBalance: number; ownerName: string; expiresAt: string; status: string }
interface LoyaltyAccount { id: string; customerName: string; phone: string; email: string; pointsBalance: number; tier: string }
interface Webhook { id: string; name: string; url: string; events: string; isActive: boolean; secret: string }

type ConfigItem =
  | TaxRate | DiningOption | RevenueCenter | SalesCategory | PriceGroup
  | ServiceCharge | PrepStation | VoidReason | NoSaleReason | AltPaymentType
  | Printer | Discount | GiftCard | LoyaltyAccount | Webhook

// ============================================
// DEFINICIJE ZAVIHKOV
// ============================================

interface TabDef {
  key: string
  label: string
  icon: React.ReactNode
  model: string
  apiBase: string
}

const TABS: TabDef[] = [
  { key: 'tax-rates', label: 'DDV Stopnje', icon: <Percent className="h-4 w-4" />, model: 'tax-rates', apiBase: '/api/configuration/tax-rates' },
  { key: 'dining-options', label: 'Nastavitve jedi', icon: <UtensilsCrossed className="h-4 w-4" />, model: 'dining-options', apiBase: '/api/configuration/dining-options' },
  { key: 'revenue-centers', label: 'Prihodkovni centri', icon: <Building2 className="h-4 w-4" />, model: 'revenue-centers', apiBase: '/api/configuration/revenue-centers' },
  { key: 'sales-categories', label: 'Prodajne kategorije', icon: <FolderTree className="h-4 w-4" />, model: 'sales-categories', apiBase: '/api/configuration/sales-categories' },
  { key: 'price-groups', label: 'Ceniki', icon: <Tags className="h-4 w-4" />, model: 'price-groups', apiBase: '/api/configuration/price-groups' },
  { key: 'service-charges', label: 'Servisne postavke', icon: <Wrench className="h-4 w-4" />, model: 'service-charges', apiBase: '/api/configuration/service-charges' },
  { key: 'prep-stations', label: 'Kuhinjske postaje', icon: <ChefHat className="h-4 w-4" />, model: 'prep-stations', apiBase: '/api/configuration/prep-stations' },
  { key: 'void-reasons', label: 'Razlogi za storno', icon: <XCircle className="h-4 w-4" />, model: 'void-reasons', apiBase: '/api/configuration/void-reasons' },
  { key: 'no-sale-reasons', label: 'Razlogi brez prodaje', icon: <Ban className="h-4 w-4" />, model: 'no-sale-reasons', apiBase: '/api/configuration/no-sale-reasons' },
  { key: 'alt-payment-types', label: 'Alternativna plačila', icon: <CreditCard className="h-4 w-4" />, model: 'alt-payment-types', apiBase: '/api/configuration/alt-payment-types' },
  { key: 'printers', label: 'Tiskalniki', icon: <Printer className="h-4 w-4" />, model: 'printers', apiBase: '/api/configuration/printers' },
  { key: 'discounts', label: 'Popusti', icon: <Gift className="h-4 w-4" />, model: 'discounts', apiBase: '/api/discounts' },
  { key: 'gift-cards', label: 'Darilne kartice', icon: <Gift className="h-4 w-4" />, model: 'gift-cards', apiBase: '/api/gift-cards' },
  { key: 'loyalty', label: 'Zvestoba', icon: <Heart className="h-4 w-4" />, model: 'loyalty', apiBase: '/api/loyalty' },
  { key: 'webhooks', label: 'Webhook-i', icon: <Webhook className="h-4 w-4" />, model: 'webhooks', apiBase: '/api/webhooks' },
  { key: 'opening-hours', label: 'Delovni čas', icon: <Clock className="h-4 w-4" />, model: 'opening-hours', apiBase: '/api/opening-hours' },
  { key: 'happy-hour', label: 'Happy Hour', icon: <Sparkles className="h-4 w-4" />, model: 'happy-hour', apiBase: '/api/happy-hour' },
]

// ============================================
// POMOŽNE FUNKCIJE
// ============================================

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ============================================
// MAIN KOMPONENTA
// ============================================

export function ConfigurationManager() {
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
    queryKey: ['configuration', activeTab],
    queryFn: async () => {
      const res = await fetch(currentTabDef.apiBase)
      if (!res.ok) return []
      return res.json()
    },
  })

  // ============================================
  // MUTATIONS
  // ============================================

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(currentTabDef.apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka pri ustvarjanju')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Uspešno ustvarjeno')
      queryClient.invalidateQueries({ queryKey: ['configuration', activeTab] })
      setDialogOpen(false)
    },
    onError: () => toast.error('Napaka pri ustvarjanju'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`${currentTabDef.apiBase}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka pri posodobitvi')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Uspešno posodobljeno')
      queryClient.invalidateQueries({ queryKey: ['configuration', activeTab] })
      setDialogOpen(false)
      setEditingItem(null)
    },
    onError: () => toast.error('Napaka pri posodobitvi'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${currentTabDef.apiBase}/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka pri brisanju')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Uspešno izbrisano')
      queryClient.invalidateQueries({ queryKey: ['configuration', activeTab] })
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

  const handleSubmit = () => {
    const payload = formToPayload(activeTab, formData)
    if (editingItem) {
      updateMutation.mutate({ id: (editingItem as { id: string }).id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const filteredItems = (items || []).filter((item) => {
    const name = (item as { name?: string; customerName?: string; cardNumber?: string }).name
      || (item as { customerName?: string }).customerName
      || (item as { cardNumber?: string }).cardNumber
      || ''
    return name.toLowerCase().includes(search.toLowerCase())
  })

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

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearch('') }}>
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
                {tab.icon && typeof tab.icon === 'object' && React.isValidElement(tab.icon) && React.cloneElement(tab.icon as React.ReactElement<any>, { className: "h-12 w-12 mx-auto mb-3 opacity-30" })}
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
}

// ============================================
// KARTICA KONFIGURACIJSKEGA VNOSA
// ============================================

function ConfigCard({
  tabKey,
  item,
  onEdit,
  onDelete,
}: {
  tabKey: string
  item: ConfigItem
  onEdit: () => void
  onDelete: () => void
}) {
  const id = (item as { id: string }).id

  const renderContent = () => {
    switch (tabKey) {
      case 'tax-rates': {
        const d = item as TaxRate
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default" className="text-xs">{d.rate}%</Badge>
              <span className="text-xs text-muted-foreground">{d.code}</span>
            </div>
            <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-[10px] mt-1.5">
              {d.isActive ? 'Aktivna' : 'Neaktivna'}
            </Badge>
          </>
        )
      }
      case 'dining-options': {
        const d = item as DiningOption
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">{d.type}</Badge>
              <span className="text-xs text-muted-foreground">{d.prepTimeMinutes} min</span>
            </div>
            {d.linkedServiceCharge && (
              <span className="text-xs text-muted-foreground">Strošek: {d.linkedServiceCharge}</span>
            )}
          </>
        )
      }
      case 'revenue-centers': {
        const d = item as RevenueCenter
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <Badge variant="outline" className="text-xs mt-1">{d.code}</Badge>
            <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-[10px] mt-1.5">
              {d.isActive ? 'Aktiven' : 'Neaktiven'}
            </Badge>
          </>
        )
      }
      case 'sales-categories': {
        const d = item as SalesCategory
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <Badge variant="outline" className="text-xs mt-1">{d.code}</Badge>
            <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-[10px] mt-1.5">
              {d.isActive ? 'Aktivna' : 'Neaktivna'}
            </Badge>
          </>
        )
      }
      case 'price-groups': {
        const d = item as PriceGroup
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            {d.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{d.description}</p>}
            <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-[10px] mt-1.5">
              {d.isActive ? 'Aktiven' : 'Neaktiven'}
            </Badge>
          </>
        )
      }
      case 'service-charges': {
        const d = item as ServiceCharge
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default" className="text-xs">
                {d.type === 'percentage' ? `${d.amount}%` : `€${d.amount.toFixed(2)}`}
              </Badge>
              <Badge variant="outline" className="text-xs">{d.type === 'percentage' ? 'Odstotek' : 'Fiksno'}</Badge>
            </div>
            {d.isAutoApply && (
              <Badge variant="secondary" className="text-[10px] mt-1.5">Samodejno</Badge>
            )}
          </>
        )
      }
      case 'prep-stations': {
        const d = item as PrepStation
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">{d.type}</Badge>
              <span className="text-xs text-muted-foreground">~{d.avgPrepTime} min</span>
            </div>
          </>
        )
      }
      case 'void-reasons': {
        const d = item as VoidReason
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-[10px] mt-1.5">
              {d.isActive ? 'Aktiven' : 'Neaktiven'}
            </Badge>
          </>
        )
      }
      case 'no-sale-reasons': {
        const d = item as NoSaleReason
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-[10px] mt-1.5">
              {d.isActive ? 'Aktiven' : 'Neaktiven'}
            </Badge>
          </>
        )
      }
      case 'alt-payment-types': {
        const d = item as AltPaymentType
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">{d.code}</Badge>
              <Badge variant="secondary" className="text-xs">{d.type}</Badge>
            </div>
          </>
        )
      }
      case 'printers': {
        const d = item as Printer
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <Badge variant="outline" className="text-xs">{d.type}</Badge>
              {d.location && <Badge variant="secondary" className="text-xs">{d.location}</Badge>}
            </div>
            <span className="text-xs text-muted-foreground mt-1 block">{d.ipAddress}</span>
          </>
        )
      }
      case 'discounts': {
        const d = item as Discount
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <Badge variant="default" className="text-xs">
                {d.type === 'percentage' ? `${d.amount}%` : `€${d.amount.toFixed(2)}`}
              </Badge>
              <Badge variant="outline" className="text-xs">{d.triggerType}</Badge>
            </div>
            {d.promoCode && <span className="text-xs text-muted-foreground">Koda: {d.promoCode}</span>}
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-[10px]">
                {d.isActive ? 'Aktiven' : 'Neaktiven'}
              </Badge>
              {d.maxUses > 0 && <span className="text-[10px] text-muted-foreground">Max: {d.maxUses}x</span>}
            </div>
          </>
        )
      }
      case 'gift-cards': {
        const d = item as GiftCard
        return (
          <>
            <p className="font-medium text-sm truncate font-mono">{d.cardNumber}</p>
            <p className="text-xs text-muted-foreground truncate">{d.ownerName || 'Brez lastnika'}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default" className="text-xs">€{d.balance.toFixed(2)}</Badge>
              <Badge variant="outline" className="text-xs">Začetno: €{d.initialBalance.toFixed(2)}</Badge>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant={d.status === 'active' ? 'default' : d.status === 'expired' ? 'destructive' : 'secondary'} className="text-[10px]">
                {d.status === 'active' ? 'Aktivna' : d.status === 'expired' ? 'Potekla' : d.status === 'used' ? 'Porabljena' : d.status}
              </Badge>
              {d.expiresAt && <span className="text-[10px] text-muted-foreground">do {formatDate(d.expiresAt)}</span>}
            </div>
          </>
        )
      }
      case 'loyalty': {
        const d = item as LoyaltyAccount
        return (
          <>
            <p className="font-medium text-sm truncate">{d.customerName}</p>
            <p className="text-xs text-muted-foreground truncate">{d.phone || d.email || ''}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default" className="text-xs">{d.pointsBalance} točk</Badge>
              <Badge variant="outline" className="text-xs">{d.tier}</Badge>
            </div>
          </>
        )
      }
      case 'webhooks': {
        const d = item as Webhook
        return (
          <>
            <p className="font-medium text-sm truncate">{d.name}</p>
            <p className="text-xs text-muted-foreground truncate max-w-full">{d.url}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-[10px]">
                {d.isActive ? 'Aktiven' : 'Neaktiven'}
              </Badge>
              {d.events && (
                <Badge variant="outline" className="text-[10px]">
                  {Array.isArray(d.events) ? d.events.length : (d.events.split(',').length)} dogodkov
                </Badge>
              )}
            </div>
          </>
        )
      }
      default:
        return <p className="text-sm text-muted-foreground">Nepoznan tip</p>
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {renderContent()}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Uredi" onClick={onEdit}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Izbriši" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// OBRAZEC ZA UREJANJE
// ============================================

function ConfigForm({
  tabKey,
  formData,
  setFormData,
}: {
  tabKey: string
  formData: Record<string, unknown>
  setFormData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
}) {
  const update = (key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  switch (tabKey) {
    case 'tax-rates':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. DDV 22%" />
          </div>
          <div>
            <Label>Stopnja (%)</Label>
            <Input type="number" step="0.01" value={String(formData.rate ?? '')} onChange={e => update('rate', e.target.value)} placeholder="22" />
          </div>
          <div>
            <Label>Koda</Label>
            <Input value={String(formData.code || '')} onChange={e => update('code', e.target.value)} placeholder="npr. S" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
            <Label>Aktivna</Label>
          </div>
        </div>
      )

    case 'dining-options':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Hrana na licu mesta" />
          </div>
          <div>
            <Label>Vrsta</Label>
            <Select value={String(formData.type || 'dine-in')} onValueChange={v => update('type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dine-in">Na licu mesta</SelectItem>
                <SelectItem value="takeout">Za s seboj</SelectItem>
                <SelectItem value="delivery">Dostava</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Pripravljalni čas (min)</Label>
            <Input type="number" value={String(formData.prepTimeMinutes ?? '')} onChange={e => update('prepTimeMinutes', e.target.value)} placeholder="15" />
          </div>
          <div>
            <Label>Povezani servisni strošek</Label>
            <Input value={String(formData.linkedServiceCharge || '')} onChange={e => update('linkedServiceCharge', e.target.value)} placeholder="Opcijsko" />
          </div>
        </div>
      )

    case 'revenue-centers':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Glavni bar" />
          </div>
          <div>
            <Label>Koda</Label>
            <Input value={String(formData.code || '')} onChange={e => update('code', e.target.value)} placeholder="npr. BAR-01" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
            <Label>Aktiven</Label>
          </div>
        </div>
      )

    case 'sales-categories':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Hrana" />
          </div>
          <div>
            <Label>Koda</Label>
            <Input value={String(formData.code || '')} onChange={e => update('code', e.target.value)} placeholder="npr. FOOD" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
            <Label>Aktivna</Label>
          </div>
        </div>
      )

    case 'price-groups':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Redna cena" />
          </div>
          <div>
            <Label>Opis</Label>
            <Textarea value={String(formData.description || '')} onChange={e => update('description', e.target.value)} placeholder="Opis cenika..." />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
            <Label>Aktiven</Label>
          </div>
        </div>
      )

    case 'service-charges':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Pribitki za postrežbo" />
          </div>
          <div>
            <Label>Vrsta</Label>
            <Select value={String(formData.type || 'percentage')} onValueChange={v => update('type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Odstotek</SelectItem>
                <SelectItem value="fixed">Fiksni znesek</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Znesek {formData.type === 'percentage' ? '(%)' : '(€)'}</Label>
            <Input type="number" step="0.01" value={String(formData.amount ?? '')} onChange={e => update('amount', e.target.value)} placeholder="10" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(formData.isAutoApply)} onCheckedChange={c => update('isAutoApply', c)} />
            <Label>Samodejno dodaj</Label>
          </div>
        </div>
      )

    case 'prep-stations':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Vroča kuhinja" />
          </div>
          <div>
            <Label>Vrsta</Label>
            <Select value={String(formData.type || 'kitchen')} onValueChange={v => update('type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kitchen">Kuhinja</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="grill">Žar</SelectItem>
                <SelectItem value="pastry">Slaščičarna</SelectItem>
                <SelectItem value="cold">Hladna kuhinja</SelectItem>
                <SelectItem value="other">Drugo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Povprečni čas priprave (min)</Label>
            <Input type="number" value={String(formData.avgPrepTime ?? '')} onChange={e => update('avgPrepTime', e.target.value)} placeholder="12" />
          </div>
        </div>
      )

    case 'void-reasons':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Naročilo po pomoti" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
            <Label>Aktiven</Label>
          </div>
        </div>
      )

    case 'no-sale-reasons':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Odprt fižek" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
            <Label>Aktiven</Label>
          </div>
        </div>
      )

    case 'alt-payment-types':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Boni" />
          </div>
          <div>
            <Label>Koda</Label>
            <Input value={String(formData.code || '')} onChange={e => update('code', e.target.value)} placeholder="npr. VOUCHER" />
          </div>
          <div>
            <Label>Vrsta</Label>
            <Select value={String(formData.type || 'voucher')} onValueChange={v => update('type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="voucher">Vavčer</SelectItem>
                <SelectItem value="coupon">Kupon</SelectItem>
                <SelectItem value="crypto">Kriptovaluta</SelectItem>
                <SelectItem value="mobile">Mobilno plačilo</SelectItem>
                <SelectItem value="other">Drugo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )

    case 'printers':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Kuhinjski tiskalnik" />
          </div>
          <div>
            <Label>Vrsta</Label>
            <Select value={String(formData.type || 'thermal')} onValueChange={v => update('type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="thermal">Termični</SelectItem>
                <SelectItem value="impact">Iglični</SelectItem>
                <SelectItem value="label">Etiketni</SelectItem>
                <SelectItem value="receipt">Blagajniški</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Lokacija</Label>
            <Input value={String(formData.location || '')} onChange={e => update('location', e.target.value)} placeholder="npr. Kuhinja" />
          </div>
          <div>
            <Label>IP naslov</Label>
            <Input value={String(formData.ipAddress || '')} onChange={e => update('ipAddress', e.target.value)} placeholder="192.168.1.100" />
          </div>
        </div>
      )

    case 'discounts':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Zgodnja ptica" />
          </div>
          <div>
            <Label>Vrsta popusta</Label>
            <Select value={String(formData.type || 'percentage')} onValueChange={v => update('type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Odstotek</SelectItem>
                <SelectItem value="fixed">Fiksni znesek</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Znesek {formData.type === 'percentage' ? '(%)' : '(€)'}</Label>
            <Input type="number" step="0.01" value={String(formData.amount ?? '')} onChange={e => update('amount', e.target.value)} placeholder="10" />
          </div>
          <div>
            <Label>Velja za</Label>
            <Select value={String(formData.appliesTo || 'all')} onValueChange={v => update('appliesTo', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Vse</SelectItem>
                <SelectItem value="items">Artikli</SelectItem>
                <SelectItem value="categories">Kategorije</SelectItem>
                <SelectItem value="order">Celotno naročilo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sprožilec</Label>
            <Select value={String(formData.triggerType || 'manual')} onValueChange={v => update('triggerType', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Ročno</SelectItem>
                <SelectItem value="auto">Samodejno</SelectItem>
                <SelectItem value="promo-code">Promocijska koda</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Promocijska koda</Label>
            <Input value={String(formData.promoCode || '')} onChange={e => update('promoCode', e.target.value)} placeholder="Opcijsko" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Veljavno od</Label>
              <Input type="date" value={String(formData.validFrom || '')} onChange={e => update('validFrom', e.target.value)} />
            </div>
            <div>
              <Label>Veljavno do</Label>
              <Input type="date" value={String(formData.validTo || '')} onChange={e => update('validTo', e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Največ uporab</Label>
            <Input type="number" value={String(formData.maxUses ?? '0')} onChange={e => update('maxUses', e.target.value)} placeholder="0 = neomejeno" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
            <Label>Aktiven</Label>
          </div>
        </div>
      )

    case 'gift-cards':
      return (
        <div className="space-y-3">
          <div>
            <Label>Številka kartice</Label>
            <Input value={String(formData.cardNumber || '')} onChange={e => update('cardNumber', e.target.value)} placeholder="GC-000001" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Stanje (€)</Label>
              <Input type="number" step="0.01" value={String(formData.balance ?? '')} onChange={e => update('balance', e.target.value)} />
            </div>
            <div>
              <Label>Začetno stanje (€)</Label>
              <Input type="number" step="0.01" value={String(formData.initialBalance ?? '')} onChange={e => update('initialBalance', e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Ime lastnika</Label>
            <Input value={String(formData.ownerName || '')} onChange={e => update('ownerName', e.target.value)} placeholder="Ime Priimek" />
          </div>
          <div>
            <Label>Datum poteka</Label>
            <Input type="date" value={String(formData.expiresAt || '')} onChange={e => update('expiresAt', e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={String(formData.status || 'active')} onValueChange={v => update('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktivna</SelectItem>
                <SelectItem value="expired">Potekla</SelectItem>
                <SelectItem value="used">Porabljena</SelectItem>
                <SelectItem value="disabled">Onemogočena</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )

    case 'loyalty':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime stranke</Label>
            <Input value={String(formData.customerName || '')} onChange={e => update('customerName', e.target.value)} placeholder="Ime Priimek" />
          </div>
          <div>
            <Label>Telefon</Label>
            <Input value={String(formData.phone || '')} onChange={e => update('phone', e.target.value)} placeholder="+386..." />
          </div>
          <div>
            <Label>E-pošta</Label>
            <Input type="email" value={String(formData.email || '')} onChange={e => update('email', e.target.value)} placeholder="ime@primer.si" />
          </div>
          <div>
            <Label>Stanje točk</Label>
            <Input type="number" value={String(formData.pointsBalance ?? '0')} onChange={e => update('pointsBalance', e.target.value)} />
          </div>
          <div>
            <Label>Raven</Label>
            <Select value={String(formData.tier || 'bronze')} onValueChange={v => update('tier', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bronze">Bronasta</SelectItem>
                <SelectItem value="silver">Srebrna</SelectItem>
                <SelectItem value="gold">Zlata</SelectItem>
                <SelectItem value="platinum">Platinasta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )

    case 'webhooks':
      return (
        <div className="space-y-3">
          <div>
            <Label>Ime</Label>
            <Input value={String(formData.name || '')} onChange={e => update('name', e.target.value)} placeholder="npr. Slack obvestila" />
          </div>
          <div>
            <Label>URL</Label>
            <Input value={String(formData.url || '')} onChange={e => update('url', e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label>Dogodki (ločeni z vejico)</Label>
            <Textarea
              value={String(formData.events || '')}
              onChange={e => update('events', e.target.value)}
              placeholder="order.created,order.paid,order.cancelled"
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Na voljo: order.created, order.paid, order.cancelled, order.refunded, inventory.low, shift.opened, shift.closed
            </p>
          </div>
          <div>
            <Label>Skrivnost</Label>
            <Input value={String(formData.secret || '')} onChange={e => update('secret', e.target.value)} placeholder="Podpisovalni ključ" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(formData.isActive)} onCheckedChange={c => update('isActive', c)} />
            <Label>Aktiven</Label>
          </div>
        </div>
      )

    default:
      return <p className="text-muted-foreground">Neznana konfiguracija</p>
  }
}

// ============================================
// POMOŽNE FUNKCIJE ZA OBRAZCE
// ============================================

function getDefaultFormData(tabKey: string): Record<string, unknown> {
  switch (tabKey) {
    case 'tax-rates':
      return { name: '', rate: '', code: '', isActive: true }
    case 'dining-options':
      return { name: '', type: 'dine-in', prepTimeMinutes: '', linkedServiceCharge: '' }
    case 'revenue-centers':
      return { name: '', code: '', isActive: true }
    case 'sales-categories':
      return { name: '', code: '', isActive: true }
    case 'price-groups':
      return { name: '', description: '', isActive: true }
    case 'service-charges':
      return { name: '', type: 'percentage', amount: '', isAutoApply: false }
    case 'prep-stations':
      return { name: '', type: 'kitchen', avgPrepTime: '' }
    case 'void-reasons':
      return { name: '', isActive: true }
    case 'no-sale-reasons':
      return { name: '', isActive: true }
    case 'alt-payment-types':
      return { name: '', code: '', type: 'voucher' }
    case 'printers':
      return { name: '', type: 'thermal', location: '', ipAddress: '' }
    case 'discounts':
      return { name: '', type: 'percentage', amount: '', appliesTo: 'all', triggerType: 'manual', promoCode: '', validFrom: '', validTo: '', maxUses: '0', isActive: true }
    case 'gift-cards':
      return { cardNumber: '', balance: '', initialBalance: '', ownerName: '', expiresAt: '', status: 'active' }
    case 'loyalty':
      return { customerName: '', phone: '', email: '', pointsBalance: '0', tier: 'bronze' }
    case 'webhooks':
      return { name: '', url: '', events: '', isActive: true, secret: '' }
    default:
      return {}
  }
}

function itemToForm(tabKey: string, item: ConfigItem): Record<string, unknown> {
  switch (tabKey) {
    case 'tax-rates': {
      const d = item as TaxRate
      return { name: d.name, rate: String(d.rate), code: d.code, isActive: d.isActive }
    }
    case 'dining-options': {
      const d = item as DiningOption
      return { name: d.name, type: d.type, prepTimeMinutes: String(d.prepTimeMinutes), linkedServiceCharge: d.linkedServiceCharge || '' }
    }
    case 'revenue-centers': {
      const d = item as RevenueCenter
      return { name: d.name, code: d.code, isActive: d.isActive }
    }
    case 'sales-categories': {
      const d = item as SalesCategory
      return { name: d.name, code: d.code, isActive: d.isActive }
    }
    case 'price-groups': {
      const d = item as PriceGroup
      return { name: d.name, description: d.description || '', isActive: d.isActive }
    }
    case 'service-charges': {
      const d = item as ServiceCharge
      return { name: d.name, type: d.type, amount: String(d.amount), isAutoApply: d.isAutoApply }
    }
    case 'prep-stations': {
      const d = item as PrepStation
      return { name: d.name, type: d.type, avgPrepTime: String(d.avgPrepTime) }
    }
    case 'void-reasons': {
      const d = item as VoidReason
      return { name: d.name, isActive: d.isActive }
    }
    case 'no-sale-reasons': {
      const d = item as NoSaleReason
      return { name: d.name, isActive: d.isActive }
    }
    case 'alt-payment-types': {
      const d = item as AltPaymentType
      return { name: d.name, code: d.code, type: d.type }
    }
    case 'printers': {
      const d = item as Printer
      return { name: d.name, type: d.type, location: d.location || '', ipAddress: d.ipAddress || '' }
    }
    case 'discounts': {
      const d = item as Discount
      return {
        name: d.name, type: d.type, amount: String(d.amount), appliesTo: d.appliesTo || 'all',
        triggerType: d.triggerType || 'manual', promoCode: d.promoCode || '',
        validFrom: d.validFrom ? new Date(d.validFrom).toISOString().split('T')[0] : '',
        validTo: d.validTo ? new Date(d.validTo).toISOString().split('T')[0] : '',
        maxUses: String(d.maxUses || 0), isActive: d.isActive,
      }
    }
    case 'gift-cards': {
      const d = item as GiftCard
      return {
        cardNumber: d.cardNumber, balance: String(d.balance), initialBalance: String(d.initialBalance),
        ownerName: d.ownerName || '',
        expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString().split('T')[0] : '',
        status: d.status || 'active',
      }
    }
    case 'loyalty': {
      const d = item as LoyaltyAccount
      return { customerName: d.customerName, phone: d.phone || '', email: d.email || '', pointsBalance: String(d.pointsBalance), tier: d.tier }
    }
    case 'webhooks': {
      const d = item as Webhook
      return {
        name: d.name, url: d.url, events: Array.isArray(d.events) ? d.events.join(', ') : String(d.events || ''),
        isActive: d.isActive, secret: d.secret || '',
      }
    }
    default:
      return {}
  }
}

function formToPayload(tabKey: string, formData: Record<string, unknown>): Record<string, unknown> {
  const base = { ...formData }

  // Pretvori številske vrednosti
  switch (tabKey) {
    case 'tax-rates':
      base.rate = parseFloat(String(base.rate)) || 0
      break
    case 'dining-options':
      base.prepTimeMinutes = parseInt(String(base.prepTimeMinutes)) || 0
      base.linkedServiceCharge = base.linkedServiceCharge || null
      break
    case 'service-charges':
      base.amount = parseFloat(String(base.amount)) || 0
      break
    case 'prep-stations':
      base.avgPrepTime = parseInt(String(base.avgPrepTime)) || 0
      break
    case 'discounts':
      base.amount = parseFloat(String(base.amount)) || 0
      base.maxUses = parseInt(String(base.maxUses)) || 0
      base.validFrom = base.validFrom || null
      base.validTo = base.validTo || null
      base.promoCode = base.promoCode || null
      break
    case 'gift-cards':
      base.balance = parseFloat(String(base.balance)) || 0
      base.initialBalance = parseFloat(String(base.initialBalance)) || 0
      base.expiresAt = base.expiresAt || null
      base.ownerName = base.ownerName || null
      break
    case 'loyalty':
      base.pointsBalance = parseInt(String(base.pointsBalance)) || 0
      base.phone = base.phone || null
      base.email = base.email || null
      break
    case 'webhooks':
      base.events = base.events || ''
      base.secret = base.secret || null
      break
  }

  return base
}

// ============================================
// CUSTOM TAB: DELOVNI ČAS (OpeningHours)
// Urejanje urnika za vse dni v tednu
// ============================================

const DAY_NAMES = ['Nedelja', 'Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota']
const DAY_SHORT = ['Ned', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob']

interface OpeningHour {
  id?: string
  dayOfWeek: number
  openTime: string
  closeTime: string
  breakStart: string
  breakEnd: string
  isClosed: boolean
}

function OpeningHoursTab() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery<{ hours: OpeningHour[] }>({
    queryKey: ['opening-hours'],
    queryFn: async () => {
      const res = await fetch('/api/opening-hours')
      if (!res.ok) return { hours: [] }
      return res.json()
    },
  })

  const [editHours, setEditHours] = useState<OpeningHour[]>([])
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const hours = data?.hours || []

  const startEdit = () => {
    // Pripravi 7 dni, zapolni manjkajoče s privzetki
    const existing = new Map(hours.map(h => [h.dayOfWeek, h]))
    const all7: OpeningHour[] = Array.from({ length: 7 }, (_, i) => {
      const ex = existing.get(i)
      return ex || { dayOfWeek: i, openTime: '08:00', closeTime: '22:00', breakStart: '', breakEnd: '', isClosed: i === 0 }
    })
    setEditHours(all7)
    setEditing(true)
  }

  const updateDay = (idx: number, field: keyof OpeningHour, value: string | boolean) => {
    setEditHours(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      return updated
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/opening-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: editHours.map(({ id, ...rest }) => rest) }),
      })
      if (!res.ok) throw new Error('Napaka')
      toast.success('Delovni čas shranjen')
      queryClient.invalidateQueries({ queryKey: ['opening-hours'] })
      setEditing(false)
    } catch {
      toast.error('Napaka pri shranjevanju')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <div className="space-y-3">{[...Array(7)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>

  // Prikaz trenutnega urnika
  const now = new Date()
  const todayIdx = now.getDay()
  const todayHours = hours.find(h => h.dayOfWeek === todayIdx)
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const isOpenNow = todayHours && !todayHours.isClosed && currentTime >= todayHours.openTime && currentTime <= todayHours.closeTime

  return (
    <div className="space-y-4">
      {/* Status indikator */}
      <div className={`flex items-center gap-3 p-4 rounded-xl ${isOpenNow ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <div className={`w-3 h-3 rounded-full ${isOpenNow ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className={`font-semibold ${isOpenNow ? 'text-green-700' : 'text-red-700'}`}>
          {isOpenNow ? 'Trenutno odprto' : 'Trenutno zaprto'}
        </span>
        {todayHours && !todayHours.isClosed && (
          <span className="text-sm text-muted-foreground">
            ({todayHours.openTime} - {todayHours.closeTime})
          </span>
        )}
      </div>

      {!editing ? (
        <>
          {/* Tabelarični pregled */}
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left p-3 font-medium">Dan</th>
                  <th className="text-center p-3 font-medium">Odprtje</th>
                  <th className="text-center p-3 font-medium">Zaprtje</th>
                  <th className="text-center p-3 font-medium">Odmor</th>
                  <th className="text-center p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 7 }, (_, i) => {
                  const h = hours.find(x => x.dayOfWeek === i)
                  const isToday = i === todayIdx
                  return (
                    <tr key={i} className={`border-b last:border-0 ${isToday ? 'bg-blue-50/50' : ''}`}>
                      <td className={`p-3 font-medium ${isToday ? 'text-blue-700' : ''}`}>
                        {DAY_NAMES[i]} {isToday && <Badge className="ml-1 text-[10px] bg-blue-600">Danes</Badge>}
                      </td>
                      <td className="p-3 text-center">{h?.isClosed ? '—' : h?.openTime || '—'}</td>
                      <td className="p-3 text-center">{h?.isClosed ? '—' : h?.closeTime || '—'}</td>
                      <td className="p-3 text-center text-xs text-muted-foreground">
                        {h?.breakStart && h?.breakEnd ? `${h.breakStart} - ${h.breakEnd}` : '—'}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={h?.isClosed ? 'destructive' : 'default'} className={h?.isClosed ? '' : 'bg-green-600'}>
                          {h?.isClosed ? 'Zaprto' : 'Odprto'}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Button onClick={startEdit} className="gap-2">
            <Pencil className="h-4 w-4" /> Uredi delovni čas
          </Button>
        </>
      ) : (
        <>
          <div className="space-y-3">
            {editHours.map((h, idx) => (
              <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl border ${h.isClosed ? 'bg-gray-50/50 opacity-70' : 'bg-background'}`}>
                <span className="w-12 font-semibold text-sm">{DAY_SHORT[idx]}</span>
                <Switch checked={!h.isClosed} onCheckedChange={v => updateDay(idx, 'isClosed', !v)} />
                {!h.isClosed ? (
                  <>
                    <Input type="time" value={h.openTime} onChange={e => updateDay(idx, 'openTime', e.target.value)} className="w-32" />
                    <span className="text-muted-foreground">—</span>
                    <Input type="time" value={h.closeTime} onChange={e => updateDay(idx, 'closeTime', e.target.value)} className="w-32" />
                    <div className="flex items-center gap-1 ml-2">
                      <span className="text-xs text-muted-foreground">Odmor:</span>
                      <Input type="time" value={h.breakStart} onChange={e => updateDay(idx, 'breakStart', e.target.value)} className="w-28" placeholder="Od" />
                      <Input type="time" value={h.breakEnd} onChange={e => updateDay(idx, 'breakEnd', e.target.value)} className="w-28" placeholder="Do" />
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-red-500 font-medium">Zaprto</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} className="flex-1">
              {saving ? 'Shranjujem...' : 'Shrani delovni čas'}
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)}>Prekliči</Button>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================
// CUSTOM TAB: HAPPY HOUR
// Upravljanje urnikov Happy Hour s ceniki
// ============================================

interface HappyHourSchedule {
  id: string
  name: string
  description: string
  priceGroupId: string
  priceGroup?: { id: string; name: string }
  discountType: string
  discountAmount: number
  daysOfWeek: string
  startTime: string
  endTime: string
  validFrom: string | null
  validTo: string | null
  isActive: boolean
  autoActivate: boolean
}

function HappyHourTab() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['happy-hour-config'],
    queryFn: async () => {
      const res = await fetch('/api/happy-hour')
      if (!res.ok) return { schedules: [], activeSchedules: [], currentlyActive: false }
      return res.json()
    },
  })

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', priceGroupId: '', discountType: 'percentage', discountAmount: 0,
    daysOfWeek: [1, 2, 3, 4, 5] as number[], startTime: '14:00', endTime: '17:00',
    validFrom: '', validTo: '', isActive: true, autoActivate: true,
  })
  const [saving, setSaving] = useState(false)

  const schedules: HappyHourSchedule[] = data?.schedules || []
  const currentlyActive = data?.currentlyActive || false

  const { data: priceGroups } = useQuery({
    queryKey: ['price-groups-hh'],
    queryFn: async () => {
      const res = await fetch('/api/configuration/price-groups')
      if (!res.ok) return []
      return res.json()
    },
  })

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/happy-hour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Napaka')
      }
      toast.success('Happy Hour urnik ustvarjen')
      queryClient.invalidateQueries({ queryKey: ['happy-hour-config'] })
      setShowForm(false)
      setForm({ name: '', description: '', priceGroupId: '', discountType: 'percentage', discountAmount: 0, daysOfWeek: [1, 2, 3, 4, 5], startTime: '14:00', endTime: '17:00', validFrom: '', validTo: '', isActive: true, autoActivate: true })
    } catch (e: any) {
      toast.error(e.message || 'Napaka pri shranjevanju')
    } finally {
      setSaving(false)
    }
  }

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day) ? prev.daysOfWeek.filter(d => d !== day) : [...prev.daysOfWeek, day].sort(),
    }))
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/happy-hour/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka')
    },
    onSuccess: () => {
      toast.success('Izbrisano')
      queryClient.invalidateQueries({ queryKey: ['happy-hour-config'] })
    },
    onError: () => toast.error('Napaka pri brisanju'),
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/happy-hour/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      if (!res.ok) throw new Error('Napaka')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['happy-hour-config'] }),
  })

  if (isLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>

  const dayLabels = ['', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned']

  return (
    <div className="space-y-4">
      {/* Trenutno aktivni banner */}
      <div className={`flex items-center gap-3 p-4 rounded-xl ${currentlyActive ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-200'}`}>
        <Sparkles className={`h-5 w-5 ${currentlyActive ? 'text-amber-500' : 'text-gray-400'}`} />
        <span className={`font-semibold ${currentlyActive ? 'text-amber-700' : 'text-gray-500'}`}>
          {currentlyActive ? 'Happy Hour je trenutno AKTIVEN!' : 'Happy Hour trenutno ni aktiven'}
        </span>
      </div>

      {/* Seznam urnikov */}
      {schedules.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-30" />
          <p className="text-lg font-medium text-muted-foreground">Ni še definiranih Happy Hour urnikov</p>
          <p className="text-sm text-muted-foreground">Ustvarite prvi urnik za samodejne popuste</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map(s => (
            <Card key={s.id} className={`${!s.isActive ? 'opacity-60' : ''} ${currentlyActive && s.isActive ? 'border-amber-300 shadow-amber-100' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{s.name}</h3>
                      <Badge variant={s.isActive ? 'default' : 'secondary'} className={s.isActive ? 'bg-green-600' : ''}>
                        {s.isActive ? 'Aktiven' : 'Neaktiven'}
                      </Badge>
                    </div>
                    {s.description && <p className="text-sm text-muted-foreground mt-0.5">{s.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-sm">
                      <Badge variant="outline">{s.startTime} - {s.endTime}</Badge>
                      {s.discountType !== 'none' && (
                        <Badge variant="default">
                          {s.discountType === 'percentage' ? `-${s.discountAmount}%` : `-€${s.discountAmount.toFixed(2)}`}
                        </Badge>
                      )}
                      {s.priceGroup && <Badge variant="secondary">{s.priceGroup.name}</Badge>}
                    </div>
                    <div className="flex gap-1 mt-2">
                      {(() => {
                        try {
                          const days: number[] = JSON.parse(s.daysOfWeek || '[]')
                          return days.map(d => (
                            <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-medium">{dayLabels[d] || d}</span>
                          ))
                        } catch { return null }
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={s.isActive} onCheckedChange={v => toggleMutation.mutate({ id: s.id, isActive: v })} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(s.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Obrazec za nov urnik */}
      {showForm ? (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Nov Happy Hour urnik
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Ime (npr. Popoldanski popust) *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <Textarea placeholder="Opis (opcijsko)" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vrsta popusta</Label>
                <Select value={form.discountType} onValueChange={v => setForm(p => ({ ...p, discountType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Odstotek</SelectItem>
                    <SelectItem value="fixed">Fiksni znesek</SelectItem>
                    <SelectItem value="none">Brez popusta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Znesek {form.discountType === 'percentage' ? '(%)' : '(€)'}</Label>
                <Input type="number" step="0.5" value={form.discountAmount} onChange={e => setForm(p => ({ ...p, discountAmount: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div>
              <Label>Cenik (Price Group)</Label>
              <Select value={form.priceGroupId} onValueChange={v => setForm(p => ({ ...p, priceGroupId: v }))}>
                <SelectTrigger><SelectValue placeholder="Izberi cenik..." /></SelectTrigger>
                <SelectContent>
                  {(priceGroups || []).map((pg: any) => (
                    <SelectItem key={pg.id} value={pg.id}>{pg.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Od (ura)</Label>
                <Input type="time" value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} />
              </div>
              <div>
                <Label>Do (ura)</Label>
                <Input type="time" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Dnevi v tednu</Label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5, 6, 7].map(d => (
                  <button
                    key={d}
                    onClick={() => toggleDay(d)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-bold transition ${form.daysOfWeek.includes(d) ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'}`}
                  >
                    {dayLabels[d]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Veljavno od</Label>
                <Input type="date" value={form.validFrom} onChange={e => setForm(p => ({ ...p, validFrom: e.target.value }))} />
              </div>
              <div>
                <Label>Veljavno do</Label>
                <Input type="date" value={form.validTo} onChange={e => setForm(p => ({ ...p, validTo: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={!form.name || saving} className="flex-1">
                {saving ? 'Ustvarjam...' : 'Ustvari Happy Hour'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Prekliči</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Dodaj Happy Hour urnik
        </Button>
      )}
    </div>
  )
}
