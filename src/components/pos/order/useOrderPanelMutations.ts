'use client'

import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePOSStore } from '@/lib/store'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { OrderType } from './OrderList'

// ============================================
// HOOK: Mutacije in callbacki za OrderPanel
// Ločeno od useOrderPanel za boljšo berljivost
// ============================================

export function useOrderPanelMutations() {
  const queryClient = useQueryClient()
  const {
    cart, clearCart,
    discount, setDiscount,
    editingOrderId, editingOrderNumber, setEditingOrderId, setEditingOrderNumber,
    appliedDiscountId, diningOptionId,
    orderType, selectedTable, taxRate,
  } = usePOSStore()

  const placeOrderMutation = useMutation({
    mutationFn: async (params: {
      customerName: string
      customerPhone: string
      orderNotes: string
    }) => {
      const cappedDiscount = Math.min(discount, usePOSStore.getState().cartSubtotal())
      if (editingOrderId) {
        const res = await authFetch(`/api/orders/${editingOrderId}/add-items`, {
          method: 'POST',
          body: JSON.stringify({
            orderItems: cart.map(item => ({
              menuItemId: item.id,
              quantity: item.quantity,
              price: item.price,
              notes: item.notes,
              modifiersJson: JSON.stringify(item.modifiers.map(m => ({ name: m.name, price: m.price, modifierGroupName: m.modifierGroupName }))),
            })),
          }),
        })
        if (!res.ok) throw new Error('Failed to add items')
        return res.json()
      }
      const res = await authFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          type: orderType,
          tableId: orderType === 'dine-in' ? selectedTable : null,
          diningOptionId: diningOptionId || undefined,
          customerName: params.customerName,
          customerPhone: params.customerPhone,
          discount: cappedDiscount,
          appliedDiscountId: appliedDiscountId || undefined,
          taxRate,
          notes: params.orderNotes,
          orderItems: cart.map(item => ({
            menuItemId: item.id,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes,
            modifiersJson: JSON.stringify(item.modifiers.map(m => ({ name: m.name, price: m.price, modifierGroupName: m.modifierGroupName }))),
          })),
        }),
      })
      if (!res.ok) throw new Error('Failed to place order')
      return res.json()
    },
    onSuccess: (data) => {
      if (editingOrderId) {
        toast.success(`Artikli dodani k naročilu #${editingOrderNumber}!`)
      } else {
        toast.success('Naročilo uspešno oddano! Plačaj in natisni račun.')
      }
      clearCart()
      setDiscount(0)
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
      // Vrni podatke za samodejno plačilo — uporabnik hook-a mora obdelati
      return data
    },
    onError: () => { toast.error('Napaka pri oddaji naročila') },
  })

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await authFetch(`/api/orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update order')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Status naročila posodobljen')
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
    },
  })

  // ─── Stabilni callbacki ────────────────────────────────────────
  const handleVoided = useCallback(() => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }), [queryClient])
  const handleStornoComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  }, [queryClient])

  const handleAddToOrder = useCallback((order: OrderType) => {
    setEditingOrderId(order.id)
    setEditingOrderNumber(order.orderNumber)
  }, [setEditingOrderId, setEditingOrderNumber])

  const handleExitEditing = useCallback(() => { setEditingOrderId(null); setEditingOrderNumber(null); clearCart() }, [setEditingOrderId, setEditingOrderNumber, clearCart])

  return {
    placeOrderMutation,
    updateOrderStatusMutation,
    handleVoided,
    handleStornoComplete,
    handleAddToOrder,
    handleExitEditing,
  }
}
