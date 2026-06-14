'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useState, useMemo, useCallback } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { API_BASE, parsePrintRules } from './constants'
import type { PrinterItem, FormData as PrinterFormData, PrintRule, PrinterStatus } from './constants'

// ============================================
// HOOK: Upravljanje tiskalnikov
// Združuje poizvedbe, mutacije in handlerje
// ============================================

export function usePrinterManager() {
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPrinter, setEditingPrinter] = useState<PrinterItem | null>(null)
  const [formData, setFormData] = useState<PrinterFormData>({
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

  const testConnectivity = useCallback(async (printer: PrinterItem) => {
    setPrinterStatus(prev => ({ ...prev, [printer.id]: 'checking' }))
    try {
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
  }, [])

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

  const openCreate = useCallback(() => {
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
  }, [])

  const openEdit = useCallback((printer: PrinterItem) => {
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
  }, [])

  const handleSubmit = useCallback(() => {
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
  }, [formData, editingPrinter, updateMutation, createMutation])

  const toggleActive = useCallback((printer: PrinterItem) => {
    updateMutation.mutate({
      id: printer.id,
      isActive: !printer.isActive,
    })
  }, [updateMutation])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setEditingPrinter(null)
    setDialogOpen(open)
  }, [])

  return {
    search, setSearch,
    dialogOpen, setDialogOpen,
    editingPrinter,
    formData, setFormData,
    printerStatus,
    printers, isLoading,
    stats,
    createMutation, updateMutation, deleteMutation,
    testConnectivity, openCreate, openEdit,
    handleSubmit, toggleActive, handleDialogOpenChange,
  }
}
