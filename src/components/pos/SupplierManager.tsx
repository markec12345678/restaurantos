'use client'

// ============================================
// UPRAVITELJ DOBAVITELJEV — Profesionalen sistem
// Toast POS standard — Dobavitelji, ceniki, nabavna naročila
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { Truck, FileText, Plus } from 'lucide-react'
import { useState, memo } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import type { SupplierType } from './supplier/constants'

// Lazy-loaded podkomponente
const SuppliersList = dynamic(() => import('./supplier/SuppliersList').then(m => ({ default: m.SuppliersList })), { ssr: false })
const PurchaseOrdersList = dynamic(() => import('./supplier/PurchaseOrdersList').then(m => ({ default: m.PurchaseOrdersList })), { ssr: false })
const SupplierDialog = dynamic(() => import('./supplier/SupplierDialog').then(m => ({ default: m.SupplierDialog })), { ssr: false })
const PurchaseOrderDialog = dynamic(() => import('./supplier/PurchaseOrderDialog').then(m => ({ default: m.PurchaseOrderDialog })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================
export const SupplierManager = memo(function SupplierManager() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('suppliers')
  const [searchTerm, _setSearchTerm] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<SupplierType | null>(null)
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null)

  // Nabavna naročila dialog
  const [poDialogOpen, setPoDialogOpen] = useState(false)
  const [selectedSupplierForPO, setSelectedSupplierForPO] = useState<string>('')

  // Podatki
  const { data: suppliers, isLoading } = useQuery({
    queryKey: [...queryKeys.suppliers.all, searchTerm],
    queryFn: async () => {
      const params = searchTerm ? `?search=${searchTerm}` : ''
      const res = await authFetch(`/api/suppliers${params}`)
      return res.json()
    },
  })

  const { data: purchaseOrders, isLoading: poLoading } = useQuery({
    queryKey: queryKeys.purchaseOrders.all,
    queryFn: async () => {
      const res = await authFetch('/api/purchase-orders')
      return res.json()
    },
  })

  const { data: inventoryItems } = useQuery({
    queryKey: ['inventory-brief'],
    queryFn: async () => {
      const res = await authFetch('/api/inventory?distinctCategories=true')
      return res.json()
    },
  })

  // Shrani dobavitelja
  const saveSupplierMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (editingSupplier) {
        const res = await authFetch(`/api/suppliers/${editingSupplier.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Napaka pri posodabljanju')
        return res.json()
      } else {
        const res = await authFetch('/api/suppliers', {
          method: 'POST',
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Napaka pri ustvarjanju')
        return res.json()
      }
    },
    onSuccess: () => {
      toast.success(editingSupplier ? 'Dobavitelj posodobljen' : 'Dobavitelj ustvarjen')
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all })
      setDialogOpen(false)
      setEditingSupplier(null)
    },
    onError: () => toast.error('Napaka pri shranjevanju'),
  })

  // Ustvari nabavno naročilo
  const createPOMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/purchase-orders', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka pri ustvarjanju naročila')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Nabavno naročilo ustvarjeno')
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
      setPoDialogOpen(false)
    },
    onError: () => toast.error('Napaka pri ustvarjanju naročila'),
  })

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Dobavitelji in nabava
          </h2>
          <p className="text-xs text-muted-foreground">Upravljanje dobaviteljev, cenikov in nabavnih naročil</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'suppliers' && (
            <Button size="sm" onClick={() => { setEditingSupplier(null); setDialogOpen(true) }}>
              <Plus className="h-4 w-4 mr-1" /> Nov dobavitelj
            </Button>
          )}
          {activeTab === 'purchase-orders' && (
            <Button size="sm" onClick={() => { setSelectedSupplierForPO(''); setPoDialogOpen(true) }}>
              <Plus className="h-4 w-4 mr-1" /> Novo naročilo
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-2 flex-shrink-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="suppliers" className="gap-1.5 text-xs">
              <Truck className="h-3.5 w-3.5" /> Dobavitelji ({suppliers?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="purchase-orders" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" /> Nabavna naročila ({purchaseOrders?.length || 0})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="suppliers" className="flex-1 overflow-y-auto p-4 custom-scrollbar mt-0">
          {isLoading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
          ) : (
            <SuppliersList
              suppliers={suppliers || []}
              expandedId={expandedSupplier}
              onToggleExpand={(id) => setExpandedSupplier(expandedSupplier === id ? null : id)}
              onEdit={(s) => { setEditingSupplier(s); setDialogOpen(true) }}
              onCreatePO={(supplierId) => { setSelectedSupplierForPO(supplierId); setPoDialogOpen(true) }}
            />
          )}
        </TabsContent>

        <TabsContent value="purchase-orders" className="flex-1 overflow-y-auto p-4 custom-scrollbar mt-0">
          {poLoading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
          ) : (
            <PurchaseOrdersList orders={purchaseOrders || []} />
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog za dobavitelja */}
      <SupplierDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingSupplier(null) }}
        supplier={editingSupplier}
        onSave={saveSupplierMutation.mutate}
      />

      {/* Dialog za nabavno naročilo */}
      <PurchaseOrderDialog
        open={poDialogOpen}
        onClose={() => setPoDialogOpen(false)}
        suppliers={suppliers || []}
        selectedSupplierId={selectedSupplierForPO}
        inventoryItems={inventoryItems || []}
        onSave={createPOMutation.mutate}
      />
    </div>
  )
})
