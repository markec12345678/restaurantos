'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatsCard } from '@/components/pos/StatsCard'
import { toast } from 'sonner'
import {
  Printer, Plus, Pencil, Trash2, Search, Wifi, WifiOff,
  ChefHat, Receipt, ScrollText, FileText, CheckCircle2, XCircle, Loader2,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'

// ============================================
// TIPI
// ============================================

interface PrintRule {
  type: string // "order", "receipt", "prepStationOrder"
  prepStationId?: string
}

interface PrinterItem {
  id: string
  name: string
  type: string
  location: string
  ipAddress: string
  isActive: boolean
  printRules: string // JSON string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

// ============================================
// POMOŽNE FUNKCIJE
// ============================================

const API_BASE = '/api/configuration/printers'

const typeLabels: Record<string, string> = {
  thermal: 'Termični',
  'dot-matrix': 'Iglični',
  label: 'Nalepke',
}

const typeBadgeClasses: Record<string, string> = {
  thermal: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'dot-matrix': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  label: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
}

const ruleTypeLabels: Record<string, string> = {
  order: 'Naročila',
  receipt: 'Računi',
  prepStationOrder: 'Naročila postaje',
}

function parsePrintRules(rulesJson: string): PrintRule[] {
  try {
    return JSON.parse(rulesJson || '[]')
  } catch {
    return []
  }
}

function getRulesSummary(rulesJson: string): string {
  const rules = parsePrintRules(rulesJson)
  if (rules.length === 0) return 'Brez pravil'
  return rules.map(r => ruleTypeLabels[r.type] || r.type).join(', ')
}

// ============================================
// MAIN KOMPONENTA
// ============================================

export function PrinterManager() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPrinter, setEditingPrinter] = useState<PrinterItem | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    type: 'thermal',
    location: '',
    ipAddress: '',
    isActive: true,
    printRulesOrder: false,
    printRulesReceipt: false,
    printRulesPrepStationOrder: false,
  })

  // ─── PRINTER CONNECTIVITY TEST ───
  const [printerStatus, setPrinterStatus] = useState<Record<string, 'idle' | 'checking' | 'online' | 'offline'>>({})

  const testConnectivity = async (printer: PrinterItem) => {
    setPrinterStatus(prev => ({ ...prev, [printer.id]: 'checking' }))
    try {
      // Preizkusi povezavo s tiskalnikom s TCP pingom preko print API-ja
      const res = await authFetch('/api/print', {
        method: 'POST',
        body: JSON.stringify({ type: 'test', printerId: printer.id }),
      })
      const data = await res.json()
      setPrinterStatus(prev => ({ ...prev, [printer.id]: data.printed ? 'online' : 'offline' }))
      if (data.printed) {
        toast.success(`Tiskalnik ${printer.name} je povezan — testni tisk poslan`)
      } else {
        toast.error(`Tiskalnik ${printer.name} ni dosegljiv: ${data.error || 'Neznana napaka'}`)
      }
    } catch {
      setPrinterStatus(prev => ({ ...prev, [printer.id]: 'offline' }))
      toast.error('Napaka pri povezavi')
    }
  }

  // ============================================
  // QUERY
  // ============================================

  const { data: printers, isLoading } = useQuery<PrinterItem[]>({
    queryKey: ['configuration', 'printers'],
    queryFn: async () => {
      const res = await authFetch(API_BASE)
      return res.json()
    },
  })

  // ============================================
  // IZRAČUNI ZA POVZETEK
  // ============================================

  const stats = useMemo(() => {
    const list = printers || []
    const active = list.filter(p => p.isActive).length
    const kitchen = list.filter(p => {
      const rules = parsePrintRules(p.printRules)
      return rules.some(r => r.type === 'order' || r.type === 'prepStationOrder')
    }).length
    const receipt = list.filter(p => {
      const rules = parsePrintRules(p.printRules)
      return rules.some(r => r.type === 'receipt')
    }).length
    return { total: list.length, active, kitchen, receipt }
  }, [printers])

  // ============================================
  // MUTATIONS
  // ============================================

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch(API_BASE, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Tiskalnik uspešno ustvarjen')
      queryClient.invalidateQueries({ queryKey: ['configuration', 'printers'] })
      setDialogOpen(false)
    },
    onError: () => toast.error('Napaka pri ustvarjanju tiskalnika'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Tiskalnik uspešno posodobljen')
      queryClient.invalidateQueries({ queryKey: ['configuration', 'printers'] })
      setDialogOpen(false)
      setEditingPrinter(null)
    },
    onError: () => toast.error('Napaka pri posodobitvi tiskalnika'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`${API_BASE}/${id}`, { method: 'DELETE' })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Tiskalnik uspešno izbrisan')
      queryClient.invalidateQueries({ queryKey: ['configuration', 'printers'] })
    },
    onError: () => toast.error('Napaka pri brisanju tiskalnika'),
  })

  // ============================================
  // HANDLERJI
  // ============================================

  const openCreate = () => {
    setEditingPrinter(null)
    setFormData({
      name: '',
      type: 'thermal',
      location: '',
      ipAddress: '',
      isActive: true,
      printRulesOrder: false,
      printRulesReceipt: false,
      printRulesPrepStationOrder: false,
    })
    setDialogOpen(true)
  }

  const openEdit = (printer: PrinterItem) => {
    setEditingPrinter(printer)
    const rules = parsePrintRules(printer.printRules)
    setFormData({
      name: printer.name,
      type: printer.type,
      location: printer.location,
      ipAddress: printer.ipAddress,
      isActive: printer.isActive,
      printRulesOrder: rules.some(r => r.type === 'order'),
      printRulesReceipt: rules.some(r => r.type === 'receipt'),
      printRulesPrepStationOrder: rules.some(r => r.type === 'prepStationOrder'),
    })
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('Ime tiskalnika je obvezno')
      return
    }

    const printRules: PrintRule[] = []
    if (formData.printRulesOrder) printRules.push({ type: 'order' })
    if (formData.printRulesReceipt) printRules.push({ type: 'receipt' })
    if (formData.printRulesPrepStationOrder) printRules.push({ type: 'prepStationOrder' })

    const payload = {
      name: formData.name,
      type: formData.type,
      location: formData.location,
      ipAddress: formData.ipAddress,
      isActive: formData.isActive,
      printRules: JSON.stringify(printRules),
    }

    if (editingPrinter) {
      updateMutation.mutate({ id: editingPrinter.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleTestPrint = async (printer: PrinterItem) => {
    try {
      const res = await authFetch('/api/print', {
        method: 'POST',
        body: JSON.stringify({ type: 'test', printerId: printer.id }),
      })
      const data = await res.json()
      if (data.printed) {
        toast.success(`Testni tisk poslan na ${printer.name} (${printer.ipAddress})`)
      } else {
        toast.error(`Tiskanje ni uspelo: ${data.error || 'Neznana napaka'}`)
      }
    } catch {
      toast.error('Napaka pri povezavi s tiskalnikom')
    }
  }

  const toggleActive = (printer: PrinterItem) => {
    updateMutation.mutate({
      id: printer.id,
      isActive: !printer.isActive,
    })
  }

  // ============================================
  // FILTRIRANJE
  // ============================================

  const filteredPrinters = (printers || []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.location.toLowerCase().includes(search.toLowerCase()) ||
    p.ipAddress.toLowerCase().includes(search.toLowerCase())
  )

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Glava */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Printer className="h-6 w-6" />
            Tiskalniki
          </h2>
          <p className="text-muted-foreground">Upravljajte omrežne tiskalnike in pravila tiskanja</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj tiskalnik
        </Button>
      </div>

      {/* Povzetek kartice */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard
          title="Skupaj tiskalnikov"
          value={stats.total}
          icon={Printer}
          subtitle={`${stats.total === 1 ? 'tiskalnik' : stats.total === 2 ? 'tiskalnika' : (stats.total < 5 ? 'tiskalniki' : 'tiskalnikov')}`}
        />
        <StatsCard
          title="Aktivni"
          value={stats.active}
          icon={Wifi}
          subtitle={`${stats.active === 1 ? 'tiskalnik' : stats.active === 2 ? 'tiskalnika' : (stats.active < 5 ? 'tiskalniki' : 'tiskalnikov')}`}
        />
        <StatsCard
          title="Kuhinja"
          value={stats.kitchen}
          icon={ChefHat}
          subtitle="Naročila v kuhinjo"
        />
        <StatsCard
          title="Računi"
          value={stats.receipt}
          icon={Receipt}
          subtitle="Tiskanje računov"
        />
      </div>

      {/* Iskanje */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Išči tiskalnike..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="outline" className="text-xs">
          {filteredPrinters.length} {filteredPrinters.length === 1 ? 'zapis' : filteredPrinters.length === 2 ? 'zapisa' : (filteredPrinters.length < 5 ? 'zapisi' : 'zapisov')}
        </Badge>
      </div>

      {/* Seznam tiskalnikov */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : filteredPrinters.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Printer className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Ni najdenih tiskalnikov</p>
          <p className="text-sm">Kliknite &quot;Dodaj tiskalnik&quot; za ustvarjanje novega vnosa</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPrinters.map(printer => (
            <Card
              key={printer.id}
              className={`hover:shadow-md transition-shadow ${!printer.isActive ? 'opacity-60' : ''}`}
            >
              <CardContent className="p-4 space-y-3">
                {/* Vrsta in ime */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{printer.name}</p>
                      <Badge className={typeBadgeClasses[printer.type] || ''}>
                        {typeLabels[printer.type] || printer.type}
                      </Badge>
                    </div>
                    {printer.location && (
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        📍 {printer.location}
                      </p>
                    )}
                  </div>
                  <Badge variant={printer.isActive ? 'default' : 'secondary'} className="text-[10px] flex-shrink-0">
                    {printer.isActive ? 'Aktiven' : 'Nedejaven'}
                  </Badge>
                </div>

                {/* IP naslov in status povezave */}
                <div className="flex items-center gap-2 text-sm">
                  {printer.ipAddress ? (
                    <>
                      {printerStatus[printer.id] === 'online' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : printerStatus[printer.id] === 'offline' ? (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      ) : printerStatus[printer.id] === 'checking' ? (
                        <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
                      ) : (
                        <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                      <span className="font-mono text-xs text-muted-foreground">{printer.ipAddress}:9100</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Brez IP naslova</span>
                    </>
                  )}
                </div>

                {/* Pravila tiskanja */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <ScrollText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    {getRulesSummary(printer.printRules)}
                  </span>
                </div>

                {/* Akcije */}
                <div className="flex items-center justify-between pt-1 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={printer.isActive}
                      onCheckedChange={() => toggleActive(printer)}
                      className="scale-90"
                    />
                    <span className="text-xs text-muted-foreground">
                      {printer.isActive ? 'Aktiven' : 'Nedejaven'}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Test povezljivosti in tisk"
                      onClick={() => testConnectivity(printer)}
                      disabled={!printer.isActive || !printer.ipAddress || printerStatus[printer.id] === 'checking'}
                    >
                      {printerStatus[printer.id] === 'checking' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <FileText className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Uredi"
                      onClick={() => openEdit(printer)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      title="Izbriši"
                      onClick={() => deleteMutation.mutate(printer.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* DIALOG ZA DODAJANJE/UREJANJE */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPrinter ? `Uredi tiskalnik: ${editingPrinter.name}` : 'Dodaj tiskalnik'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Ime */}
            <div>
              <Label>Ime</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="npr. Kuhinja 1, Bar tiskalnik, Blagajna"
              />
            </div>

            {/* Vrsta */}
            <div>
              <Label>Vrsta tiskalnika</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thermal">Termični</SelectItem>
                  <SelectItem value="dot-matrix">Iglični</SelectItem>
                  <SelectItem value="label">Nalepke</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lokacija */}
            <div>
              <Label>Lokacija</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="npr. Kuhinja, Bar, Blagajna"
              />
            </div>

            {/* IP naslov */}
            <div>
              <Label>IP naslov</Label>
              <Input
                value={formData.ipAddress}
                onChange={(e) => setFormData(prev => ({ ...prev, ipAddress: e.target.value }))}
                placeholder="192.168.1.100"
              />
              <p className="text-xs text-muted-foreground mt-1">Omrežni tiskalnik — IP naslov v lokalnem omrežju</p>
            </div>

            {/* Aktivno */}
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(c) => setFormData(prev => ({ ...prev, isActive: c }))}
              />
              <Label>Aktiven</Label>
            </div>

            {/* Pravila tiskanja */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Pravila tiskanja</Label>
              <p className="text-xs text-muted-foreground">Izberite, kaj se naj tiska na tem tiskalniku</p>

              <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="rule-order"
                    checked={formData.printRulesOrder}
                    onCheckedChange={(c) => setFormData(prev => ({ ...prev, printRulesOrder: !!c }))}
                  />
                  <label htmlFor="rule-order" className="text-sm cursor-pointer flex items-center gap-1.5">
                    <ChefHat className="h-3.5 w-3.5 text-muted-foreground" />
                    Naročila
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="rule-receipt"
                    checked={formData.printRulesReceipt}
                    onCheckedChange={(c) => setFormData(prev => ({ ...prev, printRulesReceipt: !!c }))}
                  />
                  <label htmlFor="rule-receipt" className="text-sm cursor-pointer flex items-center gap-1.5">
                    <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                    Računi
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="rule-prep-station"
                    checked={formData.printRulesPrepStationOrder}
                    onCheckedChange={(c) => setFormData(prev => ({ ...prev, printRulesPrepStationOrder: !!c }))}
                  />
                  <label htmlFor="rule-prep-station" className="text-sm cursor-pointer flex items-center gap-1.5">
                    <ScrollText className="h-3.5 w-3.5 text-muted-foreground" />
                    Naročila pripravljalne postaje
                  </label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Prekliči
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name.trim() || createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Shranjujem...'
                : editingPrinter
                  ? 'Posodobi'
                  : 'Ustvari'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
