'use client'

// ============================================
// UPRAVITELJ DOBAVITELJEV — Profesionalen sistem
// Toast POS standard — Dobavitelji, ceniki, nabavna naročila
// ============================================

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { Truck, FileText, Plus } from 'lucide-react'
import { useState, memo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { SupplierType } from './supplier/constants'
import { useSupplierMutations } from './supplier/useSupplierMutations'

// Lazy-loaded podkomponente
const SuppliersList = dynamic(() => import('./supplier/SuppliersList').then(m => ({ default: m.SuppliersList })), { ssr: false })
const PurchaseOrdersList = dynamic(() => import('./supplier/PurchaseOrdersList').then(m => ({ default: m.PurchaseOrdersList })), { ssr: false })
const SupplierDialog = dynamic(() => import('./supplier/SupplierDialog').then(m => ({ default: m.SupplierDialog })), { ssr: false })
const PurchaseOrderDialog = dynamic(() => import('./supplier/PurchaseOrderDialog').then(m => ({ default: m.PurchaseOrderDialog })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================
export const SupplierManager = memo(function SupplierManager() {
  const [activeTab, setActiveTab] = useState('suppliers')
  const [searchTerm, _setSearchTerm] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<SupplierType | null>(null)
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Nabavna naročila dialog
  const [poDialogOpen, setPoDialogOpen] = useState(false)
  const [selectedSupplierForPO, setSelectedSupplierForPO] = useState<string>('')

  // FIX BUG-PO-3: refetch POs ko uporabnik preklopi na nabavna naročila tab
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
    if (tab === 'purchase-orders') {
      // Invalidate da pridobi sveže podatke
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
    }
  }, [queryClient])

  // Podatki
  const { data: suppliers, isLoading } = useQuery({
    queryKey: [...queryKeys.suppliers.all, searchTerm],
    queryFn: async () => {
      const params = searchTerm ? `?search=${searchTerm}` : ''
      const res = await authFetch(`/api/suppliers${params}`)
      if (!res.ok) return []
      const json = await res.json()
      // FIX TypeError: e.map is not a function — zagotovi da je vedno array
      const list = json.suppliers ?? json ?? []
      return Array.isArray(list) ? list : []
    },
  })

  const { data: purchaseOrders, isLoading: poLoading } = useQuery({
    queryKey: queryKeys.purchaseOrders.all,
    queryFn: async () => {
      const res = await authFetch('/api/purchase-orders')
      if (!res.ok) return []
      const json = await res.json()
      // FIX TypeError: e.map is not a function — zagotovi da je vedno array
      const list = json.orders ?? json.purchaseOrders ?? json ?? []
      return Array.isArray(list) ? list : []
    },
    // FIX BUG-PO-3: refetch na tab switch + stalno osveževanje
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0, // Vedno osveži ko je komponenta mount-ana
  })

  const { data: inventoryItems } = useQuery({
    // FIX BUG-PO-3 & BUG-PO-6: Prej je bil ?distinctCategories=true ki vrača samo
    // kategorije (string[]), ne inventory item-e. PurchaseOrderDialog ne more
    // ponuditi izbire inventory item-a ker dobi napačne podatke.
    queryKey: ['inventory-brief'],
    queryFn: async () => {
      const res = await authFetch('/api/inventory')
      if (!res.ok) return []
      const json = await res.json()
      // Pridobi vse inventory item-e (ne samo kategorije)
      const list = Array.isArray(json) ? json : (json.items ?? [])
      // Vrati samo potrebna polja za PO dialog
      return (Array.isArray(list) ? list : []).map((item: Record<string, unknown>) => ({
        id: String(item.id ?? ''),
        name: String(item.name ?? 'Neznan artikel'),
        unit: String(item.unit ?? 'kos'),
        costPerUnit: Number(item.costPerUnit ?? 0),
      }))
    },
    staleTime: 60000, // 1 minuta cache
  })

  // Mutacije
  const { saveSupplierMutation, createPOMutation } = useSupplierMutations({
    editingSupplier,
    setDialogOpen,
    setEditingSupplier,
    setPoDialogOpen,
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
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden" data-active-tab={activeTab}>
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

        {/* FIX BUG-PO-3: Radix Tabs 'hidden' attribute se ne uporabi pravilno ko je parent
            flex container — oba TabsContent panela sta bila vidna hkrati.
            Rešitev: uporabi conditional rendering namesto Radix built-in show/hide.
            DEBUG: dodan data-debug-active za diagnostiko v DevTools. */}
        {activeTab === 'suppliers' ? (
          <TabsContent value="suppliers" className="flex-1 overflow-y-auto p-4 custom-scrollbar mt-0" data-debug-active="suppliers">
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
        ) : (
          <TabsContent value="purchase-orders" className="flex-1 overflow-y-auto p-4 custom-scrollbar mt-0" data-debug-active="purchase-orders">
            {poLoading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
            ) : (
              <PurchaseOrdersList
                orders={purchaseOrders || []}
                onRefresh={() => queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })}
              />
            )}
          </TabsContent>
        )}
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
