'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Users, ShoppingBag, CreditCard, Clock, ChevronRight, X } from 'lucide-react'
import { usePOSStore } from '@/lib/store'
import { useState } from 'react'
import { format } from 'date-fns'

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

const orderStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  ready: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
}

const orderStatusLabels: Record<string, string> = {
  pending: 'Čakajoče',
  'in-progress': 'V obdelavi',
  ready: 'Pripravljeno',
  completed: 'Zaključeno',
}

export function TableMap() {
  const queryClient = useQueryClient()
  const { setActiveModule, setSelectedTable, setOrderType } = usePOSStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTable, setEditingTable] = useState<Record<string, unknown> | null>(null)
  const [formData, setFormData] = useState({ number: '', capacity: '4', area: 'main', status: 'available' })
  const [selectedTableForOrders, setSelectedTableForOrders] = useState<Record<string, unknown> | null>(null)

  const { data: tables, isLoading } = useQuery({
    queryKey: ['tables'],
    queryFn: async () => {
      const res = await fetch('/api/tables')
      return res.json()
    },
  })

  // Fetch orders for selected table
  const { data: tableOrders } = useQuery({
    queryKey: ['table-orders', selectedTableForOrders?.id],
    queryFn: async () => {
      if (!selectedTableForOrders) return []
      const res = await fetch('/api/orders')
      const allOrders = await res.json()
      return allOrders.filter((o: { tableId: string; status: string }) =>
        o.tableId === selectedTableForOrders.id && o.status !== 'cancelled'
      )
    },
    enabled: !!selectedTableForOrders,
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

  const handleTableClick = (table: Record<string, unknown>) => {
    if (table.status === 'occupied') {
      // Show orders for this table
      setSelectedTableForOrders(table)
    } else if (table.status === 'available') {
      // Start new order for this table
      setSelectedTable(table.id as string)
      setOrderType('dine-in')
      setActiveModule('orders')
      toast.info(`Miza ${table.number} izbrana za novo naročilo`)
    }
  }

  const handleNewOrderForTable = (tableId: string, tableNumber: number) => {
    setSelectedTable(tableId)
    setOrderType('dine-in')
    setActiveModule('orders')
    setSelectedTableForOrders(null)
    toast.info(`Miza ${tableNumber} izbrana za novo naročilo`)
  }

  const groupedTables = (tables || []).reduce((acc: Record<string, unknown[]>, table: Record<string, unknown>) => {
    const area = (table.area as string) || 'main'
    if (!acc[area]) acc[area] = []
    acc[area].push(table)
    return acc
  }, {})

  // Calculate summary stats
  const totalTables = (tables || []).length
  const occupiedTables = (tables || []).filter((t: { status: string }) => t.status === 'occupied').length
  const availableTables = (tables || []).filter((t: { status: string }) => t.status === 'available').length

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

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-emerald-200 dark:border-emerald-900/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{availableTables}</p>
            <p className="text-xs text-muted-foreground">Proste</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-900/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{occupiedTables}</p>
            <p className="text-xs text-muted-foreground">Zasedene</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{totalTables}</p>
            <p className="text-xs text-muted-foreground">Skupaj</p>
          </CardContent>
        </Card>
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
                  onClick={() => handleTableClick(table)}
                >
                  <CardContent className="p-4 text-center space-y-2">
                    <div className="flex items-center justify-between">
                      <div className={`h-3 w-3 rounded-full ${statusDot[table.status as string] || ''}`} />
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => openEdit(table)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => deleteMutation.mutate(table.id as string)}
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
                    {table.status === 'occupied' && (
                      <p className="text-[10px] text-primary font-medium">
                        Klikni za naročila →
                      </p>
                    )}
                    {table.status === 'available' && (
                      <p className="text-[10px] text-emerald-600 font-medium">
                        Klikni za novo naročilo
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Table Orders Dialog */}
      <Dialog open={!!selectedTableForOrders} onOpenChange={() => setSelectedTableForOrders(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Miza {selectedTableForOrders?.number as number} — Naročila
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(!tableOrders || tableOrders.length === 0) ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Ni aktivnih naročil za to mizo</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                {(tableOrders || []).map((order: {
                  id: string
                  orderNumber: number
                  status: string
                  total: number
                  customerName: string
                  paymentStatus: string
                  createdAt: string
                  orderItems: { id: string; menuItem: { name: string }; quantity: number; price: number }[]
                }) => (
                  <Card key={order.id} className="border-2">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">#{order.orderNumber}</span>
                          <Badge variant="outline" className={orderStatusColors[order.status] || ''}>
                            {orderStatusLabels[order.status] || order.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {order.paymentStatus === 'paid' ? (
                            <Badge variant="outline" className="bg-emerald-100 text-emerald-800 text-[10px]">
                              Plačano
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-100 text-amber-800 text-[10px]">
                              Neplačano
                            </Badge>
                          )}
                          <span className="font-bold text-sm">€{order.total.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {format(new Date(order.createdAt), 'HH:mm')}
                        {order.customerName && ` · ${order.customerName}`}
                      </div>
                      <div className="space-y-1">
                        {order.orderItems.map(oi => (
                          <div key={oi.id} className="flex justify-between text-sm">
                            <span>{oi.quantity}x {oi.menuItem.name}</span>
                            <span className="text-muted-foreground">€{(oi.price * oi.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Separator />

            <Button
              className="w-full"
              onClick={() => {
                if (selectedTableForOrders) {
                  handleNewOrderForTable(
                    selectedTableForOrders.id as string,
                    selectedTableForOrders.number as number
                  )
                }
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj novo naročilo za mizo {selectedTableForOrders?.number as number}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
