'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useCallback, memo } from 'react'
import { format } from 'date-fns'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import dynamic from 'next/dynamic'
import { useEmployeeManagerState, useEmployeeManagerMutations } from './useEmployeeManagerState'

// Lazy-loaded podkomponente
const EmployeeHeader = dynamic(() => import('./employee/EmployeeHeader').then(m => ({ default: m.EmployeeHeader })), { ssr: false })
const EmployeeList = dynamic(() => import('./employee/EmployeeList').then(m => ({ default: m.EmployeeList })), { ssr: false })
const EmployeeDialog = dynamic(() => import('./employee/EmployeeDialog').then(m => ({ default: m.EmployeeDialog })), { ssr: false })
const ShiftDialog = dynamic(() => import('./employee/ShiftDialog').then(m => ({ default: m.ShiftDialog })), { ssr: false })
const DeleteDialog = dynamic(() => import('./employee/DeleteDialog').then(m => ({ default: m.DeleteDialog })), { ssr: false })

export const EmployeeManager = memo(function EmployeeManager() {
  const queryClient = useQueryClient()
  const state = useEmployeeManagerState()
  const { createMutation, updateMutation, deleteMutation, createShiftMutation } = useEmployeeManagerMutations(
    queryClient, state.setDialogOpen, state.setShiftDialogOpen, state.setEditingEmployee
  )

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

  const filteredEmployees = useMemo(() => employeesList.filter((emp: { name: string; role: string }) => {
    const matchesSearch = emp.name.toLowerCase().includes(state.search.toLowerCase())
    const matchesRole = state.filterRole === 'all' || emp.role === state.filterRole
    return matchesSearch && matchesRole
  }), [employeesList, state.search, state.filterRole])

  const openCreate = useCallback(() => {
    state.setEditingEmployee(null)
    state.setFormData({ name: '', email: '', phone: '', role: 'staff', status: 'active', hireDate: format(new Date(), 'yyyy-MM-dd') })
    state.setDialogOpen(true)
  }, [state])

  const openEdit = useCallback((emp: Record<string, unknown>) => {
    state.setEditingEmployee(emp)
    state.setFormData({
      name: String(emp.name),
      email: String(emp.email),
      phone: String(emp.phone || ''),
      role: String(emp.role),
      status: String(emp.status),
      hireDate: emp.hireDate ? format(new Date(emp.hireDate as string), 'yyyy-MM-dd') : '',
    })
    state.setDialogOpen(true)
  }, [state])

  const handleSubmit = useCallback(() => {
    const payload = { ...state.formData, hireDate: state.formData.hireDate || new Date().toISOString() }
    if (state.editingEmployee) {
      updateMutation.mutate({ id: state.editingEmployee.id as string, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }, [state.formData, state.editingEmployee, updateMutation, createMutation])

  const toggleStatus = useCallback((emp: Record<string, unknown>) => {
    const newStatus = emp.status === 'active' ? 'inactive' : 'active'
    updateMutation.mutate({ id: emp.id as string, status: newStatus })
  }, [updateMutation])

  const openShiftDialog = useCallback(() => {
    state.setShiftForm({ employeeId: '', date: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '17:00' })
    state.setShiftDialogOpen(true)
  }, [state])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) state.setEditingEmployee(null)
    state.setDialogOpen(open)
  }, [state])

  const handleShiftDialogOpenChange = useCallback((open: boolean) => {
    state.setShiftDialogOpen(open)
  }, [state])

  const handleDeleteOpenChange = useCallback((open: boolean) => {
    if (!open) state.setDeleteTarget(null)
  }, [state])

  const handleDeleteConfirm = useCallback(() => {
    if (state.deleteTarget?.id) deleteMutation.mutate(state.deleteTarget.id as string)
    state.setDeleteTarget(null)
  }, [state.deleteTarget, deleteMutation, state])

  return (
    <div className="space-y-6">
      <EmployeeHeader onOpenCreate={openCreate} onOpenShiftDialog={openShiftDialog} />
      <EmployeeList
        employees={filteredEmployees}
        isLoading={isLoading}
        search={state.search}
        filterRole={state.filterRole}
        onSearchChange={state.setSearch}
        onFilterRoleChange={state.setFilterRole}
        onEdit={openEdit}
        onToggleStatus={toggleStatus}
        onDelete={state.setDeleteTarget}
        shifts={shifts}
      />
      <EmployeeDialog
        open={state.dialogOpen}
        onOpenChange={handleDialogOpenChange}
        editingEmployee={state.editingEmployee}
        formData={state.formData}
        onFormDataChange={state.setFormData}
        onSubmit={handleSubmit}
      />
      <ShiftDialog
        open={state.shiftDialogOpen}
        onOpenChange={handleShiftDialogOpenChange}
        shiftForm={state.shiftForm}
        onShiftFormChange={state.setShiftForm}
        employees={employeesList}
        onSubmit={() => createShiftMutation.mutate(state.shiftForm as unknown as Record<string, unknown>)}
      />
      <DeleteDialog
        open={!!state.deleteTarget}
        deleteTarget={state.deleteTarget}
        onOpenChange={handleDeleteOpenChange}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
})
