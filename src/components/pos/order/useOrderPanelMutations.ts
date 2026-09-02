'use client'

import { useCallback, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePOSStore } from '@/lib/store'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { OrderType } from './OrderList'
import {
  enqueueOrder,
  isOnline,
  registerOrderBackgroundSync,
  startSyncPolling,
  getPendingCount,
} from '@/lib/offline-orders'

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

  // FIX Test 6.1: Zaženi offline sync polling ko je komponenta mountan
  useEffect(() => {
    // Registriraj Background Sync
    registerOrderBackgroundSync()

    // Začni polling fallback (vsake 5s)
    const stopPolling = startSyncPolling(authFetch)

    // Preveri pending orders ob mountu
    getPendingCount().then(count => {
      if (count > 0) {
        toast.info(`${count} naročil čaka na sinhronizacijo`)
      }
    })

    // Sync ko pride online
    const handleOnline = () => {
      console.log('[OfflineQueue] Network restored — syncing pending orders')
      import('@/lib/offline-orders').then(({ syncPendingOrders }) => {
        syncPendingOrders(authFetch).then(result => {
          if (result.succeeded > 0) {
            toast.success(`${result.succeeded} naročil sinhroniziranih`)
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
          }
        })
      })
    }
    window.addEventListener('online', handleOnline)

    return () => {
      stopPolling()
      window.removeEventListener('online', handleOnline)
    }
  }, [queryClient])

  const placeOrderMutation = useMutation({
    mutationFn: async (params: {
      customerName: string
      customerPhone: string
      orderNotes: string
    }) => {
      const cappedDiscount = Math.min(discount, usePOSStore.getState().cartSubtotal())

      // FIX Test 6.1: Če je offline, shrani v IndexedDB queue
      if (!isOnline() && !editingOrderId) {
        const idempotencyKey = `cart-${cart.map(i => `${i.id}:${i.quantity}`).join('-')}-${Date.now()}`
        const orderData = {
          type: orderType,
          tableId: orderType === 'dine-in' ? selectedTable : null,
          diningOptionId: diningOptionId || null,
          customerName: params.customerName,
          customerPhone: params.customerPhone,
          discount: cappedDiscount,
          appliedDiscountId: appliedDiscountId || null,
          taxRate,
          notes: params.orderNotes,
          orderItems: cart.map(item => ({
            menuItemId: item.id,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes,
            modifiersJson: JSON.stringify(item.modifiers.map(m => ({ name: m.name, price: m.price, modifierGroupName: m.modifierGroupName }))),
          })),
        }

        const queued = await enqueueOrder({
          id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          idempotencyKey,
          orderData,
          createdAt: Date.now(),
        })

        if (queued) {
          // Registriraj Background Sync da se bo poslal ko povezava pride
          await registerOrderBackgroundSync()
          return { offline: true, idempotencyKey }
        }
        // Če IndexedDB ni na voljo, poskusi direktno (bo failalo)
      }

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
          // FIX CRITICAL (Test 3.2): Idempotency key — prepreči duplikate pri retry/reconnect
          // Generiramo iz cart vsebine + timestamp-a. Če React Query retry-a request,
          // bo klient poslal isti key in server vrne obstoječi Order ID (200, ne 201).
          idempotencyKey: `cart-${cart.map(i => `${i.id}:${i.quantity}`).join('-')}-${Date.now()}`,
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
      if (data?.offline) {
        toast.info('Naročilo shranjeno offline — poslano bo ko povezava pride nazaj')
      } else if (editingOrderId) {
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
    // ⚡ OPTIMISTIC UPDATE — uporabnik vidi takojšen status change
    // (prej je čakal na server response + cache invalidation)
    onMutate: async ({ id, status }) => {
      // Cancel outgoing refetches da ne override-a optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.all })

      // Snapshot previous value za rollback
      const previousOrders = queryClient.getQueryData(queryKeys.orders.all)

      // Optimistically update vseh order listov
      queryClient.setQueriesData(
        { queryKey: queryKeys.orders.all },
        (old: unknown) => {
          if (!old || typeof old !== 'object') return old
          // Različni formati: { orders: [...] } ali [...]
          const updateOrder = (order: unknown) => {
            if (order && typeof order === 'object' && 'id' in order) {
              const o = order as { id?: string; status?: string } & Record<string, unknown>
              return o.id === id ? { ...o, status } : o
            }
            return order
          }
          if (Array.isArray(old)) {
            return old.map(updateOrder)
          }
          if (old && typeof old === 'object' && 'orders' in old) {
            const data = old as { orders: unknown[] }
            return { ...data, orders: Array.isArray(data.orders) ? data.orders.map(updateOrder) : data.orders }
          }
          return old
        },
      )

      return { previousOrders }
    },
    onError: (_err, _vars, context) => {
      // Rollback na previous state
      if (context?.previousOrders) {
        queryClient.setQueryData(queryKeys.orders.all, context.previousOrders)
      }
      toast.error('Napaka pri posodobitvi statusa — sprememba razveljavljena')
    },
    onSettled: () => {
      // Vedno refetch da sinhroniziramo s serverjem
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
    },
    onSuccess: () => {
      toast.success('Status naročila posodobljen')
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
