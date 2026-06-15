'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { parsePrintRules } from '../constants'
import type { PrinterItem, PrintRule, PrinterStatus } from '../constants'
import { usePrinterQueries } from './queries'
import { usePrinterMutations } from './mutations'

// ============================================
// HOOK: Upravljanje tiskalnikov — Glavni barrel
// ============================================

export function usePrinterManager() {
  const queries = usePrinterQueries()
  const mutations = usePrinterMutations()

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
  // HANDLERJI
  // ============================================

  const openCreate = useCallback(() => {
    mutations.setEditingPrinter(null)
    mutations.setFormData({
      name: '',
      type: 'thermal',
      location: '',
      ipAddress: '',
      isActive: true,
      printRulesOrder: false,
      printRulesReceipt: false,
      printRulesPrepStationOrder: false,
    })
    mutations.setDialogOpen(true)
  }, [mutations])

  const openEdit = useCallback((printer: PrinterItem) => {
    mutations.setEditingPrinter(printer)
    const rules = parsePrintRules(printer.printRules)
    mutations.setFormData({
      name: printer.name,
      type: printer.type,
      location: printer.location,
      ipAddress: printer.ipAddress,
      isActive: printer.isActive,
      printRulesOrder: rules.some(r => r.type === 'order'),
      printRulesReceipt: rules.some(r => r.type === 'receipt'),
      printRulesPrepStationOrder: rules.some(r => r.type === 'prepStationOrder'),
    })
    mutations.setDialogOpen(true)
  }, [mutations])

  const handleSubmit = useCallback(() => {
    if (!mutations.formData.name.trim()) {
      toast.error('Ime tiskalnika je obvezno')
      return
    }
    const printRules: PrintRule[] = []
    if (mutations.formData.printRulesOrder) printRules.push({ type: 'order' })
    if (mutations.formData.printRulesReceipt) printRules.push({ type: 'receipt' })
    if (mutations.formData.printRulesPrepStationOrder) printRules.push({ type: 'prepStationOrder' })
    const payload = {
      name: mutations.formData.name,
      type: mutations.formData.type,
      location: mutations.formData.location,
      ipAddress: mutations.formData.ipAddress,
      isActive: mutations.formData.isActive,
      printRules: JSON.stringify(printRules),
    }
    if (mutations.editingPrinter) {
      mutations.updateMutation.mutate({ id: mutations.editingPrinter.id, ...payload })
    } else {
      mutations.createMutation.mutate(payload)
    }
  }, [mutations])

  const toggleActive = useCallback((printer: PrinterItem) => {
    mutations.updateMutation.mutate({
      id: printer.id,
      isActive: !printer.isActive,
    })
  }, [mutations.updateMutation])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) mutations.setEditingPrinter(null)
    mutations.setDialogOpen(open)
  }, [mutations])

  return {
    search: queries.search, setSearch: queries.setSearch,
    dialogOpen: mutations.dialogOpen, setDialogOpen: mutations.setDialogOpen,
    editingPrinter: mutations.editingPrinter,
    formData: mutations.formData, setFormData: mutations.setFormData,
    printerStatus,
    printers: queries.printers, isLoading: queries.isLoading,
    stats: queries.stats,
    createMutation: mutations.createMutation, updateMutation: mutations.updateMutation, deleteMutation: mutations.deleteMutation,
    testConnectivity, openCreate, openEdit,
    handleSubmit, toggleActive, handleDialogOpenChange,
  }
}
