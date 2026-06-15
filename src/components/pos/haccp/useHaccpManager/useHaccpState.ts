import { useState } from 'react'
import type { HaccpEntry, HaccpFormData } from '../types'

export function useHaccpState() {
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

  return {
    activeTab, setActiveTab, search, setSearch,
    dateFrom, setDateFrom, dateTo, setDateTo,
    showFilters, setShowFilters,
    dialogOpen, setDialogOpen, editingEntry, setEditingEntry,
    formData, setFormData,
    deleteDialogOpen, setDeleteDialogOpen, deleteTarget, setDeleteTarget,
    expandedEntry, setExpandedEntry,
  }
}
