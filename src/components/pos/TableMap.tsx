'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Plus, Users, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'

const statusColors: Record<string, string> = {
  available: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-800',
  occupied: 'bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-800',
  reserved: 'bg-yellow-100 border-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-800',
  cleaning: 'bg-gray-100 border-gray-300 dark:bg-gray-800/50 dark:border-gray-700',
}

const statusDot: Record<string, string> = {
  available: 'bg-emerald-500',
  occupied: 'bg-red-500',
  reserved: 'bg-yellow-500',
  cleaning: 'bg-gray-400',
}

const areaLabels: Record<string, string> = {
  main: 'Glavna dvorana',
  patio: 'Terasa',
  bar: 'Bar',
  private: 'Zasebni prostor',
}

const statusLabels: Record<string, string> = {
  available: 'Prosta',
  occupied: 'Zasedena',
  reserved: 'Rezervirana',
  cleaning: 'Čiščenje',
}

export function TableMap() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTable, setEditingTable] = useState<Record<string, unknown> | null>(null)
  const [formData, setFormData] = useState({ number: '', capacity: '4', area: 'main', status: 'available' })

  const { data: tables, isLoading } = useQuery({
    queryKey: ['tables'],
    queryFn: async () => {
      const res = await fetch('/api/tables')
      return res.json()
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: { number: number; capacity: number; area: string; status: string }) => {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Miza ustvarjena')
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      setDialogOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; number: number; capacity: number; area: string; status: string }) => {
      const res = await fetch(`/api/tables/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Miza posodobljena')
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      setDialogOpen(false)
      setEditingTable(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tables/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Miza izbrisana')
      queryClient.invalidateQueries({ queryKey: ['tables'] })
    },
  })

  const openCreate = () => {
    setEditingTable(null)
    setFormData({ number: '', capacity: '4', area: 'main', status: 'available' })
    setDialogOpen(true)
  }

  const openEdit = (table: Record<string, unknown>) => {
    setEditingTable(table)
    setFormData({
      number: String(table.number),
      capacity: String(table.capacity),
      area: String(table.area),
      status: String(table.status),
    })
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    const payload = {
      number: parseInt(formData.number),
      capacity: parseInt(formData.capacity),
      area: formData.area,
      status: formData.status,
    }
    if (editingTable) {
      updateMutation.mutate({ id: editingTable.id as string, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const groupedTables = (tables || []).reduce((acc: Record<string, unknown[]>, table: Record<string, unknown>) => {
    const area = (table.area as string) || 'main'
    if (!acc[area]) acc[area] = []
    acc[area].push(table)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Mize</h2>
          <p className="text-muted-foreground">Upravljajte mize in sedežni red</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj mizo
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        {Object.entries(statusDot).map(([status, color]) => (
          <div key={status} className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${color}`} />
            <span>{statusLabels[status] || status}</span>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        Object.entries(groupedTables).map(([area, areaTables]) => (
          <div key={area}>
            <h3 className="text-lg font-semibold mb-3">{areaLabels[area] || area}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {(areaTables as Record<string, unknown>[]).map((table) => (
                <Card
                  key={table.id as string}
                  className={`cursor-pointer border-2 hover:shadow-md transition-all ${statusColors[table.status as string] || ''}`}
                  onClick={() => openEdit(table)}
                >
                  <CardContent className="p-4 text-center space-y-2">
                    <div className="flex items-center justify-between">
                      <div className={`h-3 w-3 rounded-full ${statusDot[table.status as string] || ''}`} />
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); openEdit(table) }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(table.id as string) }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-2xl font-bold">{String(table.number)}</div>
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {String(table.capacity)} mest
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {statusLabels[String(table.status)] || String(table.status)}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTable ? 'Uredi mizo' : 'Dodaj mizo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Številka mize</label>
              <Input
                type="number"
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Kapaciteta</label>
              <Input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Območje</label>
              <Select value={formData.area} onValueChange={(v) => setFormData({ ...formData, area: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">Glavna dvorana</SelectItem>
                  <SelectItem value="patio">Terasa</SelectItem>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="private">Zasebni prostor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Prosta</SelectItem>
                  <SelectItem value="occupied">Zasedena</SelectItem>
                  <SelectItem value="reserved">Rezervirana</SelectItem>
                  <SelectItem value="cleaning">Čiščenje</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Prekliči</Button>
            <Button onClick={handleSubmit} disabled={!formData.number}>
              {editingTable ? 'Posodobi' : 'Ustvari'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
