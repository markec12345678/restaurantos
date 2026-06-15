'use client'

import { useMutation, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useState } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { EmployeeFormData, ShiftFormData } from './employee/constants'

// ============================================
// HOOK: Employee Manager — queries, mutations, handlers
// ============================================

export function useEmployeeManagerState() {
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Record<string, unknown> | null>(null)
  const [formData, setFormData] = useState<EmployeeFormData>({ name: '', email: '', phone: '', role: 'staff', status: 'active', hireDate: '' })
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false)
  const [shiftForm, setShiftForm] = useState<ShiftFormData>({ employeeId: '', date: '', startTime: '09:00', endTime: '17:00' })
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null)

  return {
    search, setSearch,
    filterRole, setFilterRole,
    dialogOpen, setDialogOpen,
    editingEmployee, setEditingEmployee,
    formData, setFormData,
    shiftDialogOpen, setShiftDialogOpen,
    shiftForm, setShiftForm,
    deleteTarget, setDeleteTarget,
  }
}

export function useEmployeeManagerMutations(
  queryClient: QueryClient,
  setDialogOpen: (_open: boolean) => void,
  setShiftDialogOpen: (_open: boolean) => void,
  setEditingEmployee: (_emp: Record<string, unknown> | null) => void,
) {
  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/employees', { method: 'POST', body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { toast.success('Zaposleni ustvarjen'); queryClient.invalidateQueries({ queryKey: queryKeys.employees.all }); setDialogOpen(false) },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { toast.success('Zaposleni posodobljen'); queryClient.invalidateQueries({ queryKey: queryKeys.employees.all }); setDialogOpen(false); setEditingEmployee(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/employees/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { toast.success('Zaposleni izbrisan'); queryClient.invalidateQueries({ queryKey: queryKeys.employees.all }) },
  })

  const createShiftMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/shifts', { method: 'POST', body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { toast.success('Izmena razporejena'); queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all }); setShiftDialogOpen(false) },
  })

  return { createMutation, updateMutation, deleteMutation, createShiftMutation }
}
