'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Search, Calendar } from 'lucide-react'
import { useState } from 'react'
import { format } from 'date-fns'

const roleColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  staff: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  chef: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
}

const roleLabels: Record<string, string> = {
  admin: 'Skrbnik',
  manager: 'Vodja',
  staff: 'Osebje',
  chef: 'Kuhar',
}

export function EmployeeManager() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Record<string, unknown> | null>(null)
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', role: 'staff', status: 'active', hireDate: '' })
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false)
  const [shiftForm, setShiftForm] = useState({ employeeId: '', date: '', startTime: '09:00', endTime: '17:00' })

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await fetch('/api/employees')
      return res.json()
    },
  })

  const { data: shifts } = useQuery({
    queryKey: ['shifts'],
    queryFn: async () => {
      const res = await fetch('/api/shifts')
      return res.json()
    },
  })

  const filteredEmployees = (employees || []).filter((emp: { name: string; role: string }) => {
    const matchesSearch = emp.name.toLowerCase().includes(search.toLowerCase())
    const matchesRole = filterRole === 'all' || emp.role === filterRole
    return matchesSearch && matchesRole
  })

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { toast.success('Zaposleni ustvarjen'); queryClient.invalidateQueries({ queryKey: ['employees'] }); setDialogOpen(false) },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/employees/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { toast.success('Zaposleni posodobljen'); queryClient.invalidateQueries({ queryKey: ['employees'] }); setDialogOpen(false); setEditingEmployee(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { toast.success('Zaposleni izbrisan'); queryClient.invalidateQueries({ queryKey: ['employees'] }) },
  })

  const createShiftMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => { toast.success('Izmena razporejena'); queryClient.invalidateQueries({ queryKey: ['shifts'] }); setShiftDialogOpen(false) },
  })

  const openCreate = () => {
    setEditingEmployee(null)
    setFormData({ name: '', email: '', phone: '', role: 'staff', status: 'active', hireDate: format(new Date(), 'yyyy-MM-dd') })
    setDialogOpen(true)
  }

  const openEdit = (emp: Record<string, unknown>) => {
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
  }

  const handleSubmit = () => {
    const payload = { ...formData, hireDate: formData.hireDate || new Date().toISOString() }
    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id as string, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const toggleStatus = (emp: Record<string, unknown>) => {
    const newStatus = emp.status === 'active' ? 'inactive' : 'active'
    updateMutation.mutate({ id: emp.id as string, status: newStatus })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Zaposleni</h2>
          <p className="text-muted-foreground">Upravljajte osebje in urnike</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setShiftForm({ employeeId: '', date: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '17:00' }); setShiftDialogOpen(true) }}>
            <Calendar className="h-4 w-4 mr-2" />
            Dodaj izmeno
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Dodaj zaposlenega
          </Button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Išči zaposlene..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Vse vloge" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vse vloge</SelectItem>
            <SelectItem value="admin">Skrbnik</SelectItem>
            <SelectItem value="manager">Vodja</SelectItem>
            <SelectItem value="staff">Osebje</SelectItem>
            <SelectItem value="chef">Kuhar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredEmployees.map((emp: Record<string, unknown>) => (
            <Card key={emp.id as string} className={`hover:shadow-md transition-shadow ${emp.status === 'inactive' ? 'opacity-60' : ''}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{String(emp.name)}</p>
                    <p className="text-sm text-muted-foreground">{String(emp.email)}</p>
                  </div>
                  <Badge className={roleColors[String(emp.role)] || ''}>{roleLabels[String(emp.role)] || String(emp.role)}</Badge>
                </div>

                <div className="text-sm space-y-1">
                  {emp.phone && <p className="text-muted-foreground">📞 {String(emp.phone)}</p>}
                  <p className="text-muted-foreground">📅 Zaposlen: {emp.hireDate ? format(new Date(emp.hireDate as string), 'MMM dd, yyyy') : 'N/A'}</p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={emp.status === 'active'}
                      onCheckedChange={() => toggleStatus(emp)}
                    />
                    <span className="text-xs text-muted-foreground">{emp.status === 'active' ? 'aktiven' : 'neaktiven'}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(emp)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(emp.id as string)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredEmployees.length === 0 && !isLoading && (
        <p className="text-center py-12 text-muted-foreground">Ni najdenih zaposlenih</p>
      )}

      {/* Shifts Section */}
      {shifts && shifts.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Prihajajoče izmene</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {shifts.slice(0, 12).map((shift: Record<string, unknown>) => (
              <div key={shift.id as string} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div>
                  <p className="text-sm font-medium">{String((shift.employee as Record<string, unknown>)?.name || 'Neznano')}</p>
                  <p className="text-xs text-muted-foreground">
                    {shift.date ? format(new Date(shift.date as string), 'EEE, MMM dd') : 'N/A'} · {String(shift.startTime)}-{String(shift.endTime)}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs capitalize">{String(shift.status)}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employee Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'Uredi zaposlenega' : 'Dodaj zaposlenega'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Ime</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
            <div><Label>E-pošta</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
            <div><Label>Telefon</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
            <div><Label>Vloga</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Skrbnik</SelectItem>
                  <SelectItem value="manager">Vodja</SelectItem>
                  <SelectItem value="staff">Osebje</SelectItem>
                  <SelectItem value="chef">Kuhar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Datum zaposlitve</Label><Input type="date" value={formData.hireDate} onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Prekliči</Button>
            <Button onClick={handleSubmit} disabled={!formData.name || !formData.email}>{editingEmployee ? 'Posodobi' : 'Ustvari'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift Dialog */}
      <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Razporedi izmeno</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Zaposleni</Label>
              <Select value={shiftForm.employeeId} onValueChange={(v) => setShiftForm({ ...shiftForm, employeeId: v })}>
                <SelectTrigger><SelectValue placeholder="Izberi zaposlenega" /></SelectTrigger>
                <SelectContent>
                  {employees?.filter((e: { status: string }) => e.status === 'active').map((emp: { id: string; name: string }) => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Datum</Label><Input type="date" value={shiftForm.date} onChange={(e) => setShiftForm({ ...shiftForm, date: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Začetek</Label><Input type="time" value={shiftForm.startTime} onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })} /></div>
              <div><Label>Konec</Label><Input type="time" value={shiftForm.endTime} onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShiftDialogOpen(false)}>Prekliči</Button>
            <Button onClick={() => createShiftMutation.mutate(shiftForm)} disabled={!shiftForm.employeeId || !shiftForm.date}>Razporedi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
