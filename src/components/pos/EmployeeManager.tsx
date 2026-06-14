'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useState, useMemo, useCallback, memo } from 'react'
import { format } from 'date-fns'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import dynamic from 'next/dynamic'
import type { EmployeeFormData, ShiftFormData } from './employee/constants'

// Lazy-loaded podkomponente
const EmployeeHeader = dynamic(() => import('./employee/EmployeeHeader').then(m => ({ default: m.EmployeeHeader })), { ssr: false })
const EmployeeList = dynamic(() => import('./employee/EmployeeList').then(m => ({ default: m.EmployeeList })), { ssr: false })
const EmployeeDialog = dynamic(() => import('./employee/EmployeeDialog').then(m => ({ default: m.EmployeeDialog })), { ssr: false })
const ShiftDialog = dynamic(() => import('./employee/ShiftDialog').then(m => ({ default: m.ShiftDialog })), { ssr: false })
const DeleteDialog = dynamic(() => import('./employee/DeleteDialog').then(m => ({ default: m.DeleteDialog })), { ssr: false })

export const EmployeeManager = memo(function EmployeeManager() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Record<string, unknown> | null>(null)
  const [formData, setFormData] = useState<EmployeeFormData>({ name: '', email: '', phone: '', role: 'staff', status: 'active', hireDate: '' })
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false)
  const [shiftForm, setShiftForm] = useState<ShiftFormData>({ employeeId: '', date: '', startTime: '09:00', endTime: '17:00' })
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null)

  const { data: employees, isLoading } = useQuery({
    queryKey: queryKeys.employees.all,
    queryFn: async () => {
      const res = await authFetch('/api/employees')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })

  const { data: shifts } = useQuery({
    queryKey: queryKeys.shifts.all,
    queryFn: async () => {
      const res = await authFetch('/api/shifts')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })

  const employeesList = Array.isArray(employees) ? employees : []

  // FIX PERF: useMemo za filtriranje — prej se je filtriralo ob vsakem renderu
  const filteredEmployees = useMemo(() => employeesList.filter((emp: { name: string; role: string }) => {
    const matchesSearch = emp.name.toLowerCase().includes(search.toLowerCase())
    const matchesRole = filterRole === 'all' || emp.role === filterRole
    return matchesSearch && matchesRole
  }), [employeesList, search, filterRole])

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

  // FIX PERF: useCallback za handlerje — prej so se ustvarjali na vsakem renderu
  const openCreate = useCallback(() => {
    setEditingEmployee(null)
    setFormData({ name: '', email: '', phone: '', role: 'staff', status: 'active', hireDate: format(new Date(), 'yyyy-MM-dd') })
    setDialogOpen(true)
  }, [])

  const openEdit = useCallback((emp: Record<string, unknown>) => {
    setEditingEmployee(emp)
    setFormData({
      name: String(emp.name),
      email: String(emp.email),
      phone: String(emp.phone || ''),
      role: String(emp.role),
      status: String(emp.status),
      hireDate: emp.hireDate ? format(new Date(emp.hireDate as string), 'yyyy-MM-dd') : '',
    })
    setDialogOpen(true)
  }, [])

  const handleSubmit = useCallback(() => {
    const payload = { ...formData, hireDate: formData.hireDate || new Date().toISOString() }
    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id as string, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }, [formData, editingEmployee, updateMutation, createMutation])

  const toggleStatus = useCallback((emp: Record<string, unknown>) => {
    const newStatus = emp.status === 'active' ? 'inactive' : 'active'
    updateMutation.mutate({ id: emp.id as string, status: newStatus })
  }, [updateMutation])

  const openShiftDialog = useCallback(() => {
    setShiftForm({ employeeId: '', date: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '17:00' })
    setShiftDialogOpen(true)
  }, [])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setEditingEmployee(null)
    setDialogOpen(open)
  }, [])

  const handleShiftDialogOpenChange = useCallback((open: boolean) => {
    setShiftDialogOpen(open)
  }, [])

  const handleDeleteOpenChange = useCallback((open: boolean) => {
    if (!open) setDeleteTarget(null)
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget?.id) deleteMutation.mutate(deleteTarget.id as string)
    setDeleteTarget(null)
  }, [deleteTarget, deleteMutation])

  return (
    <div className="space-y-6">
      <EmployeeHeader
        onOpenCreate={openCreate}
        onOpenShiftDialog={openShiftDialog}
      />

      <EmployeeList
        employees={filteredEmployees}
        isLoading={isLoading}
        search={search}
        filterRole={filterRole}
        onSearchChange={setSearch}
        onFilterRoleChange={setFilterRole}
        onEdit={openEdit}
        onToggleStatus={toggleStatus}
        onDelete={setDeleteTarget}
        shifts={shifts}
      />

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        editingEmployee={editingEmployee}
        formData={formData}
        onFormDataChange={setFormData}
        onSubmit={handleSubmit}
      />

      <ShiftDialog
        open={shiftDialogOpen}
        onOpenChange={handleShiftDialogOpenChange}
        shiftForm={shiftForm}
        onShiftFormChange={setShiftForm}
        employees={employeesList}
        onSubmit={() => createShiftMutation.mutate(shiftForm as unknown as Record<string, unknown>)}
      />

      <DeleteDialog
        open={!!deleteTarget}
        deleteTarget={deleteTarget}
        onOpenChange={handleDeleteOpenChange}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
})
