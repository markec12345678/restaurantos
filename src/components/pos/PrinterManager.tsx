'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Printer, Plus } from 'lucide-react'
import { useState, useMemo, memo } from 'react'
import dynamic from 'next/dynamic'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { PrinterItem, FormData, PrintRule, PrinterStatus } from './printer/constants'
import { API_BASE, parsePrintRules } from './printer/constants'

// ============================================
// LAZY-LOADED POD-KOMPONENTE
// ============================================

const StatsCards = dynamic(() => import('./printer/StatsCards').then(m => m.StatsCards), { ssr: false })
const PrinterGrid = dynamic(() => import('./printer/PrinterGrid').then(m => m.PrinterGrid), { ssr: false })
const PrinterDialog = dynamic(() => import('./printer/PrinterDialog').then(m => m.PrinterDialog), { ssr: false })

// ============================================
// MAIN KOMPONENTA — PRINTER MANAGER
// ============================================

export const PrinterManager = memo(function PrinterManager() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPrinter, setEditingPrinter] = useState<PrinterItem | null>(null)
  const [formData, setFormData] = useState<FormData>({
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
  const [printerStatus, setPrinterStatus] = useState<Record<string, PrinterStatus>>({})
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
    queryKey: queryKeys.configuration.byTab('printers'),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.configuration.byTab('printers') })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.configuration.byTab('printers') })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.configuration.byTab('printers') })
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

  const toggleActive = (printer: PrinterItem) => {
    updateMutation.mutate({
      id: printer.id,
      isActive: !printer.isActive,
    })
  }

  // --- Dijalog handlerji ---
  const handleDialogOpenChange = (open: boolean) => {
    if (!open) setEditingPrinter(null)
    setDialogOpen(open)
  }

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
      <StatsCards
        total={stats.total}
        active={stats.active}
        kitchen={stats.kitchen}
        receipt={stats.receipt}
      />

      {/* Iskanje in seznam tiskalnikov */}
      <PrinterGrid
        printers={printers || []}
        search={search}
        isLoading={isLoading}
        printerStatus={printerStatus}
        onSearchChange={setSearch}
        onEdit={openEdit}
        onDelete={(id) => deleteMutation.mutate(id)}
        onTestConnectivity={testConnectivity}
        onToggleActive={toggleActive}
      />

      {/* DIALOG ZA DODAJANJE/UREJANJE */}
      <PrinterDialog
        open={dialogOpen}
        editingPrinter={editingPrinter}
        formData={formData}
        onOpenChange={handleDialogOpenChange}
        onFormDataChange={setFormData}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  )
})
